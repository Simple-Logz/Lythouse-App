// @ts-nocheck
// Single source of truth for the plan limits that are actually promised on
// the Plans page (PlansPage.tsx's FEATURES: '1 project', '5 validations /
// month' for Free; unlimited for Developer/Enterprise). Previously these
// numbers were only ever displayed (on UsagePage, as a progress bar) and
// never enforced anywhere — a Free workspace could create unlimited
// projects and run unlimited validations despite what the pricing page
// said. These helpers are the real enforcement, queried against the actual
// `projects`/`validations` tables so the count is always current.
//
// Deliberately no member-count limit here: nothing on the Plans page ever
// promises one, so there's nothing honest to enforce.
import { supabase, type PlanId } from './supabase'

export const PLAN_LIMITS: Record<PlanId, { projects: number | null; validationsPerMonth: number | null }> = {
  free: { projects: 1, validationsPerMonth: 5 },
  developer: { projects: null, validationsPerMonth: null },
  enterprise: { projects: null, validationsPerMonth: null },
}

export type LimitCheck = { ok: boolean; count: number; limit: number | null }

export async function checkProjectLimit(planId: PlanId, workspaceId: string): Promise<LimitCheck> {
  const limit = PLAN_LIMITS[planId]?.projects ?? null
  if (limit == null) return { ok: true, count: 0, limit: null }
  const { count } = await supabase.from('projects').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId)
  return { ok: (count ?? 0) < limit, count: count ?? 0, limit }
}

export async function checkValidationLimit(planId: PlanId, workspaceId: string): Promise<LimitCheck> {
  const limit = PLAN_LIMITS[planId]?.validationsPerMonth ?? null
  if (limit == null) return { ok: true, count: 0, limit: null }
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const { count } = await supabase.from('validations').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).gte('created_at', monthStart.toISOString())
  return { ok: (count ?? 0) < limit, count: count ?? 0, limit }
}
