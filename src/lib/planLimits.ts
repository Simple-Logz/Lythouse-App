// @ts-nocheck
import { supabase, type PlanId } from './supabase'

export const PLAN_LIMITS: Record<PlanId, { projects: number | null; validationsPerMonth: number | null }> = {
  free: { projects: 1, validationsPerMonth: 5 },
  developer: { projects: null, validationsPerMonth: null },
  enterprise: { projects: null, validationsPerMonth: null },
}

export type PlanFeature =
  | 'github_sync'
  | 'core_validation'
  | 'ai_analysis'
  | 'analytics'
  | 'validation_history'
  | 'api_testing'
  | 'load_testing'
  | 'environment_drift'
  | 'deployment_simulation'
  | 'change_management'
  | 'approvals'
  | 'audit_log'
  | 'advanced_integrations'
  | 'team_roles'
  | 'priority_support'

/** One entitlement map for navigation, pages and backend guards. Enterprise contains everything. */
export const PLAN_FEATURES: Record<PlanId, ReadonlySet<PlanFeature>> = {
  free: new Set<PlanFeature>([
    'github_sync','core_validation','ai_analysis','validation_history',
  ]),
  developer: new Set<PlanFeature>([
    'github_sync','core_validation','ai_analysis','analytics','validation_history',
    'api_testing','load_testing','environment_drift','deployment_simulation',
  ]),
  enterprise: new Set<PlanFeature>([
    'github_sync','core_validation','ai_analysis','analytics','validation_history',
    'api_testing','load_testing','environment_drift','deployment_simulation',
    'change_management','approvals','audit_log','advanced_integrations','team_roles','priority_support',
  ]),
}

export function hasPlanFeature(planId: PlanId | null | undefined, feature: PlanFeature): boolean {
  return PLAN_FEATURES[planId || 'free']?.has(feature) ?? false
}

export function requiredPlanFor(feature: PlanFeature): PlanId {
  if (PLAN_FEATURES.free.has(feature)) return 'free'
  if (PLAN_FEATURES.developer.has(feature)) return 'developer'
  return 'enterprise'
}

export type LimitCheck = { ok: boolean; count: number; limit: number | null }

export async function checkProjectLimit(planId: PlanId, workspaceId: string): Promise<LimitCheck> {
  const limit = PLAN_LIMITS[planId]?.projects ?? null
  if (limit == null) return { ok: true, count: 0, limit: null }
  const { count, error } = await supabase.from('projects').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId)
  if (error) throw error
  return { ok: (count ?? 0) < limit, count: count ?? 0, limit }
}

export async function checkValidationLimit(planId: PlanId, workspaceId: string): Promise<LimitCheck> {
  const limit = PLAN_LIMITS[planId]?.validationsPerMonth ?? null
  if (limit == null) return { ok: true, count: 0, limit: null }
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const { count, error } = await supabase.from('validations').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).gte('created_at', monthStart.toISOString())
  if (error) throw error
  return { ok: (count ?? 0) < limit, count: count ?? 0, limit }
}
