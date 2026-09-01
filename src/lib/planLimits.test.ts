import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
  resolveActiveWorkspace: vi.fn(),
}))

let hasPlanFeature: typeof import('./planLimits').hasPlanFeature
let requiredPlanFor: typeof import('./planLimits').requiredPlanFor

beforeAll(async () => {
  const module = await import('./planLimits')
  hasPlanFeature = module.hasPlanFeature
  requiredPlanFor = module.requiredPlanFor
})

describe('plan entitlements', () => {
  it('keeps free users on core validation features', () => {
    expect(hasPlanFeature('free', 'github_sync')).toBe(true)
    expect(hasPlanFeature('free', 'core_validation')).toBe(true)
    expect(hasPlanFeature('free', 'api_testing')).toBe(false)
    expect(hasPlanFeature('free', 'audit_log')).toBe(false)
  })
  it('allows developer API/load testing but not enterprise governance', () => {
    expect(hasPlanFeature('developer', 'api_testing')).toBe(true)
    expect(hasPlanFeature('developer', 'load_testing')).toBe(true)
    expect(hasPlanFeature('developer', 'approvals')).toBe(false)
  })
  it('grants enterprise governance capabilities', () => {
    expect(hasPlanFeature('enterprise', 'approvals')).toBe(true)
    expect(hasPlanFeature('enterprise', 'audit_log')).toBe(true)
    expect(hasPlanFeature('enterprise', 'team_roles')).toBe(true)
  })
  it('returns the minimum plan for gated features', () => {
    expect(requiredPlanFor('core_validation')).toBe('free')
    expect(requiredPlanFor('api_testing')).toBe('developer')
    expect(requiredPlanFor('audit_log')).toBe('enterprise')
  })
})
