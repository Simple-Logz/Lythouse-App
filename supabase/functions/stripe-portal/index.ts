import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  appInfo: { name: 'LytHouse', version: '1.0.0' },
});

function corsResponse(body: object | null, status = 200) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };
  if (status === 204) return new Response(null, { status, headers });
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

// Opens a Stripe Billing Portal session so a customer can update payment method,
// change plan, view invoices, or cancel. Only owners/admins of the workspace may open it.
Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return corsResponse({}, 204);
    if (req.method !== 'POST') return corsResponse({ error: 'Method not allowed' }, 405);

    const { return_url, workspace_id } = await req.json();
    if (typeof return_url !== 'string' || typeof workspace_id !== 'string') {
      return corsResponse({ error: 'Missing return_url or workspace_id' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return corsResponse({ error: 'Missing authorization' }, 401);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return corsResponse({ error: 'Failed to authenticate user' }, 401);

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return corsResponse({ error: 'You do not have permission to manage billing for this workspace' }, 403);
    }

    const { data: customer } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!customer?.customer_id) {
      return corsResponse({ error: 'No billing account found. Start a subscription first.' }, 404);
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.customer_id,
      return_url,
    });

    return corsResponse({ url: session.url });
  } catch (error: any) {
    console.error(`Portal error: ${error.message}`);
    return corsResponse({ error: error.message }, 500);
  }
});
