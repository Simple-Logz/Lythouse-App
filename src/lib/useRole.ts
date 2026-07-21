import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { normalizeRole, can, type Role, type Permission } from './roles';

const activeWs = () => localStorage.getItem('sandbox.activeWs');

/**
 * Resolves the signed-in user's role in the currently-active workspace.
 * Returns a `can(permission)` helper bound to that role so callers can gate UI
 * with `role.can('members.manage')`.
 */
export function useRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const wid = activeWs();
    if (!user || !wid) {
      setRole(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', wid)
      .eq('user_id', user.id)
      .maybeSingle();
    setRole(data ? normalizeRole(data.role) : null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    role,
    loading,
    isOwner: role === 'owner',
    isAdmin: role === 'owner' || role === 'admin',
    can: (perm: Permission) => can(role, perm),
    reload: load,
  };
}
