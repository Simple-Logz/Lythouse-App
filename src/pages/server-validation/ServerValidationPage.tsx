import { useEffect, useState } from 'react';
import {
  supabase,
  type ServerEnvironment,
  type EnvironmentBlueprint,
  type ValidationRun,
  type ServerTarget,
  type PlanId,
  PLANS,
} from '../../lib/supabase';
import { PageHeader, Spinner, EmptyState, Breadcrumb, timeAgo } from '../../lib/ui';
import { useRouter } from '../../lib/router';
import { PinButton } from '../../lib/pins';
import { usePlanId } from '../AppShell';
import { Server, Plus, Lock, ArrowRight, ShieldCheck, Boxes, CirclePlay as PlayCircle, FileCheck } from 'lucide-react';

type EnvRow = ServerEnvironment & {
  server_count?: number;
  blueprint_count?: number;
  last_run?: ValidationRun | null;
};

const ENV_TYPE_CLS: Record<string, string> = {
  production: 'bg-red-50 text-danger-600 border border-red-200',
  staging: 'bg-amber-50 text-amber-600 border border-amber-200',
  development: 'bg-blue-50 text-blue-600 border border-blue-200',
  test: 'bg-gray-100 text-gray-600 border border-[#d4d4d8]',
};

const ENV_STATUS_CLS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 border border-[#d4d4d8]',
  ready: 'bg-brand-50 text-brand-700 border border-brand-200',
  validating: 'bg-blue-50 text-blue-600 border border-blue-200',
  archived: 'bg-gray-100 text-gray-400 border border-[#d4d4d8]',
};

function VerdictChip({ verdict }: { verdict: string | null }) {
  if (!verdict) return <span className="text-xs text-gray-400">No runs yet</span>;
  const m: Record<string, string> = {
    approved: 'bg-brand-50 text-brand-700 border border-brand-200',
    conditionally_approved: 'bg-blue-50 text-blue-600 border border-blue-200',
    rejected: 'bg-red-50 text-danger-600 border border-red-200',
    inconclusive: 'bg-gray-100 text-gray-500 border border-[#d4d4d8]',
  };
  const label = verdict.replace(/_/g, ' ');
  return <span className={`chip capitalize ${m[verdict] ?? m.inconclusive}`}>{label}</span>;
}

export function ServerValidationPage() {
  const { navigate } = useRouter();
  // Read the plan straight from context instead of taking it as a prop —
  // App.tsx used to call usePlanId() in Routes() and pass the result down,
  // but Routes() sits ABOVE AppShell's PlanContext.Provider in the tree
  // (Routes renders <AppShell>{...}</AppShell>, so Routes is the Provider's
  // ancestor, not a descendant of it). A context Provider only supplies its
  // value to descendants, so that usePlanId() call always resolved to the
  // context's default ('free') no matter what plan the workspace was
  // actually on — every paying customer was silently treated as Free here.
  // Calling the hook inside this component (an actual descendant once
  // mounted inside AppShell) reads the real value.
  const planId = usePlanId();
  const [loading, setLoading] = useState(true);
  const [envs, setEnvs] = useState<EnvRow[]>([]);
  const [stats, setStats] = useState({ totalServers: 0, totalBlueprints: 0, totalRuns: 0 });

  const wsId = () => localStorage.getItem('sandbox.activeWs');
  const isFree = planId === 'free';

  const load = async () => {
    setLoading(true);
    const wid = wsId();
    if (!wid) { setLoading(false); return; }
    const [envRes, tgtRes, bpRes, runRes] = await Promise.all([
      supabase.from('server_environments').select('*').eq('workspace_id', wid).order('created_at', { ascending: false }),
      supabase.from('server_targets').select('environment_id').eq('workspace_id', wid),
      supabase.from('environment_blueprints').select('environment_id').eq('workspace_id', wid),
      supabase.from('validation_runs').select('*').eq('workspace_id', wid).order('created_at', { ascending: false }),
    ]);
    if (envRes.error) console.error('ServerValidationPage load error:', envRes.error);
    const environments = (envRes.data ?? []) as ServerEnvironment[];
    const targets = (tgtRes.data ?? []) as Pick<ServerTarget, 'environment_id'>[];
    const blueprints = (bpRes.data ?? []) as Pick<EnvironmentBlueprint, 'environment_id'>[];
    const runs = (runRes.data ?? []) as ValidationRun[];

    const tgtCount: Record<string, number> = {};
    targets.forEach(t => { tgtCount[t.environment_id] = (tgtCount[t.environment_id] ?? 0) + 1; });
    const bpCount: Record<string, number> = {};
    blueprints.forEach(b => { bpCount[b.environment_id] = (bpCount[b.environment_id] ?? 0) + 1; });
    const lastRunByEnv: Record<string, ValidationRun> = {};
    runs.forEach(r => { if (!lastRunByEnv[r.environment_id]) lastRunByEnv[r.environment_id] = r; });

    const rows: EnvRow[] = environments.map(e => ({
      ...e,
      server_count: tgtCount[e.id] ?? 0,
      blueprint_count: bpCount[e.id] ?? 0,
      last_run: lastRunByEnv[e.id] ?? null,
    }));
    setEnvs(rows);
    setStats({ totalServers: targets.length, totalBlueprints: blueprints.length, totalRuns: runs.length });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex justify-center py-24"><Spinner size={28} /></div>;

  return (
    <div>
      <PageHeader
        title="Server Validation"
        description="Discover, blueprint, and validate changes against your real server environments."
        breadcrumb={<Breadcrumb items={[{ label: 'Server Validation' }]} />}
        actions={
          <button
            onClick={() => isFree ? navigate('/plans') : navigate('/server-validation/new')}
            disabled={false}
            className="btn-primary"
          >
            {isFree ? <><Lock size={16} /> Upgrade to create</> : <><Plus size={16} /> New Environment</>}
          </button>
        }
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Server size={18} /></div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-navy-900">{envs.length}</p>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Environments</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Boxes size={18} /></div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-navy-900">{stats.totalServers}</p>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Server Targets</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600"><FileCheck size={18} /></div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-navy-900">{stats.totalBlueprints}</p>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Blueprints</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><PlayCircle size={18} /></div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-navy-900">{stats.totalRuns}</p>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Validation Runs</p>
            </div>
          </div>
        </div>
      </div>

      {/* Free plan gating */}
      {isFree && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Lock size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Server Validation requires a paid plan</p>
            <p className="mt-0.5 text-sm text-amber-700">
              The {PLANS.free.name} plan is limited to offline snapshot imports. Upgrade to{' '}
              <button onClick={() => navigate('/plans')} className="font-semibold underline">{PLANS.developer.name}</button>
              {' '}or{' '}
              <button onClick={() => navigate('/plans')} className="font-semibold underline">{PLANS.enterprise.name}</button>
              {' '}to create environments with live agents, SSH, or WinRM connections.
            </p>
          </div>
        </div>
      )}

      {/* Environments grid */}
      {envs.length === 0 ? (
        <EmptyState
          icon={<Server size={22} />}
          title="No server environments yet"
          description="Create an environment to discover components, generate blueprints, and validate changes before deployment."
          action={
            <button onClick={() => isFree ? navigate('/plans') : navigate('/server-validation/new')} className="btn-primary">
              {isFree ? <><Lock size={16} /> View plans</> : <><Plus size={16} /> New Environment</>}
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {envs.map(env => (
            <div
              key={env.id}
              role="button" tabIndex={0}
              onClick={() => navigate(`/server-validation/${env.id}`)}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/server-validation/${env.id}`) }}
              className="card group cursor-pointer text-left transition-all hover:shadow-md hover:border-brand-300"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <Server size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-navy-900 group-hover:text-brand-700">{env.name}</h3>
                    <p className="text-xs text-gray-400">{env.business_unit ?? 'No business unit'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`chip capitalize ${ENV_STATUS_CLS[env.status] ?? ENV_STATUS_CLS.draft}`}>{env.status}</span>
                  <PinButton item={{type:'environment',id:env.id,label:env.name,to:`/server-validation/${env.id}`}}/>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <span className={`chip capitalize ${ENV_TYPE_CLS[env.environment_type] ?? ENV_TYPE_CLS.production}`}>
                  {env.environment_type}
                </span>
                {env.owner && <span className="chip bg-gray-50 text-gray-500 border border-[#d4d4d8]">{env.owner}</span>}
              </div>

              {env.primary_purpose && (
                <p className="mt-3 line-clamp-2 text-sm text-gray-500">{env.primary_purpose}</p>
              )}

              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
                <div>
                  <p className="text-lg font-bold tabular-nums text-navy-900">{env.server_count ?? 0}</p>
                  <p className="text-xs text-gray-400">Servers</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-navy-900">{env.blueprint_count ?? 0}</p>
                  <p className="text-xs text-gray-400">Blueprints</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-navy-900">{env.expected_server_count ?? 0}</p>
                  <p className="text-xs text-gray-400">Expected</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-gray-400" />
                  {env.last_run ? (
                    <VerdictChip verdict={env.last_run.verdict} />
                  ) : (
                    <span className="text-xs text-gray-400">No validation runs</span>
                  )}
                </div>
                <span className="text-xs text-gray-400">{timeAgo(env.updated_at)}</span>
              </div>

              <div className="mt-3 flex items-center gap-1 text-sm font-medium text-brand-600 opacity-0 transition-opacity group-hover:opacity-100">
                View details <ArrowRight size={14} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
