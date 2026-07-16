import { useEffect, useState } from 'react';
import { supabase, type WorkspaceMember } from '../lib/supabase';
import { PageHeader, Spinner, EmptyState, Breadcrumb } from '../lib/ui';
import { useRouter } from '../lib/router';
import { Users, Plus, X, Loader as Loader2, Mail, ShieldCheck } from 'lucide-react';

type Role = 'owner' | 'admin' | 'member' | 'viewer';
type MemberRow = WorkspaceMember & { profiles?: { email?: string | null; full_name?: string | null } | null };

const ROLE_CLS: Record<Role, string> = {
  owner: 'bg-brand-50 text-brand-700 border border-brand-200',
  admin: 'bg-blue-50 text-blue-600 border border-blue-200',
  member: 'bg-gray-100 text-gray-600 border border-gray-200',
  viewer: 'bg-gray-50 text-gray-500 border border-gray-200',
};

export function TeamPage() {
  const { navigate } = useRouter();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const wsId = () => localStorage.getItem('sandbox.activeWs');

  const load = async () => {
    setLoading(true);
    const wid = wsId();
    if (!wid) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('workspace_members')
      .select('*, profiles(email, full_name)')
      .eq('workspace_id', wid)
      .order('created_at', { ascending: true });
    if (error) console.error('TeamPage load error:', error);
    setMembers(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const invite = async () => {
    const wid = wsId();
    if (!wid || !email.trim()) return;
    setSaving(true); setError('');
    // Look up user by email
    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.trim())
      .maybeSingle();
    if (pErr || !profile) {
      setError('No user found with that email.');
      setSaving(false);
      return;
    }
    const { data, error: iErr } = await supabase
      .from('workspace_members')
      .insert({ workspace_id: wid, user_id: profile.id, role })
      .select('*, profiles(email, full_name)')
      .single();
    if (iErr) {
      setError(iErr.message);
      setSaving(false);
      return;
    }
    setMembers(prev => [...prev, data]);
    setEmail(''); setRole('member'); setInviting(false);
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-24"><Spinner size={28} /></div>;

  return (
    <div>
      <PageHeader
        title="Team"
        description="Members of this workspace and their roles."
        breadcrumb={<Breadcrumb items={[{ label: 'Settings', to: '/settings' }, { label: 'Team' }]} />}
        actions={<button onClick={() => setInviting(true)} className="btn-primary"><Plus size={16} /> Invite member</button>}
      />

      {members.length === 0 ? (
        <EmptyState icon={<Users size={22} />} title="No members yet" description="Invite teammates to collaborate in this workspace." action={<button onClick={() => setInviting(true)} className="btn-primary"><Plus size={16} /> Invite member</button>} />
      ) : (
        <div className="card divide-y divide-gray-100 p-0">
          {members.map(m => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-navy-900">{m.profiles?.full_name ?? m.profiles?.email ?? m.user_id.slice(0, 8)}</p>
                  {m.profiles?.email && <p className="text-xs text-gray-500">{m.profiles.email}</p>}
                </div>
              </div>
              <span className={`chip capitalize ${ROLE_CLS[m.role]}`}>{m.role}</span>
            </div>
          ))}
        </div>
      )}

      {inviting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setInviting(false)}>
          <div className="w-full max-w-md animate-scale-in rounded-xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Invite member</h2>
              <button onClick={() => setInviting(false)} className="btn-ghost p-1"><X size={16} /></button>
            </div>
            {error && <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-danger-600">{error}</div>}
            <label className="label">Email</label>
            <div className="relative mb-3">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-9" value={email} onChange={e => setEmail(e.target.value)} placeholder="teammate@company.com" />
            </div>
            <label className="label">Role</label>
            <select className="input mb-4" value={role} onChange={e => setRole(e.target.value as Role)}>
              <option value="viewer">Viewer — read only</option>
              <option value="member">Member — can run validations</option>
              <option value="admin">Admin — manage workspace</option>
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setInviting(false)} className="btn-secondary">Cancel</button>
              <button onClick={invite} disabled={saving || !email.trim()} className="btn-primary">{saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Invite</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
