// @ts-nocheck
// ── Dedicated mobile app ────────────────────────────────────────────────────
// A purpose-built phone experience (bottom-tab nav + stacked card screens),
// NOT a shrunk desktop layout. Focused on the core release flow: check status,
// see why a release is blocked, act on approvals, and get change alerts.
import { useEffect, useState, useCallback } from 'react';
import {
  House, ShieldCheck, Bell, User, ChevronLeft, ChevronRight, CheckCircle2,
  XCircle, AlertTriangle, GitBranch, Loader as Loader2, LogOut, Shield, Check,
  Clock, RefreshCw, Monitor, Menu, X, LayoutDashboard, ChartBar, FolderGit2,
  Boxes, Users, Sparkles, Settings as SettingsIcon, Server,
  Building2, Bug, Layers, Pin, ChevronsUpDown,
  Workflow, Rocket, Zap, Activity, ClipboardCheck, Scale, FileWarning, ScrollText,
  BookOpen, Plug, FileText, CreditCard, ListFilter, Gauge,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useRouter } from '../lib/router';
import { Logo } from '../lib/ui';
import { usePins, removePin, pinKey, type PinType } from '../lib/pins';
import { getHeadSha } from '../workspace/repoCache';

// Same destinations the desktop sidebar exposes (see SECTIONS in
// pages/AppShell.tsx) — kept in sync by hand so nothing on the web is
// unreachable on mobile. Selecting one renders the real page inside the
// mobile chrome.
// Mirrors AppShell.tsx's NAV_HOME / SECTIONS / NAV_DOCS exactly — same
// labels, routes, icons, and grouping — so the mobile drawer and the
// desktop sidebar are the same IA, not two nav systems that drift apart.
const NAV_HOME = { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard };
const NAV_DOCS = { to: '/docs', label: 'Documentation', icon: BookOpen };
const SECTIONS = [
  { key: 'platform', label: 'Platform', icon: Boxes, items: [
    { to: '/projects', label: 'Projects', icon: FolderGit2 },
    { to: '/runs', label: 'Runs', icon: ListFilter },
    { to: '/workspaces', label: 'Workspaces', icon: Building2 },
    { to: '/stacks', label: 'Stacks', icon: Layers },
  ] },
  { key: 'delivery', label: 'Delivery', icon: Rocket, items: [
    { to: '/pipeline', label: 'Pipelines', icon: Workflow },
    { to: '/deployments', label: 'Deployments', icon: Rocket },
    { to: '/simulator', label: 'Simulator', icon: Zap },
  ] },
  { key: 'ops', label: 'Operations', icon: ChartBar, items: [
    { to: '/analytics', label: 'Analytics', icon: Activity },
    { to: '/findings', label: 'Findings', icon: Bug },
    { to: '/executive', label: 'Executive View', icon: ChartBar },
  ] },
  { key: 'gov', label: 'Governance', icon: ShieldCheck, items: [
    { to: '/change-management', label: 'Change Management', icon: FileText },
    { to: '/approvals', label: 'Approvals', icon: ClipboardCheck },
    { to: '/compliance', label: 'Compliance', icon: Scale },
    { to: '/incidents', label: 'Incidents', icon: FileWarning },
    { to: '/policies', label: 'Policy Studio', icon: ShieldCheck },
    { to: '/audit', label: 'Audit', icon: ScrollText },
  ] },
  { key: 'config', label: 'Configuration', icon: SettingsIcon, items: [
    { to: '/environment', label: 'Environment', icon: Server },
    { to: '/integrations', label: 'Integrations', icon: Plug },
    { to: '/plugins', label: 'Plugins', icon: Boxes },
  ] },
  { key: 'org', label: 'Organization', icon: Users, items: [
    { to: '/organizations', label: 'Organizations', icon: Building2 },
    { to: '/team', label: 'Team', icon: Users },
    { to: '/usage', label: 'Usage', icon: Gauge },
    { to: '/plans', label: 'Plans', icon: CreditCard },
    { to: '/settings', label: 'Settings', icon: SettingsIcon },
  ] },
];
// Flat lookup (all items across every group, plus the two standalone links)
// — used for things like "what's the title of the page currently open",
// where the grouping doesn't matter, just the full route→label mapping.
const ALL_NAV_ITEMS = [NAV_HOME, NAV_DOCS, ...SECTIONS.flatMap((s) => s.items)];
// Pinned items reuse the same type→icon mapping as the desktop sidebar.
const PIN_ICONS: Record<PinType, any> = {
  workspace: Boxes, project: FolderGit2, finding: Bug, stack: Layers, environment: Server,
};

export const TONE = {
  red: { text: 'text-[#dc2626]', bg: 'bg-[#fde3e3]', border: 'border-[#f5a3a3]', dot: 'bg-[#dc2626]' },
  amber: { text: 'text-[#e07600]', bg: 'bg-[#fff0d9]', border: 'border-[#f9c777]', dot: 'bg-[#e07600]' },
  green: { text: 'text-[#12a150]', bg: 'bg-[#e3f7ea]', border: 'border-[#9adcb4]', dot: 'bg-[#12a150]' },
  gray: { text: 'text-gray-500', bg: 'bg-gray-100', border: 'border-[#a1a1aa]', dot: 'bg-gray-400' },
};

function projectStatus(project, validations, findings) {
  const pv = validations.filter((v) => v.project_id === project.id);
  const latest = pv.find((v) => v.status === 'completed') || pv[0] || null;
  const open = findings.filter((f) => f.project_id === project.id && f.status === 'open');
  const crit = open.filter((f) => f.severity === 'critical');
  const high = open.filter((f) => f.severity === 'high');
  const risk = latest?.risk_score;
  const readiness = risk != null ? Math.max(0, 100 - risk) : null;
  let verdict, tone;
  if (!pv.length) { verdict = 'Not assessed'; tone = 'gray'; }
  else if (latest?.status === 'failed' && !crit.length && !high.length) { verdict = 'Assessment failed'; tone = 'gray'; }
  else if (crit.length) { verdict = 'Blocked'; tone = 'red'; }
  else if (high.length) { verdict = 'Review'; tone = 'amber'; }
  else if (latest?.status === 'completed') { verdict = 'Cleared'; tone = 'green'; }
  else { verdict = 'In progress'; tone = 'gray'; }
  return { verdict, tone, readiness, crit, high, open, latest };
}

export function MobileApp({ renderPage }) {
  const { user, profile, signOut } = useAuth();
  const { path, navigate } = useRouter();
  const pins = usePins();
  const [tab, setTab] = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);
  // Which Governance/Platform/etc. group is expanded — same one-at-a-time
  // accordion behavior as the desktop sidebar, auto-opens to whichever
  // group contains the current route.
  const [openSection, setOpenSection] = useState(() => SECTIONS.find((s) => s.items.some((i) => path.startsWith(i.to)))?.key ?? null);
  const [browsing, setBrowsing] = useState(false); // true = showing a real desktop page
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [validations, setValidations] = useState([]);
  const [findings, setFindings] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [selected, setSelected] = useState(null);
  const [stale, setStale] = useState({}); // projectId -> true when HEAD != last assessed commit
  const wid = typeof localStorage !== 'undefined' ? localStorage.getItem('sandbox.activeWs') : null;

  const load = useCallback(async () => {
    if (!wid) { setLoading(false); return; }
    setLoading(true);
    const [pr, vr, fr, ar] = await Promise.all([
      supabase.from('projects').select('*').eq('workspace_id', wid).order('created_at', { ascending: false }),
      supabase.from('validations').select('*').eq('workspace_id', wid).order('created_at', { ascending: false }).limit(80),
      supabase.from('findings').select('*').eq('workspace_id', wid).order('created_at', { ascending: false }),
      supabase.from('release_approvals').select('*').eq('workspace_id', wid).order('created_at', { ascending: false }).limit(20),
    ]);
    setProjects(pr.data ?? []); setValidations(vr.data ?? []); setFindings(fr.data ?? []); setApprovals(ar.data ?? []);
    setLoading(false);
  }, [wid]);

  useEffect(() => { load(); }, [load]);

  // Change alerts: compare each project's HEAD to the commit its last validation ran on.
  useEffect(() => {
    let alive = true;
    (async () => {
      const next = {};
      for (const p of projects) {
        const pv = validations.filter((v) => v.project_id === p.id);
        const last = pv.find((v) => v.status === 'completed') || pv[0];
        if (!last?.commit_sha || !p.git_url) continue;
        try { const head = await getHeadSha(p); if (head && head !== last.commit_sha) next[p.id] = { head, since: last.created_at }; } catch { /* ignore */ }
      }
      if (alive) setStale(next);
    })();
    return () => { alive = false; };
  }, [projects, validations]);

  const approve = async (releaseId, role, decision) => {
    const release = approvals.find((a) => a.id === releaseId);
    if (!release) return;
    const newApproval = { role, approver_name: profile?.full_name || profile?.email || 'Unknown', approver_id: user?.id, approved_at: new Date().toISOString(), comment: '' };
    const updated = decision === 'approve'
      ? [...(release.approvals || []).filter((a) => a.role !== role), newApproval]
      : (release.approvals || []).filter((a) => a.role !== role);
    const allDone = ['platform', 'security', 'product'].every((r) => updated.some((a) => a.role === r));
    await supabase.from('release_approvals').update({ approvals: updated, status: allDone ? 'approved' : decision === 'reject' ? 'rejected' : 'pending' }).eq('id', releaseId);
    await load();
  };

  const statuses = projects.map((p) => ({ p, s: projectStatus(p, validations, findings) }));
  const pendingApprovals = approvals.filter((a) => a.status === 'pending');
  const staleCount = Object.keys(stale).length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* top bar */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-100 h-14 flex items-center justify-between px-3">
        <button onClick={() => setMenuOpen(true)} className="p-2 -ml-1 text-gray-500 active:text-brand-600"><Menu size={20} /></button>
        <Logo size={22} />
        <button onClick={load} className="p-2 -mr-1 text-gray-400 active:text-brand-600"><RefreshCw size={16} /></button>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {loading ? (
          <div className="flex justify-center py-24"><Loader2 size={22} className="animate-spin text-brand-500" /></div>
        ) : !wid ? (
          <div className="px-5 py-24 text-center text-sm text-gray-500">No workspace found. Open LytHouse on desktop to create one.</div>
        ) : (
          <>
            {tab === 'home' && <HomeScreen statuses={statuses} stale={stale} onOpen={(p) => setSelected(p)} name={profile?.full_name || user?.email} />}
            {tab === 'approvals' && <ApprovalsScreen approvals={approvals} onApprove={approve} />}
            {tab === 'alerts' && <AlertsScreen statuses={statuses} stale={stale} onOpen={(p) => setSelected(p)} />}
            {tab === 'account' && <AccountScreen user={user} profile={profile} signOut={signOut} />}
          </>
        )}
      </main>

      {/* project detail overlay */}
      {selected && (
        <ProjectDetail
          project={selected}
          status={projectStatus(selected, validations, findings)}
          stale={stale[selected.id]}
          approvals={approvals.filter((a) => a.project_id === selected.id)}
          onApprove={approve}
          onClose={() => setSelected(null)}
        />
      )}

      {/* full menu drawer — every desktop section */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-72 max-w-[80%] h-full bg-white shadow-2xl flex flex-col animate-fade-in">
            <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100">
              <Logo size={22} />
              <button onClick={() => setMenuOpen(false)} className="p-2 -mr-1 text-gray-400"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {pins.length > 0 && (
                <>
                  <p className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5"><Pin size={11} />Pinned</p>
                  {pins.map((p) => {
                    const Icon = PIN_ICONS[p.type] || FolderGit2;
                    return (
                      <div key={pinKey(p.type, p.id)} className="group flex items-center">
                        <button onClick={() => { navigate(p.to); setBrowsing(true); setMenuOpen(false); }} className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3 text-sm text-navy-800 active:bg-gray-50">
                          <Icon size={17} className="text-brand-500 shrink-0" /><span className="truncate">{p.label}</span>
                        </button>
                        <button onClick={() => removePin(p.type, p.id)} aria-label={`Unpin ${p.label}`} className="px-3 py-3 text-gray-300 active:text-brand-600"><X size={15} /></button>
                      </div>
                    );
                  })}
                  <div className="mx-4 my-2 border-t border-gray-100" />
                </>
              )}
              <button onClick={() => { navigate(NAV_HOME.to); setBrowsing(true); setMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-navy-800 active:bg-gray-50">
                <NAV_HOME.icon size={17} className="text-brand-500" />{NAV_HOME.label}
              </button>
              <div className="mx-4 my-1 border-t border-gray-100" />
              {SECTIONS.map((s) => {
                const isOpen = openSection === s.key;
                const hasActive = s.items.some((i) => path.startsWith(i.to));
                return (
                  <div key={s.key}>
                    <button
                      onClick={() => setOpenSection(isOpen ? null : s.key)}
                      aria-expanded={isOpen}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold active:bg-gray-50 ${hasActive ? 'text-brand-700' : 'text-navy-800'}`}
                    >
                      <s.icon size={17} className={hasActive ? 'text-brand-500' : 'text-gray-400'} />
                      <span className="flex-1 text-left">{s.label}</span>
                      <ChevronRight size={15} className={`text-gray-300 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="pb-1">
                        {s.items.map((m) => {
                          const active = path.startsWith(m.to);
                          return (
                            <button key={m.to} onClick={() => { navigate(m.to); setBrowsing(true); setMenuOpen(false); }}
                              className={`w-full flex items-center gap-3 pl-11 pr-4 py-2.5 text-sm active:bg-gray-50 ${active ? 'text-brand-700 font-medium' : 'text-navy-700'}`}>
                              <m.icon size={15} className={active ? 'text-brand-500' : 'text-gray-400'} />{m.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="mx-4 my-1 border-t border-gray-100" />
              <button onClick={() => { navigate(NAV_DOCS.to); setBrowsing(true); setMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-navy-800 active:bg-gray-50">
                <NAV_DOCS.icon size={17} className="text-gray-400" />{NAV_DOCS.label}
              </button>
            </div>
            <div className="border-t border-gray-100 p-3">
              <button onClick={() => { setBrowsing(false); setMenuOpen(false); setTab('home'); }} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-brand-50 text-brand-700 text-sm font-semibold"><House size={16} />Back to release view</button>
            </div>
          </div>
          <div className="flex-1 bg-black/30" onClick={() => setMenuOpen(false)} />
        </div>
      )}

      {/* browsing a real desktop page inside the mobile chrome */}
      {browsing && (
        <div className="fixed inset-0 z-40 bg-gray-50 flex flex-col">
          <header className="sticky top-0 bg-white border-b border-gray-100 h-14 flex items-center gap-2 px-3 shrink-0">
            <button onClick={() => setBrowsing(false)} className="p-2 -ml-1 text-gray-500 active:text-brand-600"><ChevronLeft size={20} /></button>
            <span className="font-semibold text-navy-900 truncate">{(ALL_NAV_ITEMS.find((m) => path.startsWith(m.to))?.label) || 'Details'}</span>
            <button onClick={() => setMenuOpen(true)} className="ml-auto p-2 -mr-1 text-gray-500"><Menu size={20} /></button>
          </header>
          <div className={`flex-1 overflow-y-auto overflow-x-hidden ${path.startsWith('/projects/') && path.split('/').filter(Boolean).length >= 2 ? '' : 'px-3 py-4'}`}>
            {renderPage ? renderPage(path) : <p className="text-sm text-gray-500">Page unavailable.</p>}
          </div>
        </div>
      )}

      {/* bottom nav — solid brand-purple bar instead of the previous
          white-on-white treatment (bg-white + a near-invisible gray-100
          border blended straight into the page above it). Inactive items
          are dimmed white so they're still readable against the purple;
          the active item gets full-white text plus a soft white pill
          behind its icon, so the bar itself now reads as a distinct,
          unmissable piece of chrome rather than disappearing. */}
      <nav
        className="fixed bottom-0 inset-x-0 z-20 h-16 grid grid-cols-4 pb-[env(safe-area-inset-bottom)]"
        style={{ background: 'linear-gradient(180deg,#8b6ef2,#7c5ce6)', boxShadow: '0 -6px 20px -6px rgba(88,58,168,.55)' }}
      >
        {[
          { id: 'home', label: 'Releases', icon: House },
          { id: 'approvals', label: 'Approvals', icon: ShieldCheck, badge: pendingApprovals.length },
          { id: 'alerts', label: 'Alerts', icon: Bell, badge: staleCount },
          { id: 'account', label: 'Account', icon: User },
        ].map((t) => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => { setTab(t.id); setSelected(null); setBrowsing(false); }} className="relative flex flex-col items-center justify-center gap-1 pt-1.5">
              <span className={`flex items-center justify-center h-8 w-14 rounded-full transition-all ${active ? 'bg-white/25 text-white' : 'text-white/60'}`}><t.icon size={21} strokeWidth={active ? 2.4 : 2} /></span>
              <span className={`text-[10px] font-semibold ${active ? 'text-white' : 'text-white/60'}`}>{t.label}</span>
              {t.badge > 0 && <span className="absolute top-0.5 right-[24%] min-w-4 h-4 px-1 rounded-full bg-[#dc2626] text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-[#7c5ce6]">{t.badge}</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export function StatusPill({ tone, children }) {
  const t = TONE[tone] || TONE.gray;
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${t.bg} ${t.text} border ${t.border} shrink-0`}><span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />{children}</span>;
}

export function HomeScreen({ statuses, stale, onOpen, name }) {
  const counts = statuses.reduce((a, { s }) => { a[s.tone] = (a[s.tone] || 0) + 1; return a; }, {});
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const first = (name || '').split(/[@ ]/)[0];
  return (
    <div className="pb-4">
      {/* glossy gradient hero */}
      <div className="relative overflow-hidden px-5 pt-6 pb-16 text-white" style={{ background: 'linear-gradient(135deg,#6d28d9 0%,#7c3aed 45%,#a78bfa 100%)' }}>
        <div className="absolute -top-16 -right-10 h-56 w-56 rounded-full bg-white/15 blur-2xl" />
        <div className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-black/10 blur-2xl" />
        <p className="relative text-sm text-white/80">{greet}{first ? `, ${first}` : ''}</p>
        <h1 className="relative text-2xl font-bold tracking-tight mt-1">Your releases</h1>
        <p className="relative text-sm text-white/75 mt-1">{statuses.length} project{statuses.length === 1 ? '' : 's'} in this workspace</p>
      </div>

      {/* summary cards floating over the hero */}
      <div className="px-4 -mt-10 relative z-10">
        <div className="grid grid-cols-3 gap-2.5">
          {[{ l: 'Cleared', n: counts.green || 0, tone: 'green' }, { l: 'Review', n: counts.amber || 0, tone: 'amber' }, { l: 'Blocked', n: counts.red || 0, tone: 'red' }].map((x) => (
            <div key={x.l} className="rounded-2xl bg-white shadow-lift border border-gray-100 px-3 py-3 text-center">
              <div className={`text-3xl font-extrabold ${TONE[x.tone].text}`}>{x.n}</div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400 mt-0.5">{x.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* project list */}
      <div className="px-4 mt-5 space-y-3">
        <p className="text-sm font-bold text-navy-900 px-1">Projects</p>
        {statuses.length === 0 ? (
          <div className="text-center py-16 text-sm text-gray-500">No projects yet. Add one from the menu to see it here.</div>
        ) : statuses.map(({ p, s }) => {
          const t = TONE[s.tone];
          return (
            <button key={p.id} onClick={() => onOpen(p)} className="w-full text-left rounded-2xl border border-gray-100 bg-white p-4 shadow-soft active:scale-[0.99] transition-transform">
              <div className="flex items-center justify-between gap-2">
                <span className="text-base font-bold text-navy-900 truncate">{p.name}</span>
                <StatusPill tone={s.tone}>{s.verdict}</StatusPill>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                <span className="inline-flex items-center gap-1"><GitBranch size={12} />{p.git_branch || 'main'}</span>
                {s.readiness != null && <span>Readiness <span className="font-bold text-navy-800">{s.readiness}%</span></span>}
                {s.crit.length + s.high.length > 0 && <span className="text-[#dc2626] font-semibold">{s.crit.length + s.high.length} to fix</span>}
                {stale[p.id] && <span className="inline-flex items-center gap-1 text-[#e07600] font-semibold"><Bell size={11} />new changes</span>}
              </div>
              {s.readiness != null && (
                <div className="mt-2.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${s.readiness}%`, background: s.tone === 'red' ? '#dc2626' : s.tone === 'amber' ? '#e07600' : '#12a150' }} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ProjectDetail({ project, status: s, stale, approvals, onApprove, onClose }) {
  const t = TONE[s.tone];
  const blockers = [...s.crit, ...s.high];
  const release = approvals.find((a) => a.status === 'pending') || approvals[0];
  return (
    <div className="fixed inset-0 z-40 bg-gray-50 flex flex-col animate-fade-in">
      <header className="sticky top-0 bg-white border-b border-gray-100 h-14 flex items-center gap-2 px-3 shrink-0">
        <button onClick={onClose} className="p-2 -ml-1 text-gray-500 active:text-brand-600"><ChevronLeft size={20} /></button>
        <span className="font-semibold text-navy-900 truncate">{project.name}</span>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {stale && (
          <div className="rounded-xl border border-[#f9c777] bg-[#fff7e9] px-3 py-2.5">
            <p className="text-sm font-semibold text-[#8a5a00] flex items-center gap-1.5"><AlertTriangle size={14} />New changes since last assessment</p>
            <p className="text-xs text-gray-600 mt-0.5">This decision may be out of date. Re-assess on desktop to refresh it.</p>
          </div>
        )}

        {/* decision */}
        <div className={`rounded-3xl border ${t.border} ${t.bg} p-5 shadow-soft`}>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Release Decision</p>
          <div className={`text-3xl font-extrabold ${t.text} mt-1 tracking-tight`}>{s.verdict}</div>
          <div className="grid grid-cols-3 gap-2.5 mt-4">
            {[
              { l: 'Readiness', v: s.readiness != null ? `${s.readiness}%` : '—' },
              { l: 'Blockers', v: String(s.crit.length) },
              { l: 'To review', v: String(s.high.length) },
            ].map((x) => (
              <div key={x.l} className="rounded-2xl bg-white/80 px-2 py-2.5 text-center shadow-sm">
                <div className="text-xl font-extrabold text-navy-900">{x.v}</div>
                <div className="text-[10px] uppercase tracking-wide text-gray-500 mt-0.5">{x.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* why blocked */}
        {blockers.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-navy-900 mb-2">Why it needs attention</p>
            <div className="space-y-2">
              {blockers.map((f) => (
                <div key={f.id} className="rounded-xl border border-[#a1a1aa] bg-white p-3">
                  <div className="flex items-center gap-2">
                    <StatusPill tone={f.severity === 'critical' ? 'red' : 'amber'}>{f.severity === 'critical' ? 'Blocker' : 'Review'}</StatusPill>
                    <span className="text-sm font-semibold text-navy-900 truncate">{f.title}</span>
                  </div>
                  {f.file_path && <p className="text-[11px] text-gray-400 mt-1 font-mono truncate">{f.file_path}{f.line ? `:${f.line}` : ''}</p>}
                  {(f.recommendation || f.description) && <p className="text-xs text-gray-600 mt-1.5"><span className="font-semibold text-[#0f7a3c]">Fix: </span>{f.recommendation || f.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {blockers.length === 0 && s.verdict === 'Cleared' && (
          <div className="rounded-xl border border-[#9adcb4] bg-[#e3f7ea] p-4 flex items-center gap-2 text-sm text-[#0f7a3c]"><CheckCircle2 size={16} />No blockers — this release is cleared.</div>
        )}

        {/* approvals */}
        {release && (
          <div>
            <p className="text-sm font-semibold text-navy-900 mb-2">Approvals</p>
            <ApprovalCard release={release} onApprove={onApprove} />
          </div>
        )}

        <p className="text-[11px] text-gray-400 text-center pt-2">Editing files, remediation PRs and deep settings are available in the desktop app.</p>
      </div>
    </div>
  );
}

const ROLES = [
  { id: 'platform', label: 'Platform Engineering' },
  { id: 'security', label: 'Security Team' },
  { id: 'product', label: 'Product Management' },
];

export function ApprovalCard({ release, onApprove }) {
  const approvedRoles = new Set((release.approvals || []).map((a) => a.role));
  const allApproved = ROLES.every((r) => approvedRoles.has(r.id));
  return (
    <div className={`rounded-2xl border p-3 ${allApproved ? 'border-[#9adcb4] bg-[#e3f7ea]' : 'border-[#a1a1aa] bg-white'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-navy-900 truncate">{release.release_name}</span>
        <StatusPill tone={allApproved ? 'green' : release.status === 'rejected' ? 'red' : 'amber'}>{allApproved ? 'Approved' : release.status === 'rejected' ? 'Rejected' : 'Pending'}</StatusPill>
      </div>
      <div className="space-y-1.5">
        {ROLES.map((role) => {
          const a = (release.approvals || []).find((x) => x.role === role.id);
          return (
            <div key={role.id} className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-navy-900">{role.label}</p>
                {a ? <p className="text-[11px] text-[#12a150]">Approved by {a.approver_name}</p> : <p className="text-[11px] text-gray-400">Awaiting sign-off</p>}
              </div>
              {a ? <CheckCircle2 size={20} className="text-[#12a150] shrink-0" /> : (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => onApprove(release.id, role.id, 'approve')} className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-semibold active:bg-brand-700 flex items-center gap-1"><Check size={12} />Approve</button>
                  <button onClick={() => onApprove(release.id, role.id, 'reject')} className="px-2.5 py-1.5 rounded-lg border border-[#f5a3a3] text-[#dc2626] text-xs active:bg-[#fde3e3]"><XCircle size={13} /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ApprovalsScreen({ approvals, onApprove }) {
  const pending = approvals.filter((a) => a.status === 'pending');
  const done = approvals.filter((a) => a.status !== 'pending');
  return (
    <div className="px-4 py-4 space-y-4">
      <div>
        <h1 className="text-lg font-bold text-navy-900">Approvals</h1>
        <p className="text-xs text-gray-500 mt-0.5">Sign off releases before they ship.</p>
      </div>
      {approvals.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-500">No approval requests yet.</div>
      ) : (
        <>
          {pending.length > 0 && <div className="space-y-3">{pending.map((r) => <ApprovalCard key={r.id} release={r} onApprove={onApprove} />)}</div>}
          {done.length > 0 && (
            <div className="space-y-3 pt-2">
              <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Recently decided</p>
              {done.map((r) => <ApprovalCard key={r.id} release={r} onApprove={onApprove} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function AlertsScreen({ statuses, stale, onOpen }) {
  const staleList = statuses.filter(({ p }) => stale[p.id]);
  return (
    <div className="px-4 py-4 space-y-4">
      <div>
        <h1 className="text-lg font-bold text-navy-900">Change alerts</h1>
        <p className="text-xs text-gray-500 mt-0.5">Projects with new commits since their last assessment.</p>
      </div>
      {staleList.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-500 flex flex-col items-center gap-2"><CheckCircle2 size={28} className="text-[#12a150]" />Everything is up to date. No new changes to review.</div>
      ) : (
        <div className="space-y-2.5">
          {staleList.map(({ p, s }) => (
            <button key={p.id} onClick={() => onOpen(p)} className="w-full text-left rounded-2xl border border-[#f9c777] bg-[#fff7e9] p-4 active:opacity-90">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-navy-900 truncate">{p.name}</span>
                <StatusPill tone="amber">Changes</StatusPill>
              </div>
              <p className="text-xs text-gray-600 mt-1 flex items-center gap-1"><Clock size={11} />New commits since the last assessment — the decision may be out of date.</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AccountScreen({ user, profile, signOut }) {
  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="text-lg font-bold text-navy-900">Account</h1>
      <div className="rounded-2xl border border-[#a1a1aa] bg-white p-4 flex items-center gap-3">
        <div className="h-11 w-11 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center overflow-hidden">
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-11 w-11 object-cover" /> : (profile?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-navy-900 truncate">{profile?.full_name || 'My Account'}</p>
          <p className="text-xs text-gray-500 truncate">{user?.email || ''}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-[#a1a1aa] bg-white p-4 flex items-start gap-3">
        <Monitor size={18} className="text-brand-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-navy-900">Full app on desktop</p>
          <p className="text-xs text-gray-500 mt-0.5">File editing, auto-remediation pull requests, policy studio, integrations and detailed settings live in the desktop experience. This mobile app covers checking status, approvals and alerts.</p>
        </div>
      </div>
      <button onClick={() => signOut()} className="w-full rounded-xl border border-[#a1a1aa] bg-white py-3 text-sm font-semibold text-[#dc2626] flex items-center justify-center gap-2 active:bg-gray-50"><LogOut size={15} />Sign out</button>
    </div>
  );
}

export default MobileApp;
