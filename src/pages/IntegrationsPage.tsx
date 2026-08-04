// @ts-nocheck
import { useState } from 'react';
import { PageHeader } from '../lib/ui';
import { Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import { PROVIDERS, getCfg, saveOne, removeOne, isConnected } from '../lib/integrations';

// Integrations hub — connect ticketing / collaboration platforms once.
export function IntegrationsPage() {
  const [open, setOpen] = useState(null);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);

  const connectedCount = PROVIDERS.filter((p) => isConnected(p.id)).length;

  return (
    <div>
      <PageHeader title="Integrations" description="Connect your ticketing and collaboration tools once. Then create and assign tickets from any finding — no re-entering credentials." />

      <div className="mb-5 flex items-center gap-2 text-sm text-gray-500">
        <span className="chip bg-brand-50 text-brand-700 border border-brand-200">{connectedCount} connected</span>
        <span>·</span>
        <span>{PROVIDERS.length} available</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PROVIDERS.map((p) => {
          const connected = isConnected(p.id);
          const isOpen = open === p.id;
          const cfg = getCfg(p.id);
          return (
            <div key={p.id} className={`card transition-all ${isOpen ? 'ring-1 ring-brand-200' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-50 border border-gray-100"><p.Logo s={24} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-navy-900">{p.name}</h3>
                    {connected
                      ? <span className="chip text-[10px] bg-[#e3f7ea] text-[#0f9a4c] border border-[#9adcb4]"><Check size={10} />Connected</span>
                      : <span className="chip text-[10px] bg-gray-100 text-gray-500 border border-[#18181b]">Not connected</span>}
                    {!p.oneClick && <span className="chip text-[10px] bg-gray-100 text-gray-500 border border-[#18181b]">beta</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-snug">{p.blurb}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button onClick={() => setOpen(isOpen ? null : p.id)} className="btn-secondary text-xs">
                  {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}{connected ? 'Manage' : 'Connect'}
                </button>
                {connected && <button onClick={() => { removeOne(p.id); rerender(); }} className="btn-ghost text-xs text-[#d61f1f]">Disconnect</button>}
              </div>

              {isOpen && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                  {p.fields.map((f) => (
                    <div key={f.k}>
                      <label className="text-[11px] font-medium text-gray-600">{f.label}{f.optional ? ' (optional)' : ''}</label>
                      <input type={f.type || 'text'} className="input !py-1.5 text-xs" placeholder={f.ph || ''} defaultValue={cfg[f.k] || ''}
                        onChange={(e) => { const next = { ...getCfg(p.id), [f.k]: e.target.value }; saveOne(p.id, next); }} />
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-gray-400">Saved automatically in this browser.</span>
                    <button onClick={() => { setOpen(null); rerender(); }} className="btn-primary text-xs">Done</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-gray-400 mt-5 max-w-2xl">Credentials are saved unencrypted in this browser's local storage (not synced to your account or other devices) and are sent only to the tool you’re creating a ticket in, via LytHouse’s server-side connector. Encrypted, account-level storage for these tokens is on the roadmap — for now, avoid using credentials here you wouldn't want readable by anything else running on this device. Tools marked “beta” save your connection now; one-click creation for them is rolling out.</p>
    </div>
  );
}

export default IntegrationsPage;
