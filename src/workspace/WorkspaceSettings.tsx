// @ts-nocheck
import { useState } from 'react';
import {
  X, GitBranch, KeyRound, Radar, ShieldCheck, Bell, Trash2, Check,
  Loader as Loader2, ExternalLink, Info,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { loadSettings, saveSettings } from './releaseSettings';
import { clearReport } from './repoCache';
import { PROVIDERS, isConnected } from '../lib/integrations';
import { Link } from '../lib/router';

function Toggle({ on, onClick, disabled }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? 'bg-brand-600' : 'bg-gray-300'} ${disabled ? 'opacity-40' : ''}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

function Row({ icon, title, desc, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-medium text-navy-900">{icon}{title}</div>
        {desc && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function WorkspaceSettings({ project, onClose, onSaved }) {
  const [branch, setBranch] = useState(project.git_branch || 'main');
  const [token, setToken] = useState(project.github_token || '');
  const [showToken, setShowToken] = useState(false);
  const [s, setS] = useState(() => loadSettings(project));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [err, setErr] = useState('');

  const set = (patch) => setS((prev) => ({ ...prev, ...patch }));
  const connectedProviders = PROVIDERS.filter((p) => isConnected(p.id));

  const save = async () => {
    setSaving(true); setErr(''); setSaved(false);
    // Preferences → localStorage (always succeeds).
    saveSettings(project, s);
    // Repository connection → the project record.
    const repoChanged = branch !== (project.git_branch || 'main') || token !== (project.github_token || '');
    if (repoChanged) {
      try {
        const { error } = await supabase.from('projects')
          .update({ git_branch: branch || 'main', github_token: token || null })
          .eq('id', project.id);
        if (error) throw error;
        project.git_branch = branch || 'main';
        project.github_token = token || null;
      } catch (e) {
        setErr('Preferences saved, but the repository connection could not be updated: ' + (e.message || 'unknown error'));
        setSaving(false);
        return;
      }
    }
    setSaving(false); setSaved(true);
    onSaved && onSaved({ repoChanged });
    setTimeout(() => setSaved(false), 2500);
  };

  const clearCache = () => {
    ['discovery', 'validation', 'findings'].forEach((k) => clearReport(k, project));
    setCleared(true);
    setTimeout(() => setCleared(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 h-16 shrink-0">
          <div>
            <h2 className="text-sm font-bold text-navy-900">Release Settings</h2>
            <p className="text-xs text-gray-500 truncate max-w-[18rem]">{project.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 divide-y divide-gray-100">
          {/* Repository connection */}
          <div className="pb-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Repository</p>
            <Row icon={<GitBranch size={14} className="text-brand-600" />} title="Branch assessed" desc="The branch LytHouse reads to build the release decision.">
              <input value={branch} onChange={(e) => setBranch(e.target.value)} className="w-32 rounded-lg border border-[#d4d4d8] px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none" placeholder="main" />
            </Row>
            <Row icon={<KeyRound size={14} className="text-brand-600" />} title="GitHub access token" desc="Raises the API rate limit and enables private repositories. Stored with this project only.">
              <div className="flex items-center gap-1.5">
                <input value={token} onChange={(e) => setToken(e.target.value)} type={showToken ? 'text' : 'password'} className="w-36 rounded-lg border border-[#d4d4d8] px-2.5 py-1.5 text-xs font-mono focus:border-brand-400 focus:outline-none" placeholder="ghp_…" />
                <button onClick={() => setShowToken((v) => !v)} className="text-[11px] text-brand-600 hover:underline">{showToken ? 'Hide' : 'Show'}</button>
              </div>
            </Row>
          </div>

          {/* Continuous validation */}
          <div className="py-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Continuous validation</p>
            <Row icon={<Radar size={14} className="text-brand-600" />} title="Watch for repository changes" desc="Show the change window when new commits land after an assessment, and flag which review scopes need revalidating.">
              <Toggle on={s.watchChanges} onClick={() => set({ watchChanges: !s.watchChanges })} />
            </Row>
            <Row icon={<Bell size={14} className="text-brand-600" />} title="Notify on new changes" desc={connectedProviders.length ? 'Route change-window alerts to a connected tool.' : 'Connect a tool in Integrations to enable alerts.'}>
              {connectedProviders.length ? (
                <select value={s.notifyChannel} onChange={(e) => set({ notifyChannel: e.target.value })} className="rounded-lg border border-[#d4d4d8] px-2 py-1.5 text-sm focus:border-brand-400 focus:outline-none">
                  <option value="">Off</option>
                  {connectedProviders.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              ) : (
                <Link to="/integrations" onClick={onClose} className="text-xs font-medium text-brand-600 hover:underline flex items-center gap-1">Integrations<ExternalLink size={11} /></Link>
              )}
            </Row>
          </div>

          {/* Deployment policy */}
          <div className="py-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Deployment policy</p>
            <Row icon={<ShieldCheck size={14} className="text-brand-600" />} title="Minimum readiness to deploy" desc="Block the Deploy action when release readiness is below this threshold.">
              <select value={s.deployGateReadiness} onChange={(e) => set({ deployGateReadiness: Number(e.target.value) })} className="rounded-lg border border-[#d4d4d8] px-2 py-1.5 text-sm focus:border-brand-400 focus:outline-none">
                <option value={0}>Off</option>
                <option value={70}>70%</option>
                <option value={80}>80%</option>
                <option value={90}>90%</option>
              </select>
            </Row>
            <Row icon={<ShieldCheck size={14} className="text-gray-400" />} title="Treat high findings as blockers" desc="Not just critical findings — high-severity issues also block deployment.">
              <Toggle on={s.blockOnHigh} onClick={() => set({ blockOnHigh: !s.blockOnHigh })} />
            </Row>
            <Row icon={<ShieldCheck size={14} className="text-gray-400" />} title="Require an approval to deploy" desc="At least one recorded sign-off is needed before the release can ship.">
              <Toggle on={s.requireApproval} onClick={() => set({ requireApproval: !s.requireApproval })} />
            </Row>
          </div>

          {/* Data */}
          <div className="py-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Cached analysis</p>
            <Row icon={<Trash2 size={14} className="text-gray-400" />} title="Clear cached reports" desc="Discard the stored discovery, validation and findings for this project so the next open re-reads the repository fresh.">
              <button onClick={clearCache} className="btn-secondary text-xs">{cleared ? <><Check size={13} />Cleared</> : 'Clear'}</button>
            </Row>
          </div>

          {err && <div className="mt-2 rounded-lg border border-[#f5a3a3] bg-[#fde3e3] px-3 py-2 text-xs text-[#b3261e] flex items-start gap-1.5"><Info size={13} className="shrink-0 mt-0.5" />{err}</div>}
        </div>

        <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-gray-400">Settings apply to this project.</p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary text-sm">
              {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : saved ? <><Check size={14} />Saved</> : 'Save settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
