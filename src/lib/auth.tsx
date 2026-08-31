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

async function ensureWorkspace(accountName?: string): Promise<string> {
  const { data, error } = await supabase.rpc('bootstrap_user_workspace', { p_name: accountName || null });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  const workspaceId = row?.workspace_id;
  if (!workspaceId) throw new Error('Workspace bootstrap did not return a workspace');
  localStorage.setItem('sandbox.activeWs', workspaceId);
  localStorage.setItem('lh.activeWorkspace', workspaceId);
  return workspaceId;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(uid: string) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (error) throw error;
    setProfile(data as Profile | null);
  }

  async function hydrate(s: Session | null) {
    setSession(s);
    if (!s?.user) { setProfile(null); setLoading(false); return; }
    try {
      await ensureWorkspace(localStorage.getItem('lh.pendingAccount') || undefined);
      await loadProfile(s.user.id);
      localStorage.removeItem('lh.pendingAccount');
      localStorage.removeItem('lh.pendingCompanySize');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => { if (mounted) void hydrate(data.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => { if (mounted) void hydrate(newSession); });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const signIn: AuthContextValue['signIn'] = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    try { await ensureWorkspace(); if (data.user) await loadProfile(data.user.id); }
    catch (e) { return { error: e instanceof Error ? e.message : 'Account initialization failed' }; }
    return { error: null };
  };

  const signUp: AuthContextValue['signUp'] = async (email, password, fullName, meta) => {
    if (meta?.account_name) localStorage.setItem('lh.pendingAccount', meta.account_name);
    if (meta?.company_size) localStorage.setItem('lh.pendingCompanySize', meta.company_size);
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, ...(meta || {}) } } });
    if (error) return { error: error.message };
    if (data.session) {
      try { await ensureWorkspace(meta?.account_name); if (data.user) await loadProfile(data.user.id); }
      catch (e) { return { error: e instanceof Error ? e.message : 'Account initialization failed' }; }
      return { error: null };
    }
    if (data.user) return { error: 'EMAIL_CONFIRMATION_REQUIRED' };
    return { error: 'Unable to create account' };
  };

  const signInWithProvider: AuthContextValue['signInWithProvider'] = async (provider) => {
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/dashboard` } });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null); setProfile(null);
    localStorage.removeItem('sandbox.activeWs');
    localStorage.removeItem('lh.activeWorkspace');
  };

  const refreshProfile = async () => { if (session?.user) await loadProfile(session.user.id); };
  const resetPassword: AuthContextValue['resetPassword'] = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    return { error: error?.message ?? null };
  };
  const updatePassword: AuthContextValue['updatePassword'] = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  };
  const resendVerification: AuthContextValue['resendVerification'] = async (email) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    return { error: error?.message ?? null };
  };

  return <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, loading, signIn, signUp, signInWithProvider, signOut, refreshProfile, resetPassword, updatePassword, resendVerification }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
