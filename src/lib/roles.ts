// Central role + permission model for LytHouse workspaces.
// Five roles, most-privileged first. Keep this in sync with the DB:
//   - workspace_members.role CHECK / default
//   - is_workspace_admin() (owner|admin) in the RLS migrations
//   - can_manage_members / can_approve_release helpers

export type Role = 'owner' | 'admin' | 'developer' | 'approver' | 'viewer';

export const ROLES: Role[] = ['owner', 'admin', 'developer', 'approver', 'viewer'];

// Roles an admin is allowed to *assign* to others (never 'owner' — ownership
// transfers are a separate, deliberate action).
export const ASSIGNABLE_ROLES: Role[] = ['admin', 'developer', 'approver', 'viewer'];

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  developer: 'Developer',
  approver: 'Approver',
  viewer: 'Viewer',
};

export const ROLE_DESC: Record<Role, string> = {
  owner: 'Full access — billing and can delete the workspace',
  admin: 'Manage members, projects, and settings',
  developer: 'Create projects and run validations',
  approver: 'Review results and approve or block releases',
  viewer: 'Read-only access',
};

export const ROLE_CLS: Record<Role, string> = {
  owner: 'bg-brand-50 text-brand-700 border border-brand-200',
  admin: 'bg-blue-50 text-blue-600 border border-blue-200',
  developer: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
  approver: 'bg-amber-50 text-amber-700 border border-amber-200',
  viewer: 'bg-gray-100 text-gray-600 border border-[#d4d4d8]',
};

// A rough privilege ordering — higher number = more power. Used for
// "can this actor manage that member" style checks.
export const ROLE_RANK: Record<Role, number> = {
  owner: 100,
  admin: 80,
  developer: 50,
  approver: 40,
  viewer: 10,
};

// Every capability the UI gates on. Keep the names verb-ish and specific.
export type Permission =
  | 'workspace.delete'
  | 'workspace.update'
  | 'billing.manage'
  | 'members.manage' // invite / remove / change roles
  | 'groups.manage'
  | 'projects.create'
  | 'projects.delete'
  | 'projects.update'
  | 'validations.run'
  | 'deployments.create'
  | 'policies.update'
  | 'integrations.manage'
  | 'releases.approve'
  | 'findings.resolve';

// Capability matrix. A permission is granted if the role appears in its set.
const MATRIX: Record<Permission, Role[]> = {
  'workspace.delete': ['owner'],
  'workspace.update': ['owner', 'admin'],
  'billing.manage': ['owner', 'admin'],
  'members.manage': ['owner', 'admin'],
  'groups.manage': ['owner', 'admin'],
  'projects.create': ['owner', 'admin', 'developer'],
  'projects.delete': ['owner', 'admin'],
  'projects.update': ['owner', 'admin', 'developer'],
  'validations.run': ['owner', 'admin', 'developer'],
  'deployments.create': ['owner', 'admin', 'developer'],
  'policies.update': ['owner', 'admin'],
  'integrations.manage': ['owner', 'admin', 'developer'],
  'releases.approve': ['owner', 'admin', 'approver'],
  'findings.resolve': ['owner', 'admin', 'developer'],
};

/** True if `role` is allowed to perform `perm`. Unknown roles get nothing. */
export function can(role: Role | string | null | undefined, perm: Permission): boolean {
  if (!role) return false;
  const allowed = MATRIX[perm];
  return !!allowed && allowed.includes(role as Role);
}

/** Can `actor` manage (change role / remove) a member who currently holds `target`? */
export function canManageMember(actor: Role | string | null | undefined, target: Role | string): boolean {
  if (!can(actor, 'members.manage')) return false;
  if (target === 'owner') return false; // owners are never managed via the roster
  // An admin cannot manage another admin; only the owner can.
  if (actor === 'admin' && target === 'admin') return false;
  return true;
}

export function normalizeRole(role: string | null | undefined): Role {
  if (role && (ROLES as string[]).includes(role)) return role as Role;
  // Legacy rows created before the 5-role model used 'member'.
  if (role === 'member') return 'developer';
  return 'viewer';
}
