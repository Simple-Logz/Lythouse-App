import { supabase, edgeFunctionUrl, anonKey, type PlanId } from './supabase';

export const STRIPE_PRICE: Partial<Record<PlanId, string>> = {
  developer: import.meta.env.VITE_STRIPE_PRICE_DEVELOPER as string,
  enterprise: import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE as string,
};

async function authedPost(fn: string, body: Record<string, unknown>): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${edgeFunctionUrl}/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${session?.access_token ?? anonKey}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

/** Start a Stripe Checkout session for a paid plan and return the redirect URL. */
export async function startCheckout(planId: PlanId, workspaceId: string): Promise<string> {
  const priceId = STRIPE_PRICE[planId];
  if (!priceId) throw new Error('This plan is not available for self-serve checkout yet.');
  const origin = window.location.origin;
  const { url } = await authedPost('stripe-checkout', {
    price_id: priceId,
    mode: 'subscription',
    workspace_id: workspaceId,
    success_url: `${origin}/plans?checkout=success`,
    cancel_url: `${origin}/plans?checkout=cancelled`,
  });
  return url;
}

/** Open the Stripe Billing Portal (manage/cancel/invoices) and return its URL. */
export async function openBillingPortal(workspaceId: string): Promise<string> {
  const { url } = await authedPost('stripe-portal', {
    workspace_id: workspaceId,
    return_url: `${window.location.origin}/plans`,
  });
  return url;
}

export function isSelfServe(planId: PlanId): boolean {
  return !!STRIPE_PRICE[planId];
}
