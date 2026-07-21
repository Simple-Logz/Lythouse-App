import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

function corsResponse(body: object | null, status = 200) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };
  if (status === 204) return new Response(null, { status, headers });
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

/*
 * Deletes the authenticated user's account.
 *
 * Guardrail: refuses to delete while the user still solely owns any workspace,
 * because deleting the auth user cascades and would wipe that workspace's data
 * out from under any other members. The user must delete or transfer those
 * workspaces first. Workspaces they own alone (no other members) are removed.
 */
Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return corsResponse({}, 204);
    if (req.method !== 'POST') return corsResponse({ error: 'Method not allowed' }, 405);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return corsResponse({ error: 'Missing authorization' }, 401);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !user) return corsResponse({ error: 'Failed to authenticate user' }, 401);

    const { confirm } = await req.json().catch(() => ({}));
    if (confirm !== 'DELETE') {
      return corsResponse({ error: 'Confirmation required' }, 400);
    }

    // Workspaces owned by this user.
    const { data: owned } = await admin.from('workspaces').select('id').eq('owner_id', user.id);
    for (const ws of owned ?? []) {
      const { count } = await admin
        .from('workspace_members')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', ws.id)
        .neq('user_id', user.id);
      if ((count ?? 0) > 0) {
        return corsResponse({
          error: 'You still own a workspace with other members. Transfer ownership or remove members before deleting your account.',
        }, 409);
      }
      // Sole owner — safe to delete the workspace (cascades its data).
      await admin.from('workspaces').delete().eq('id', ws.id);
    }

    // Soft-delete any Stripe customer mapping so billing stops resolving to them.
    await admin.from('stripe_customers').update({ deleted_at: new Date().toISOString() }).eq('user_id', user.id);

    // Finally remove the auth user (cascades profiles, remaining memberships).
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) return corsResponse({ error: delErr.message }, 500);

    return corsResponse({ deleted: true });
  } catch (error: any) {
    console.error(`delete-account error: ${error.message}`);
    return corsResponse({ error: error.message }, 500);
  }
});
