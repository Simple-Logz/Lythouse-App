import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors });
  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: cors });
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data: userData, error: userError } = await db.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers: cors });
    const { workspaceId } = await req.json();
    if (!workspaceId) return new Response(JSON.stringify({ error: 'workspaceId is required' }), { status: 400, headers: cors });
    const { data: member } = await db.from('workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', user.id).maybeSingle();
    if (!member || !['owner', 'admin', 'developer'].includes(member.role)) return new Response(JSON.stringify({ error: 'You do not have permission to connect repositories.' }), { status: 403, headers: cors });
    const slug = Deno.env.get('GITHUB_APP_SLUG');
    if (!slug) return new Response(JSON.stringify({ error: 'GitHub App is not configured yet.' }), { status: 503, headers: cors });
    const appOrigin = Deno.env.get('APP_ORIGIN') || '';
    const state = btoa(JSON.stringify({ workspaceId, userId: user.id, returnTo: `${appOrigin}/projects` }));
    return new Response(JSON.stringify({ installUrl: `https://github.com/apps/${encodeURIComponent(slug)}/installations/new?state=${encodeURIComponent(state)}` }), { status: 200, headers: cors });
  } catch (e) {
    console.error('github-app-connect', e);
    return new Response(JSON.stringify({ error: 'GitHub connection could not be started.' }), { status: 500, headers: cors });
  }
});
