// @ts-nocheck
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile } from './supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, meta?: Record<string, any>) => Promise<{ error: string | null }>;
  signInWithProvider: (provider: 'google' | 'github' | 'gitlab' | 'azure') => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  resendVerification: (email: string) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function ensureWorkspace(userId: string): Promise<void> {
  const active = localStorage.getItem('sandbox.activeWs');
  if (active) {
    const { data: membership } = await supabase.from('workspace_members').select('workspace_id').eq('workspace_id', active).eq('user_id', userId).maybeSingle();
    if (membership) return;
    localStorage.removeItem('sandbox.activeWs');
  }

  const { data: memberships } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', userId).order('created_at', { ascending: true }).limit(1);
  if (memberships?.[0]?.workspace_id) {
    localStorage.setItem('sandbox.activeWs', memberships[0].workspace_id);
    return;
  }

  const pendingName = localStorage.getItem('lh.pendingAccount') || 'My Workspace';
  const { data, error } = await supabase.rpc('bootstrap_user_workspace', { p_name: pendingName });
  if (error) throw error;
  const workspaceId = data?.[0]?.workspace_id;
  if (!workspaceId) throw new Error('Workspace bootstrap did not return a workspace');
  localStorage.setItem('sandbox.activeWs', workspaceId);
  localStorage.removeItem('lh.pendingAccount');
  localStorage.removeItem('lh.pendingCompanySize');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(uid: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    setProfile(data as Profile | null);
  }

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        (async () => {
          try { await ensureWorkspace(data.session.user.id); await loadProfile(data.session.user.id); }
          finally { if (mounted) setLoading(false); }
        })();
      } else setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        (async () => { await ensureWorkspace(newSession.user.id); await loadProfile(newSession.user.id); })().catch(console.error);
      } else setProfile(null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const signIn: AuthContextValue['signIn'] = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.user) {
      try { await ensureWorkspace(data.user.id); } catch (e) { return { error: e instanceof Error ? e.message : 'Workspace setup failed' }; }
    }
    return { error: error?.message ?? null };
  };

  const signUp: AuthContextValue['signUp'] = async (email, password, fullName, meta) => {
    if (meta?.account_name) localStorage.setItem('lh.pendingAccount', meta.account_name);
    if (meta?.company_size) localStorage.setItem('lh.pendingCompanySize', meta.company_size);
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, ...(meta || {}) } } });
    if (error) return { error: error.message };
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (!signInError && signInData.user) {
      try { await ensureWorkspace(signInData.user.id); } catch (e) { return { error: e instanceof Error ? e.message : 'Workspace setup failed' }; }
      return { error: null };
    }
    if (data.user && !data.session) return { error: 'EMAIL_CONFIRMATION_REQUIRED' };
    if (signInError) return { error: signInError.message };
    return { error: null };
  };

  const signInWithProvider: AuthContextValue['signInWithProvider'] = async (provider) => {
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/dashboard` } });
    return { error: error?.message ?? null };
  };
  const signOut = async () => { await supabase.auth.signOut(); setProfile(null); };
  const refreshProfile = async () => { if (session?.user) await loadProfile(session.user.id); };
  const resetPassword: AuthContextValue['resetPassword'] = async (email) => { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }); return { error: error?.message ?? null }; };
  const updatePassword: AuthContextValue['updatePassword'] = async (newPassword) => { const { error } = await supabase.auth.updateUser({ password: newPassword }); return { error: error?.message ?? null }; };
  const resendVerification: AuthContextValue['resendVerification'] = async (email) => { const { error } = await supabase.auth.resend({ type: 'signup', email }); return { error: error?.message ?? null }; };

  return <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, loading, signIn, signUp, signInWithProvider, signOut, refreshProfile, resetPassword, updatePassword, resendVerification }}>{children}</AuthContext.Provider>;
}

export function useAuth() { const ctx = useContext(AuthContext); if (!ctx) throw new Error('useAuth must be used within AuthProvider'); return ctx; }
