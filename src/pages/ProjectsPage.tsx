import { useEffect, useState } from 'react';
import { supabase, edgeFunctionUrl, anonKey, resolveActiveWorkspace, type Project } from '../lib/supabase';
import { PageHeader, EmptyState, Spinner } from '../lib/ui';
import { useRouter, Link } from '../lib/router';
import { FolderGit2, Plus, GitFork as Github, Search, ChevronRight, Lock, X, RefreshCw, ShieldCheck } from 'lucide-react';
import { usePlanId } from './AppShell';
import { PLAN_LIMITS } from '../lib/planLimits';

const hostFrom = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

export function ProjectsPage() {
  const { navigate } = useRouter();
  const planId = usePlanId();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [wid, setWid] = useState('');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const limit = PLAN_LIMITS[planId]?.projects ?? null;
  const atLimit = limit != null && projects.length >= limit;

  async function load() {
    setLoading(true); setError('');
    try {
      const ws = await resolveActiveWorkspace();
      setWid(ws.id);
      const { data, error: e } = await supabase.from('projects')
        .select('id,name,description,status,git_url,git_branch,repo_folder,language,workspace_id,created_at,github_repository_full_name,github_installation_id')
        .eq('workspace_id', ws.id).order('created_at', { ascending: false });
      if (e) throw e;
      setProjects(data ?? []);
    } catch (e: any) { setProjects([]); setError(e?.message || 'Projects could not be loaded.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); const h = () => load(); window.addEventListener('lythouse:workspace-changed', h); return () => window.removeEventListener('lythouse:workspace-changed', h); }, []);

  async function connectGitHub() {
    if (!wid) return setError('Workspace is not ready.');
    setSaving(true); setError('');
    try {
      const { data: { session }, error: se } = await supabase.auth.getSession();
      if (se || !session) throw new Error('Your session expired. Sign in again.');
      const r = await fetch(`${edgeFunctionUrl}/github-app-connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: anonKey },
        body: JSON.stringify({ workspaceId: wid })
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || 'GitHub connection could not be started.');
      if (!body.installUrl) throw new Error('GitHub App is not configured yet.');
      window.location.assign(body.installUrl);
    } catch (e: any) { setError(e?.message || 'GitHub connection could not be started.'); setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner size={28}/></div>;
  const filtered = projects.filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()));

  return <div>
    <PageHeader title="Projects" description="Every repository connected to LytHouse for pre-deployment validation." actions={atLimit ? <Link to="/plans" className="btn-primary"><Lock size={14}/> Upgrade for more projects</Link> : <button onClick={() => { setError(''); setModal(true); }} className="btn-primary"><Plus size={16}/> Connect project</button>}/>
    {error && !modal && <div className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><span>{error}</span><button className="btn-secondary text-xs" onClick={load}><RefreshCw size={13}/> Retry</button></div>}
    {projects.length === 0 ? <EmptyState icon={<FolderGit2 size={22}/>} title="No projects yet" description="Connect GitHub and choose the repositories LytHouse may validate." action={!atLimit ? <button onClick={() => setModal(true)} className="btn-primary"><Github size={16}/> Connect GitHub</button> : <Link to="/plans" className="btn-primary">Upgrade for more projects</Link>}/> : <>
      <div className="mb-4 relative max-w-xs"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input className="input pl-9" value={q} onChange={e => setQ(e.target.value)} placeholder="Search projects…"/></div>
      <div className="card overflow-hidden p-0 divide-y divide-gray-100">{filtered.map((p: any) => <Link key={p.id} to={'/projects/' + p.id} className="flex items-center gap-4 px-4 py-4 hover:bg-gray-50"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><FolderGit2 size={18}/></div><div className="min-w-0 flex-1"><div className="font-semibold text-navy-900">{p.name}</div><div className="text-xs text-gray-500">{p.github_repository_full_name || (p.git_url ? hostFrom(p.git_url) : 'Repository not connected')}{p.git_branch ? ' · ' + p.git_branch : ''}</div></div><span className="chip border border-brand-200 bg-brand-50 text-brand-700">{p.status}</span><ChevronRight size={16} className="text-gray-300"/></Link>)}</div>
    </>}
    {modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && setModal(false)}><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}><div className="mb-5 flex items-start justify-between"><div><h2 className="text-xl font-semibold">Connect GitHub</h2><p className="mt-1 text-sm text-gray-500">Securely choose the repositories LytHouse may validate.</p></div><button className="btn-ghost" disabled={saving} onClick={() => setModal(false)}><X size={16}/></button></div>{error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}<div className="rounded-xl border border-gray-200 bg-gray-50 p-4"><div className="flex gap-3"><ShieldCheck size={20} className="mt-0.5 text-brand-600"/><div><div className="font-semibold text-navy-900">GitHub App connection</div><p className="mt-1 text-sm text-gray-600">GitHub handles authentication. LytHouse never asks for your GitHub password or Personal Access Token. You choose which repositories the LytHouse GitHub App can access.</p><p className="mt-2 text-xs text-gray-500">Repository access is performed server-side using short-lived GitHub App installation credentials.</p></div></div></div><div className="mt-5 flex justify-end"><button className="btn-primary" disabled={saving} onClick={connectGitHub}><Github size={16}/>{saving ? 'Opening GitHub…' : 'Continue with GitHub'}</button></div></div></div>}
  </div>;
}
