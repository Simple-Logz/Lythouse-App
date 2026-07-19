// @ts-nocheck
// TEMPORARY design-preview harness for the mobile UI (rendered at /__mpreview,
// no auth) so the mobile screens can be viewed and refined without a login.
import { useState } from 'react';
import { House, ShieldCheck, Bell, User, Menu, RefreshCw } from 'lucide-react';
import { Logo } from '../lib/ui';
import { HomeScreen, ProjectDetail } from './MobileApp';

const arr = (n) => Array.from({ length: n }, (_, i) => ({ id: i }));
const STATUSES = [
  { p: { id: '1', name: 'LytHouse-App', git_branch: 'main' }, s: { verdict: 'Blocked', tone: 'red', readiness: 53, crit: arr(1), high: arr(2), open: arr(3), latest: {} } },
  { p: { id: '2', name: 'payments-service', git_branch: 'main' }, s: { verdict: 'Review', tone: 'amber', readiness: 78, crit: [], high: arr(2), open: arr(2), latest: {} } },
  { p: { id: '3', name: 'marketing-site', git_branch: 'release' }, s: { verdict: 'Cleared', tone: 'green', readiness: 94, crit: [], high: [], open: [], latest: {} } },
  { p: { id: '4', name: 'internal-tools', git_branch: 'main' }, s: { verdict: 'Not assessed', tone: 'gray', readiness: null, crit: [], high: [], open: [], latest: {} } },
];
const DETAIL = {
  project: { id: '1', name: 'LytHouse-App', git_branch: 'main' },
  status: { verdict: 'Blocked', tone: 'red', readiness: 53, crit: [{ id: 'c1', severity: 'critical', title: 'Secrets in source control', file_path: '.env', line: null, recommendation: 'Remove the committed .env and rotate the exposed keys.' }], high: [{ id: 'h1', severity: 'high', title: 'Containers run as root', file_path: 'Dockerfile', line: 3, recommendation: 'Add a non-root USER to the image.' }], open: arr(2), latest: {} },
  stale: { head: 'abc', since: new Date().toISOString() },
  approvals: [{ id: 'r1', release_name: 'LytHouse-App — 7/19/2026', status: 'pending', approvals: [{ role: 'platform', approver_name: 'Mercy' }] }],
};

export function MobilePreview() {
  const [view, setView] = useState('home');
  const [detail, setDetail] = useState(false);
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="sticky top-0 z-20 bg-white border-b border-gray-100 h-14 flex items-center justify-between px-3">
        <button className="p-2 -ml-1 text-gray-500"><Menu size={20} /></button>
        <Logo size={22} />
        <button className="p-2 -mr-1 text-gray-400"><RefreshCw size={16} /></button>
      </header>
      <main className="flex-1 overflow-y-auto pb-20">
        <HomeScreen statuses={STATUSES} stale={{ '1': { head: 'x' } }} onOpen={() => setDetail(true)} name="Mercy" />
      </main>
      {detail && <ProjectDetail project={DETAIL.project} status={DETAIL.status} stale={DETAIL.stale} approvals={DETAIL.approvals} onApprove={() => {}} onClose={() => setDetail(false)} />}
      <nav className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-gray-100 h-16 grid grid-cols-4">
        {[{ id: 'home', label: 'Releases', icon: House }, { id: 'approvals', label: 'Approvals', icon: ShieldCheck, badge: 1 }, { id: 'alerts', label: 'Alerts', icon: Bell, badge: 1 }, { id: 'account', label: 'Account', icon: User }].map((t) => {
          const active = view === t.id;
          return (
            <button key={t.id} onClick={() => setView(t.id)} className="relative flex flex-col items-center justify-center gap-1 pt-1.5">
              <span className={`flex items-center justify-center h-8 w-14 rounded-full transition-all ${active ? 'bg-brand-100 text-brand-700' : 'text-gray-400'}`}><t.icon size={21} strokeWidth={active ? 2.4 : 2} /></span>
              <span className={`text-[10px] font-semibold ${active ? 'text-brand-700' : 'text-gray-400'}`}>{t.label}</span>
              {t.badge > 0 && <span className="absolute top-0.5 right-[24%] min-w-4 h-4 px-1 rounded-full bg-[#dc2626] text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">{t.badge}</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
export default MobilePreview;
