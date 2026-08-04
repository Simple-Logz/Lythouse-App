import { useState } from 'react';
import {
  supabase,
  type ConnectionMethod,
  type PlanId,
  type ServerTarget,
  type DiscoveredComponent,
  type ApplicationGroup,
  type DiscoveryJob,
  type CollectionPolicy,
  CONNECTION_METHODS,
  COLLECTION_DEFAULT_CATEGORIES,
  COLLECTION_OPTIONAL_CATEGORIES,
  COLLECTION_NEVER_CATEGORIES,
} from '../../lib/supabase';
import { Spinner } from '../../lib/ui';
import { Lock, Plus, Trash2, Server, Wifi, KeyRound, Check, X, Loader as Loader2, Search, Boxes, Upload, Download, Terminal, ShieldCheck, TriangleAlert as AlertTriangle } from 'lucide-react';

// ─── Step 1: Environment Details ───
export function StepDetails({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="label">Environment Name *</label>
        <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Production Web Cluster" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Business Unit</label>
          <input className="input" value={form.business_unit ?? ''} onChange={e => setForm({ ...form, business_unit: e.target.value })} placeholder="e.g. Platform Engineering" />
        </div>
        <div>
          <label className="label">Owner</label>
          <input className="input" value={form.owner ?? ''} onChange={e => setForm({ ...form, owner: e.target.value })} placeholder="e.g. Jane Smith" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Environment Type *</label>
          <select className="input" value={form.environment_type} onChange={e => setForm({ ...form, environment_type: e.target.value })}>
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="development">Development</option>
            <option value="test">Test</option>
          </select>
        </div>
        <div>
          <label className="label">Location</label>
          <input className="input" value={form.location ?? ''} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. us-east-1 / on-prem DC2" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Expected Server Count</label>
          <input type="number" className="input" value={form.expected_server_count ?? 0} onChange={e => setForm({ ...form, expected_server_count: parseInt(e.target.value) || 0 })} />
        </div>
        <div>
          <label className="label">Primary Purpose</label>
          <input className="input" value={form.primary_purpose ?? ''} onChange={e => setForm({ ...form, primary_purpose: e.target.value })} placeholder="e.g. Customer-facing web apps" />
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Connection Method ───
export function StepConnectionMethod({ form, setForm, planId }: { form: any; setForm: (f: any) => void; planId: PlanId }) {
  const icons: Record<ConnectionMethod, typeof Server> = { agent: Server, ssh: Terminal, winrm: Server, collector: Boxes, offline: Upload };
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">Choose how Sandbox.ai will connect to your servers. Some methods require a paid plan.</p>
      {CONNECTION_METHODS.map(m => {
        const Icon = icons[m.id];
        const allowed = m.plans.includes(planId);
        const selected = form.method === m.id;
        return (
          <button key={m.id} onClick={() => allowed && setForm({ ...form, method: m.id })}
            className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-all ${selected ? 'border-brand-500 bg-brand-50' : allowed ? 'border-[#a1a1aa] hover:border-gray-300' : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'}`}>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
              <Icon size={18} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-navy-900">{m.label}</h4>
                {!allowed && <Lock size={12} className="text-gray-400" />}
              </div>
              <p className="mt-0.5 text-sm text-gray-500">{m.description}</p>
              <div className="mt-1.5 flex gap-1">
                {m.plans.map(p => <span key={p} className={`chip text-[10px] ${p === planId ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'bg-gray-100 text-gray-400'}`}>{p}</span>)}
              </div>
            </div>
            {selected && <Check size={18} className="text-brand-600" />}
          </button>
        );
      })}
    </div>
  );
}

// ─── Step 3: Credentials ───
export function StepCredentials({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  const m = form.method as ConnectionMethod;
  if (m === 'agent') return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Install a lightweight agent on each server. The enrollment token authorizes outbound HTTPS collection.</p>
      <div>
        <label className="label">Enrollment Token</label>
        <input className="input font-mono" value={form.cred_token ?? ''} onChange={e => setForm({ ...form, cred_token: e.target.value })} placeholder="Paste enrollment token…" />
      </div>
      <div>
        <label className="label">Install Command</label>
        <pre className="rounded-lg bg-gray-900 p-3 text-xs text-green-400 overflow-x-auto">curl -fsSL https://sandbox.ai/install | sh -s -- --token {form.cred_token ? '***' : '<token>'}</pre>
      </div>
    </div>
  );
  if (m === 'ssh') return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="label">SSH Host / Bastion</label>
          <input className="input" value={form.cred_host ?? ''} onChange={e => setForm({ ...form, cred_host: e.target.value })} placeholder="bastion.example.com" />
        </div>
        <div>
          <label className="label">Port</label>
          <input type="number" className="input" value={form.cred_port ?? 22} onChange={e => setForm({ ...form, cred_port: parseInt(e.target.value) || 22 })} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">SSH User</label>
          <input className="input" value={form.cred_user ?? ''} onChange={e => setForm({ ...form, cred_user: e.target.value })} placeholder="readonly" />
        </div>
        <div>
          <label className="label">Auth Type</label>
          <select className="input" value={form.cred_auth_type ?? 'key'} onChange={e => setForm({ ...form, cred_auth_type: e.target.value })}>
            <option value="key">SSH Key</option>
            <option value="password">Password</option>
          </select>
        </div>
      </div>
      {form.cred_auth_type === 'key' ? (
        <div>
          <label className="label">Private Key (PEM)</label>
          <textarea className="input font-mono text-xs" rows={4} value={form.cred_key ?? ''} onChange={e => setForm({ ...form, cred_key: e.target.value })} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" />
        </div>
      ) : (
        <div>
          <label className="label">Password</label>
          <input type="password" className="input" value={form.cred_password ?? ''} onChange={e => setForm({ ...form, cred_password: e.target.value })} />
        </div>
      )}
    </div>
  );
  if (m === 'winrm') return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="label">WinRM Host</label>
          <input className="input" value={form.cred_host ?? ''} onChange={e => setForm({ ...form, cred_host: e.target.value })} placeholder="win-server.example.com" />
        </div>
        <div>
          <label className="label">Port (HTTPS)</label>
          <input type="number" className="input" value={form.cred_port ?? 5986} onChange={e => setForm({ ...form, cred_port: parseInt(e.target.value) || 5986 })} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Username</label>
          <input className="input" value={form.cred_user ?? ''} onChange={e => setForm({ ...form, cred_user: e.target.value })} placeholder="DOMAIN\\readonly" />
        </div>
        <div>
          <label className="label">Password</label>
          <input type="password" className="input" value={form.cred_password ?? ''} onChange={e => setForm({ ...form, cred_password: e.target.value })} />
        </div>
      </div>
    </div>
  );
  if (m === 'collector') return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Deploy a collector inside your network. Download the binary and register it with the token below.</p>
      <div>
        <label className="label">Collector Enrollment Token</label>
        <input className="input font-mono" value={form.cred_token ?? ''} onChange={e => setForm({ ...form, cred_token: e.target.value })} placeholder="Paste collector token…" />
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 p-3">
        <Download size={16} className="text-blue-600" />
        <span className="text-sm text-blue-700">Download collector binary for your platform</span>
      </div>
    </div>
  );
  // offline
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Upload a pre-collected, redacted snapshot bundle from an air-gapped environment.</p>
      <div className="rounded-xl border-2 border-dashed border-[#a1a1aa] p-8 text-center">
        <Upload size={28} className="mx-auto text-gray-400" />
        <p className="mt-2 text-sm font-medium text-navy-900">Drop snapshot bundle here</p>
        <p className="text-xs text-gray-400">Signed .tar.gz or .zip, max 500MB</p>
        <button className="btn-secondary mt-3"><Upload size={14} /> Choose file</button>
      </div>
    </div>
  );
}

// ─── Step 4: Server Targets ───
export function StepTargets({ targets, setTargets }: { targets: Partial<ServerTarget>[]; setTargets: (t: Partial<ServerTarget>[]) => void }) {
  const add = () => setTargets([...targets, { hostname: '', ip: '', os_platform: 'linux', server_role: '', port_override: null }]);
  const remove = (i: number) => setTargets(targets.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof ServerTarget, val: any) => setTargets(targets.map((t, idx) => idx === i ? { ...t, [field]: val } : t));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Add the servers you want to discover and validate.</p>
        <button onClick={add} className="btn-secondary"><Plus size={14} /> Add Server</button>
      </div>
      {targets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#a1a1aa] py-10 text-center">
          <Server size={24} className="mx-auto text-gray-300" />
          <p className="mt-2 text-sm text-gray-400">No servers added yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {targets.map((t, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-gray-100 p-3">
              <div className="grid flex-1 gap-2 sm:grid-cols-5">
                <input className="input" placeholder="Hostname *" value={t.hostname ?? ''} onChange={e => update(i, 'hostname', e.target.value)} />
                <input className="input" placeholder="IP" value={t.ip ?? ''} onChange={e => update(i, 'ip', e.target.value)} />
                <select className="input" value={t.os_platform ?? 'linux'} onChange={e => update(i, 'os_platform', e.target.value)}>
                  <option value="linux">Linux</option>
                  <option value="windows">Windows</option>
                  <option value="macos">macOS</option>
                  <option value="aix">AIX</option>
                  <option value="solaris">Solaris</option>
                </select>
                <input className="input" placeholder="Role" value={t.server_role ?? ''} onChange={e => update(i, 'server_role', e.target.value)} />
                <input type="number" className="input" placeholder="Port" value={t.port_override ?? ''} onChange={e => update(i, 'port_override', e.target.value ? parseInt(e.target.value) : null)} />
              </div>
              <button onClick={() => remove(i)} className="btn-ghost p-2 text-gray-400 hover:text-danger-600"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Step 5: Collection Policy ───
export function StepCollectionPolicy({ policy, setPolicy }: { policy: { default_categories: string[]; optional_categories: string[]; never_categories: string[] }; setPolicy: (p: any) => void }) {
  const toggle = (cat: string, field: 'default_categories' | 'optional_categories' | 'never_categories') => {
    const arr = policy[field];
    setPolicy({ ...policy, [field]: arr.includes(cat) ? arr.filter(c => c !== cat) : [...arr, cat] });
  };
  const Col = ({ title, items, field, color }: { title: string; items: string[]; field: 'default_categories' | 'optional_categories' | 'never_categories'; color: string }) => (
    <div>
      <h4 className={`mb-2 text-xs font-semibold uppercase tracking-wide ${color}`}>{title}</h4>
      <div className="space-y-1.5">
        {items.map(c => {
          const checked = policy[field].includes(c);
          return (
            <button key={c} onClick={() => toggle(c, field)} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all ${checked ? 'border-brand-300 bg-brand-50' : 'border-gray-100 hover:border-[#a1a1aa]'}`}>
              <div className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? 'border-brand-500 bg-brand-500 text-white' : 'border-gray-300'}`}>
                {checked && <Check size={10} strokeWidth={3} />}
              </div>
              <span className="text-gray-700">{c}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Define what metadata Sandbox.ai is allowed to collect from your servers.</p>
      <div className="grid gap-6 sm:grid-cols-3">
        <Col title="Default (Always)" items={COLLECTION_DEFAULT_CATEGORIES as unknown as string[]} field="default_categories" color="text-brand-600" />
        <Col title="Optional (On-demand)" items={COLLECTION_OPTIONAL_CATEGORIES as unknown as string[]} field="optional_categories" color="text-blue-600" />
        <Col title="Never" items={COLLECTION_NEVER_CATEGORIES as unknown as string[]} field="never_categories" color="text-danger-600" />
      </div>
    </div>
  );
}

// ─── Step 6: Connectivity Pre-check ───
type CheckResult = { dns: string; network: string; auth: string; os: string; permissions: string; agent: string };
export function StepPreCheck({ targets, results, checking }: { targets: Partial<ServerTarget>[]; results: Record<number, CheckResult>; checking: boolean }) {
  const checkIcon = (status: string) => {
    if (status === 'pass') return <Check size={14} className="text-brand-600" />;
    if (status === 'fail') return <X size={14} className="text-danger-600" />;
    if (status === 'running') return <Spinner size={14} />;
    return <div className="h-3 w-3 rounded-full border border-[#a1a1aa]" />;
  };
  const cols = ['DNS', 'Network', 'Auth', 'OS', 'Perms', 'Agent'] as const;
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">Verify connectivity and permissions before starting discovery.</p>
      {checking && <div className="flex items-center gap-2 text-sm text-brand-600"><Spinner size={14} /> Running pre-checks…</div>}
      {targets.length === 0 ? (
        <p className="text-sm text-gray-400">No server targets to check. Add targets in step 4.</p>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <div className="grid grid-cols-7 gap-2 border-b border-gray-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <div className="col-span-1">Hostname</div>
            {cols.map(c => <div key={c} className="col-span-1 text-center">{c}</div>)}
          </div>
          {targets.map((t, i) => {
            const r = results[i];
            return (
              <div key={i} className="grid grid-cols-7 gap-2 border-b border-gray-50 px-4 py-3 items-center">
                <div className="col-span-1 truncate text-sm font-medium text-navy-900">{t.hostname || `Server ${i + 1}`}</div>
                {(['dns', 'network', 'auth', 'os', 'permissions', 'agent'] as const).map(k => (
                  <div key={k} className="col-span-1 flex justify-center">{r ? checkIcon(r[k]) : <div className="h-3 w-3 rounded-full border border-[#a1a1aa]" />}</div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Step 7: Discover & Review ───
export function StepDiscover({ envId, components, appGroups, discoveryRunning, onDiscover, onConfirmGroup }: {
  envId: string | null;
  components: DiscoveredComponent[];
  appGroups: ApplicationGroup[];
  discoveryRunning: boolean;
  onDiscover: () => void;
  onConfirmGroup: (id: string, confirmed: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Run discovery to detect components and infer application groups using AI.</p>
      <button onClick={onDiscover} disabled={discoveryRunning || !envId} className="btn-primary">
        {discoveryRunning ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        {discoveryRunning ? 'Discovering…' : components.length > 0 ? 'Re-run Discovery' : 'Start Discovery'}
      </button>

      {components.length > 0 && (
        <>
          <div className="card">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy-900"><Boxes size={15} /> Discovered Components ({components.length})</h4>
            <div className="flex flex-wrap gap-1.5">
              {components.map(c => (
                <span key={c.id} className="chip bg-gray-50 text-gray-600 border border-[#a1a1aa]">
                  <span className="text-[10px] uppercase text-gray-400">{c.component_type}</span> {c.name}
                </span>
              ))}
            </div>
          </div>

          <div className="card">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy-900"><ShieldCheck size={15} /> AI-Inferred Application Groups ({appGroups.length})</h4>
            <p className="mb-3 text-xs text-gray-400">Confirm or edit each group before generating the blueprint.</p>
            <div className="space-y-2">
              {appGroups.map(g => (
                <div key={g.id} className="flex items-start justify-between rounded-lg border border-gray-100 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h5 className="text-sm font-semibold text-navy-900">{g.name}</h5>
                      <span className="chip bg-blue-50 text-blue-600 border border-blue-200">{Math.round(g.ai_confidence)}% AI</span>
                      {g.human_confirmed && <span className="chip bg-brand-50 text-brand-700 border border-brand-200">Confirmed</span>}
                    </div>
                    {g.business_context && <p className="mt-1 text-xs text-gray-500">{g.business_context}</p>}
                    <p className="mt-1 text-xs text-gray-400">{g.component_ids.length} components</p>
                  </div>
                  <button onClick={() => onConfirmGroup(g.id, !g.human_confirmed)} className={`btn-secondary shrink-0 ${g.human_confirmed ? 'text-brand-600' : ''}`}>
                    {g.human_confirmed ? <><Check size={13} /> Confirmed</> : 'Confirm'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Step 8: Generate Blueprint ───
export function StepBlueprint({ form, targets, components, appGroups, generating, onGenerate }: {
  form: any; targets: Partial<ServerTarget>[]; components: DiscoveredComponent[]; appGroups: ApplicationGroup[]; generating: boolean; onGenerate: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Review the summary and generate the environment blueprint.</p>
      <div className="card">
        <h4 className="mb-3 text-sm font-semibold text-navy-900">Blueprint Summary</h4>
        <dl className="space-y-2">
          <div className="flex justify-between"><dt className="text-sm text-gray-400">Environment</dt><dd className="text-sm font-medium text-navy-900">{form.name || 'Untitled'}</dd></div>
          <div className="flex justify-between"><dt className="text-sm text-gray-400">Type</dt><dd className="text-sm capitalize text-navy-900">{form.environment_type}</dd></div>
          <div className="flex justify-between"><dt className="text-sm text-gray-400">Connection</dt><dd className="text-sm capitalize text-navy-900">{form.method}</dd></div>
          <div className="flex justify-between"><dt className="text-sm text-gray-400">Server Targets</dt><dd className="text-sm tabular-nums text-navy-900">{targets.length}</dd></div>
          <div className="flex justify-between"><dt className="text-sm text-gray-400">Discovered Components</dt><dd className="text-sm tabular-nums text-navy-900">{components.length}</dd></div>
          <div className="flex justify-between"><dt className="text-sm text-gray-400">Application Groups</dt><dd className="text-sm tabular-nums text-navy-900">{appGroups.length}</dd></div>
          <div className="flex justify-between"><dt className="text-sm text-gray-400">Confirmed Groups</dt><dd className="text-sm tabular-nums text-navy-900">{appGroups.filter(g => g.human_confirmed).length}</dd></div>
        </dl>
      </div>
      <button onClick={onGenerate} disabled={generating || components.length === 0} className="btn-primary">
        {generating ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
        {generating ? 'Generating Blueprint…' : 'Generate Blueprint'}
      </button>
      {components.length === 0 && <p className="text-sm text-amber-600 flex items-center gap-1"><AlertTriangle size={13} /> Run discovery first to detect components.</p>}
    </div>
  );
}
