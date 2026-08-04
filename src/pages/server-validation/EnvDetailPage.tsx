import { useEffect, useState } from 'react';
import {
  supabase,
  type ServerEnvironment,
  type ServerTarget,
  type EnvironmentBlueprint,
  type ValidationRun,
  type ApplicationGroup,
  type CollectionPolicy,
  type ConnectionProfile,
  type ProposedChange,
  type PlanId,
  type Verdict,
} from '../../lib/supabase';
import { PageHeader, Spinner, EmptyState, Breadcrumb, StatusBadge, SeverityBadge, timeAgo } from '../../lib/ui';
import { useRouter } from '../../lib/router';
import { Server, Boxes, FileCheck, CirclePlay as PlayCircle, Plus, ArrowLeft, Lock, Network, Settings2, ShieldCheck, ChevronRight, Loader as Loader2, X } from 'lucide-react';

type TabId = 'overview' | 'targets' | 'blueprints' | 'runs' | 'submit';

const TABS: { id: TabId; label: string; icon: typeof Server }[] = [
  { id: 'overview', label: 'Overview', icon: Settings2 },
  { id: 'targets', label: 'Server Targets', icon: Server },
  { id: 'blueprints', label: 'Blueprints', icon: Boxes },
  { id: 'runs', label: 'Validation Runs', icon: PlayCircle },
  { id: 'submit', label: 'Submit Validation', icon: ShieldCheck },
];

function VerdictChip({ verdict }: { verdict: Verdict | null }) {
  if (!verdict) return <span className="text-xs text-gray-400">—</span>;
  const m: Record<string, string> = {
    approved: 'bg-brand-50 text-brand-700 border border-brand-200',
    conditionally_approved: 'bg-blue-50 text-blue-600 border border-blue-200',
    rejected: 'bg-red-50 text-danger-600 border border-red-200',
    inconclusive: 'bg-gray-100 text-gray-500 border border-[#a1a1aa]',
  };
  return <span className={`chip capitalize ${m[verdict] ?? m.inconclusive}`}>{verdict.replace(/_/g, ' ')}</span>;
}

const ENV_STATUS_CLS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 border border-[#a1a1aa]',
  ready: 'bg-brand-50 text-brand-700 border border-brand-200',
  validating: 'bg-blue-50 text-blue-600 border border-blue-200',
  archived: 'bg-gray-100 text-gray-400 border border-[#a1a1aa]',
};

export function EnvDetailPage({ envId, planId }: { envId: string; planId: PlanId }) {
  const { navigate } = useRouter();
  const [loading, setLoading] = useState(true);
  const [env, setEnv] = useState<ServerEnvironment | null>(null);
  const [targets, setTargets] = useState<ServerTarget[]>([]);
  const [blueprints, setBlueprints] = useState<EnvironmentBlueprint[]>([]);
  const [runs, setRuns] = useState<ValidationRun[]>([]);
  const [policy, setPolicy] = useState<CollectionPolicy | null>(null);
  const [conn, setConn] = useState<ConnectionProfile | null>(null);
  const [appGroups, setAppGroups] = useState<ApplicationGroup[]>([]);
  const [tab, setTab] = useState<TabId>('overview');
  const [error, setError] = useState('');

  // Submit form state
  const [selBlueprint, setSelBlueprint] = useState('');
  const [changeType, setChangeType] = useState('config');
  const [changeDesc, setChangeDesc] = useState('');
  const [artifactName, setArtifactName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const load = async () => {
    setLoading(true);
    const { data: envData, error: envErr } = await supabase.from('server_environments').select('*').eq('id', envId).single();
    if (envErr || !envData) { setError(envErr?.message ?? 'Environment not found'); setLoading(false); return; }
    setEnv(envData as ServerEnvironment);
    const [tgt, bp, rn, pol, cp, ag] = await Promise.all([
      supabase.from('server_targets').select('*').eq('environment_id', envId).order('created_at'),
      supabase.from('environment_blueprints').select('*').eq('environment_id', envId).order('created_at', { ascending: false }),
      supabase.from('validation_runs').select('*').eq('environment_id', envId).order('created_at', { ascending: false }),
      supabase.from('collection_policies').select('*').eq('environment_id', envId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('connection_profiles').select('*').eq('environment_id', envId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('application_groups').select('*').eq('environment_id', envId).order('created_at', { ascending: false }),
    ]);
    setTargets((tgt.data ?? []) as ServerTarget[]);
    setBlueprints((bp.data ?? []) as EnvironmentBlueprint[]);
    setRuns((rn.data ?? []) as ValidationRun[]);
    if (pol.data) setPolicy(pol.data as CollectionPolicy);
    if (cp.data) setConn(cp.data as ConnectionProfile);
    setAppGroups((ag.data ?? []) as ApplicationGroup[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [envId]);

  const submitValidation = async () => {
    if (!env || !selBlueprint || !changeDesc.trim()) { setSubmitError('Blueprint and change description are required'); return; }
    setSubmitting(true); setSubmitError('');
    const wid = env.workspace_id;
    // Create proposed change
    const { data: pcData, error: pcErr } = await supabase.from('proposed_changes').insert({
      environment_id: envId, workspace_id: wid, change_type: changeType,
      change_description: changeDesc.trim(), artifact_name: artifactName.trim() || null,
      artifact_type: artifactName ? 'file' : null, artifact_ref: null,
    }).select().single();
    if (pcErr) { setSubmitError(pcErr.message); setSubmitting(false); return; }
    const pc = pcData as ProposedChange;
    // Create validation run
    const { data: runData, error: runErr } = await supabase.from('validation_runs').insert({
      blueprint_id: selBlueprint, proposed_change_id: pc.id, environment_id: envId,
      workspace_id: wid, run_type: 'full', status: 'queued', confidence_score: null,
      verdict: null, ai_summary: null, ai_root_cause: null, ai_remediation_steps: [],
      ai_affected_components: [], passport_summary: null, current_step: 0, total_steps: 14,
      started_at: null, completed_at: null,
    }).select().single();
    if (runErr) { setSubmitError(runErr.message); setSubmitting(false); return; }
    navigate(`/server-validation/runs/${(runData as ValidationRun).id}`);
  };

  if (loading) return <div className="flex justify-center py-24"><Spinner size={28} /></div>;
  if (error || !env) return (
    <EmptyState icon={<Server size={22} />} title="Environment not found" description={error || 'The requested environment could not be loaded.'}
      action={<button onClick={() => navigate('/server-validation')} className="btn-primary"><ArrowLeft size={16} /> Back</button>} />
  );

  return (
    <div>
      <PageHeader
        title={env.name}
        description={env.primary_purpose ?? `${env.environment_type} · ${env.business_unit ?? 'No business unit'}`}
        breadcrumb={<Breadcrumb items={[{ label: 'Server Validation', to: '/server-validation' }, { label: env.name }]} />}
        actions={<span className={`chip capitalize ${ENV_STATUS_CLS[env.status] ?? ENV_STATUS_CLS.draft}`}>{env.status}</span>}
      />

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-[#a1a1aa]">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${tab === t.id ? 'tab-active' : 'tab-inactive'}`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card">
            <h3 className="mb-3 text-sm font-semibold text-navy-900">Environment Metadata</h3>
            <dl className="space-y-2">
              <div className="flex justify-between"><dt className="text-sm text-gray-400">Type</dt><dd className="text-sm font-medium capitalize text-navy-900">{env.environment_type}</dd></div>
              <div className="flex justify-between"><dt className="text-sm text-gray-400">Business Unit</dt><dd className="text-sm text-navy-900">{env.business_unit ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-sm text-gray-400">Owner</dt><dd className="text-sm text-navy-900">{env.owner ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-sm text-gray-400">Location</dt><dd className="text-sm text-navy-900">{env.location ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-sm text-gray-400">Expected Servers</dt><dd className="text-sm tabular-nums text-navy-900">{env.expected_server_count}</dd></div>
              <div className="flex justify-between"><dt className="text-sm text-gray-400">Created</dt><dd className="text-sm text-gray-600">{timeAgo(env.created_at)}</dd></div>
              <div className="flex justify-between"><dt className="text-sm text-gray-400">Updated</dt><dd className="text-sm text-gray-600">{timeAgo(env.updated_at)}</dd></div>
            </dl>
          </div>

          <div className="card">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy-900"><Network size={15} /> Connection Profile</h3>
            {conn ? (
              <dl className="space-y-2">
                <div className="flex justify-between"><dt className="text-sm text-gray-400">Method</dt><dd className="text-sm font-medium capitalize text-navy-900">{conn.method}</dd></div>
                <div className="flex justify-between"><dt className="text-sm text-gray-400">Auth Type</dt><dd className="text-sm text-navy-900">{conn.auth_type ?? '—'}</dd></div>
                {conn.bastion_host && <div className="flex justify-between"><dt className="text-sm text-gray-400">Bastion</dt><dd className="text-sm text-navy-900">{conn.bastion_host}:{conn.bastion_port ?? 22}</dd></div>}
                <div className="flex justify-between"><dt className="text-sm text-gray-400">Last Tested</dt><dd className="text-sm text-gray-600">{conn.last_tested_at ? timeAgo(conn.last_tested_at) : 'Never'}</dd></div>
                <div className="flex justify-between"><dt className="text-sm text-gray-400">Test Result</dt><dd className="text-sm text-navy-900">{conn.test_result ?? '—'}</dd></div>
              </dl>
            ) : <p className="text-sm text-gray-400">No connection profile configured.</p>}
          </div>

          {policy && (
            <div className="card lg:col-span-2">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy-900"><Settings2 size={15} /> Collection Policy</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Default ({policy.default_categories.length})</p>
                  <div className="mt-1 flex flex-wrap gap-1">{policy.default_categories.map((c, i) => <span key={i} className="chip bg-brand-50 text-brand-700 border border-brand-200">{c}</span>)}</div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Optional ({policy.optional_categories.length})</p>
                  <div className="mt-1 flex flex-wrap gap-1">{policy.optional_categories.map((c, i) => <span key={i} className="chip bg-blue-50 text-blue-600 border border-blue-200">{c}</span>)}</div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-danger-600">Never ({policy.never_categories.length})</p>
                  <div className="mt-1 flex flex-wrap gap-1">{policy.never_categories.map((c, i) => <span key={i} className="chip bg-red-50 text-danger-600 border border-red-200">{c}</span>)}</div>
                </div>
              </div>
            </div>
          )}

          <div className="card lg:col-span-2">
            <h3 className="mb-3 text-sm font-semibold text-navy-900">Stats</h3>
            <div className="grid grid-cols-4 gap-4">
              <div><p className="text-2xl font-bold tabular-nums text-navy-900">{targets.length}</p><p className="text-xs text-gray-400">Server Targets</p></div>
              <div><p className="text-2xl font-bold tabular-nums text-navy-900">{blueprints.length}</p><p className="text-xs text-gray-400">Blueprints</p></div>
              <div><p className="text-2xl font-bold tabular-nums text-navy-900">{appGroups.length}</p><p className="text-xs text-gray-400">App Groups</p></div>
              <div><p className="text-2xl font-bold tabular-nums text-navy-900">{runs.length}</p><p className="text-xs text-gray-400">Validation Runs</p></div>
            </div>
          </div>
        </div>
      )}

      {/* Server Targets */}
      {tab === 'targets' && (
        <div>
          {targets.length === 0 ? (
            <EmptyState icon={<Server size={22} />} title="No server targets" description="Add server targets during environment setup or via the wizard." />
          ) : (
            <div className="card divide-y divide-gray-100 p-0">
              <div className="grid grid-cols-12 gap-4 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                <div className="col-span-3">Hostname</div>
                <div className="col-span-2">IP</div>
                <div className="col-span-2">OS</div>
                <div className="col-span-2">Role</div>
                <div className="col-span-1">Port</div>
                <div className="col-span-2">Status</div>
              </div>
              {targets.map(t => (
                <div key={t.id} className="grid grid-cols-12 gap-4 px-4 py-3 text-sm">
                  <div className="col-span-3 font-medium text-navy-900">{t.hostname}</div>
                  <div className="col-span-2 text-gray-600">{t.ip ?? '—'}</div>
                  <div className="col-span-2 capitalize text-gray-600">{t.os_platform}</div>
                  <div className="col-span-2 text-gray-600">{t.server_role ?? '—'}</div>
                  <div className="col-span-1 tabular-nums text-gray-600">{t.port_override ?? '—'}</div>
                  <div className="col-span-2"><StatusBadge status={t.status === 'online' ? 'completed' : t.status === 'error' ? 'failed' : 'pending'} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Blueprints */}
      {tab === 'blueprints' && (
        <div>
          {blueprints.length === 0 ? (
            <EmptyState icon={<Boxes size={22} />} title="No blueprints yet" description="Generate a blueprint by running discovery on this environment." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {blueprints.map(bp => (
                <div key={bp.id} className="card">
                  <div className="flex items-center justify-between">
                    <span className="chip bg-brand-50 text-brand-700 border border-brand-200">v{bp.version}</span>
                    <span className={`chip capitalize ${bp.is_stale ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-gray-100 text-gray-500 border border-[#a1a1aa]'}`}>{bp.is_stale ? 'Stale' : bp.status}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <div><p className="text-lg font-bold tabular-nums text-navy-900">{bp.component_count}</p><p className="text-xs text-gray-400">Components</p></div>
                    <div><p className="text-lg font-bold tabular-nums text-navy-900">{bp.app_group_count}</p><p className="text-xs text-gray-400">App Groups</p></div>
                    <div><p className="text-lg font-bold tabular-nums text-navy-900">{bp.dependency_count}</p><p className="text-xs text-gray-400">Dependencies</p></div>
                  </div>
                  <p className="mt-3 text-xs text-gray-400">Capture: {bp.capture_method} · {timeAgo(bp.capture_timestamp)}</p>
                  {appGroups.filter(g => g.blueprint_id === bp.id).length > 0 && (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <p className="text-xs font-medium text-gray-400">App Groups</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {appGroups.filter(g => g.blueprint_id === bp.id).map(g => (
                          <span key={g.id} className={`chip ${g.human_confirmed ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'bg-gray-50 text-gray-500 border border-[#a1a1aa]'}`}>{g.name}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Validation Runs */}
      {tab === 'runs' && (
        <div>
          {runs.length === 0 ? (
            <EmptyState icon={<PlayCircle size={22} />} title="No validation runs" description="Submit a change for validation from the Submit Validation tab." />
          ) : (
            <div className="card divide-y divide-gray-100 p-0">
              {runs.map(r => (
                <button key={r.id} onClick={() => navigate(`/server-validation/runs/${r.id}`)} className="flex w-full items-center justify-between px-4 py-4 text-left transition-colors hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={r.status === 'queued' ? 'pending' : r.status === 'completed' ? 'completed' : r.status === 'failed' ? 'failed' : 'running'} />
                      <VerdictChip verdict={r.verdict} />
                      {r.confidence_score !== null && <span className="chip bg-blue-50 text-blue-600 border border-blue-200">{r.confidence_score}%</span>}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{r.run_type} run · Step {r.current_step ?? 0}/{r.total_steps ?? 14}</p>
                    <p className="mt-0.5 text-xs text-gray-400">{timeAgo(r.created_at)}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Submit Validation */}
      {tab === 'submit' && (
        <div className="mx-auto max-w-2xl">
          <div className="card">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-navy-900"><ShieldCheck size={16} /> Submit Change for Validation</h3>
            {planId === 'free' && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                <Lock size={14} className="text-amber-600" />
                <p className="text-sm text-amber-700">Validation runs require a paid plan. <button onClick={() => navigate('/plans')} className="font-semibold underline">Upgrade</button></p>
              </div>
            )}
            {submitError && <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-danger-600">{submitError}</div>}
            {blueprints.length === 0 ? (
              <p className="text-sm text-gray-500">Generate a blueprint first before submitting a validation.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="label">Blueprint</label>
                  <select className="input" value={selBlueprint} onChange={e => setSelBlueprint(e.target.value)}>
                    <option value="">Select a blueprint…</option>
                    {blueprints.map(bp => <option key={bp.id} value={bp.id}>v{bp.version} · {bp.component_count} components</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Change Type</label>
                  <select className="input" value={changeType} onChange={e => setChangeType(e.target.value)}>
                    <option value="config">Configuration Change</option>
                    <option value="deployment">Deployment</option>
                    <option value="patch">Patch / Update</option>
                    <option value="migration">Migration</option>
                    <option value="rollback">Rollback</option>
                  </select>
                </div>
                <div>
                  <label className="label">Change Description</label>
                  <textarea className="input" rows={3} value={changeDesc} onChange={e => setChangeDesc(e.target.value)} placeholder="Describe the change to validate…" />
                </div>
                <div>
                  <label className="label">Artifact Name (optional)</label>
                  <input className="input" value={artifactName} onChange={e => setArtifactName(e.target.value)} placeholder="e.g. deploy-v2.3.1.tar.gz" />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setTab('runs'); }} className="btn-secondary">Cancel</button>
                  <button onClick={submitValidation} disabled={submitting || !selBlueprint || !changeDesc.trim() || planId === 'free'} className="btn-primary">
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />} Submit for Validation
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
