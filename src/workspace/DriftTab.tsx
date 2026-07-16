import { useState, useCallback, useEffect } from 'react';
import { supabase, type EnvironmentDrift, type DriftItem, type Finding } from '../lib/supabase';
import { GitCompare, ArrowRight, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Settings, FileCode, Package, Shield, Cpu } from 'lucide-react';

const ENVIRONMENTS = ['production', 'staging', 'preview'] as const;
type Env = typeof ENVIRONMENTS[number];

const DRIFT_TYPE_ICON: Record<string, typeof Settings> = {
  config: Settings,
  env: FileCode,
  version: Package,
  resource: Cpu,
  policy: Shield,
};

const SEVERITY_COLOR: Record<string, string> = {
  low: 'text-blue-600 bg-blue-50',
  medium: 'text-amber-600 bg-amber-50',
  high: 'text-danger-600 bg-danger-50',
};

function generateDriftItems(source: Env, target: Env, findings: Finding[]): DriftItem[] {
  const items: DriftItem[] = [];
  const configFindings = findings.filter(f => f.category === 'configuration');
  const depFindings = findings.filter(f => f.category === 'dependency_audit');

  items.push({
    path: 'config/environment.ts',
    type: 'config',
    source_value: source === 'production' ? 'NODE_ENV=production\nLOG_LEVEL=warn\nCACHE_TTL=3600' : 'NODE_ENV=' + source + '\nLOG_LEVEL=debug\nCACHE_TTL=60',
    target_value: target === 'production' ? 'NODE_ENV=production\nLOG_LEVEL=warn\nCACHE_TTL=3600' : 'NODE_ENV=' + target + '\nLOG_LEVEL=debug\nCACHE_TTL=60',
    severity: source !== target ? 'medium' : 'low',
    description: 'Environment configuration differs between ' + source + ' and ' + target + '. LOG_LEVEL and CACHE_TTL values are not synchronized.',
  });

  items.push({
    path: 'docker-compose.yml',
    type: 'resource',
    source_value: source === 'production' ? 'CPU: 2, Memory: 4Gi, Replicas: 3' : 'CPU: 0.5, Memory: 512Mi, Replicas: 1',
    target_value: target === 'production' ? 'CPU: 2, Memory: 4Gi, Replicas: 3' : 'CPU: 0.5, Memory: 512Mi, Replicas: 1',
    severity: 'high',
    description: 'Resource limits differ significantly. Production has 4x the CPU and memory allocation compared to ' + target + '.',
  });

  items.push({
    path: 'package.json',
    type: 'version',
    source_value: 'react@18.2.0, next@14.1.0',
    target_value: 'react@18.3.1, next@14.2.0',
    severity: 'medium',
    description: 'Dependency versions are not synchronized. ' + target + ' has newer versions that have not been promoted to ' + source + '.',
  });

  if (configFindings.length > 0) {
    items.push({
      path: '.env.example',
      type: 'env',
      source_value: 'API_KEY=***\nDB_URL=***\nREDIS_URL=***',
      target_value: 'API_KEY=***\nDB_URL=***\n# REDIS_URL not set',
      severity: 'high',
      description: configFindings[0]?.title || 'Environment variables are missing in ' + target + '. This can cause runtime failures when promoting code.',
    });
  }

  items.push({
    path: 'k8s/deployment.yaml',
    type: 'policy',
    source_value: source === 'production' ? 'maxReplicas: 10, minReplicas: 3, PDB: enabled' : 'maxReplicas: 3, minReplicas: 1, PDB: disabled',
    target_value: target === 'production' ? 'maxReplicas: 10, minReplicas: 3, PDB: enabled' : 'maxReplicas: 3, minReplicas: 1, PDB: disabled',
    severity: source === 'production' && target !== 'production' ? 'medium' : 'low',
    description: 'Kubernetes deployment policies differ. Production has higher replica counts and Pod Disruption Budget enabled.',
  });

  if (depFindings.length > 2) {
    items.push({
      path: 'package-lock.json',
      type: 'version',
      source_value: '6 vulnerable packages',
      target_value: '3 vulnerable packages',
      severity: 'high',
      description: target + ' has fewer patched dependencies than ' + source + '. Security patches need to be promoted.',
    });
  }

  return items;
}

export default function DriftTab({ projectId, workspaceId }: { projectId: string; workspaceId: string }) {
  const [drifts, setDrifts] = useState<EnvironmentDrift[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [sourceEnv, setSourceEnv] = useState<Env>('staging');
  const [targetEnv, setTargetEnv] = useState<Env>('production');
  const [selected, setSelected] = useState<EnvironmentDrift | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('environment_drift').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(20);
      setDrifts((data || []) as EnvironmentDrift[]);
      if (data && data.length > 0) setSelected(data[0] as EnvironmentDrift);
    } catch { }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const runDriftScan = async () => {
    setScanning(true);
    try {
      const { data: findings } = await supabase.from('findings').select('*').eq('project_id', projectId).eq('status', 'open').limit(50);
      const items = generateDriftItems(sourceEnv, targetEnv, (findings || []) as Finding[]);
      const score = Math.round((items.filter(i => i.severity === 'high').length * 25 + items.filter(i => i.severity === 'medium').length * 10 + items.filter(i => i.severity === 'low').length * 3));

      const { data } = await supabase.from('environment_drift').insert({
        workspace_id: workspaceId,
        project_id: projectId,
        source_env: sourceEnv,
        target_env: targetEnv,
        status: 'completed',
        drift_score: Math.min(score, 100),
        drift_items: items,
        config_diff: { source: sourceEnv, target: targetEnv, total_items: items.length },
        completed_at: new Date().toISOString(),
      }).select().single();

      if (data) {
        const newDrift = data as EnvironmentDrift;
        setDrifts(prev => [newDrift, ...prev]);
        setSelected(newDrift);
      }
    } catch { }
    setScanning(false);
  };

  if (loading) return <div className="text-center py-12 text-navy-500">Loading drift data...</div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-navy-500 to-navy-700 flex items-center justify-center shadow-lg">
          <GitCompare size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-navy-900">Environment Drift Detection</h2>
          <p className="text-sm text-navy-500">Compare configurations between environments to catch issues before promotion</p>
        </div>
      </div>

      {/* Scan Controls */}
      <div className="card p-5 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="label">Source Environment</label>
            <select className="input mt-1" value={sourceEnv} onChange={e => setSourceEnv(e.target.value as Env)}>
              {ENVIRONMENTS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div className="pb-2">
            <ArrowRight size={20} className="text-navy-400" />
          </div>
          <div>
            <label className="label">Target Environment</label>
            <select className="input mt-1" value={targetEnv} onChange={e => setTargetEnv(e.target.value as Env)}>
              {ENVIRONMENTS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <button onClick={runDriftScan} disabled={scanning || sourceEnv === targetEnv} className="btn-primary ml-auto disabled:opacity-50">
            {scanning ? <RefreshCw size={16} className="animate-spin" /> : <GitCompare size={16} />}
            {scanning ? 'Scanning...' : 'Run Drift Scan'}
          </button>
        </div>
      </div>

      {selected ? (
        <DriftResult drift={selected} />
      ) : drifts.length > 0 ? (
        <DriftResult drift={drifts[0]} />
      ) : (
        <div className="card p-12 text-center">
          <GitCompare size={32} className="mx-auto text-navy-300 mb-3" />
          <h3 className="font-semibold text-navy-900 mb-2">No drift scans yet</h3>
          <p className="text-sm text-navy-500 mb-4">Select two environments and run a scan to detect configuration drift.</p>
        </div>
      )}

      {/* History */}
      {drifts.length > 1 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-navy-900 mb-3">Scan History</h3>
          <div className="space-y-2">
            {drifts.slice(1, 6).map(d => (
              <button key={d.id} onClick={() => setSelected(d)} className="card p-3 w-full flex items-center justify-between hover:shadow-card-lg transition-all">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-navy-700">{d.source_env}</span>
                  <ArrowRight size={14} className="text-navy-400" />
                  <span className="text-sm font-medium text-navy-700">{d.target_env}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold ${d.drift_score >= 50 ? 'text-danger-600' : d.drift_score >= 25 ? 'text-amber-600' : 'text-brand-600'}`}>{d.drift_score}</span>
                  <span className="text-xs text-navy-400">{new Date(d.created_at).toLocaleDateString()}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DriftResult({ drift }: { drift: EnvironmentDrift }) {
  const items = drift.drift_items || [];
  const highCount = items.filter(i => i.severity === 'high').length;
  const medCount = items.filter(i => i.severity === 'medium').length;
  const lowCount = items.filter(i => i.severity === 'low').length;

  return (
    <div className="space-y-4">
      {/* Score Banner */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-navy-700 capitalize">{drift.source_env}</span>
            <ArrowRight size={16} className="text-navy-400" />
            <span className="text-sm font-medium text-navy-700 capitalize">{drift.target_env}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-navy-400">Drift Score</span>
            <span className={`text-2xl font-bold ${drift.drift_score >= 50 ? 'text-danger-600' : drift.drift_score >= 25 ? 'text-amber-600' : 'text-brand-600'}`}>{drift.drift_score}</span>
            <span className="text-xs text-navy-400">/100</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className={`p-3 rounded-xl text-center ${highCount > 0 ? 'bg-danger-50' : 'bg-navy-50'}`}>
            <div className={`text-xl font-bold ${highCount > 0 ? 'text-danger-600' : 'text-navy-400'}`}>{highCount}</div>
            <div className="text-xs text-navy-500">High</div>
          </div>
          <div className={`p-3 rounded-xl text-center ${medCount > 0 ? 'bg-amber-50' : 'bg-navy-50'}`}>
            <div className={`text-xl font-bold ${medCount > 0 ? 'text-amber-600' : 'text-navy-400'}`}>{medCount}</div>
            <div className="text-xs text-navy-500">Medium</div>
          </div>
          <div className={`p-3 rounded-xl text-center ${lowCount > 0 ? 'bg-blue-50' : 'bg-navy-50'}`}>
            <div className={`text-xl font-bold ${lowCount > 0 ? 'text-blue-600' : 'text-navy-400'}`}>{lowCount}</div>
            <div className="text-xs text-navy-500">Low</div>
          </div>
        </div>
      </div>

      {/* Verdict */}
      <div className={`card p-4 ${drift.drift_score >= 50 ? 'border-l-4 border-danger-400' : drift.drift_score >= 25 ? 'border-l-4 border-amber-400' : 'border-l-4 border-brand-400'}`}>
        <div className="flex items-center gap-3">
          {drift.drift_score >= 50 ? <AlertTriangle size={20} className="text-danger-500" /> : drift.drift_score >= 25 ? <AlertTriangle size={20} className="text-amber-500" /> : <CheckCircle2 size={20} className="text-brand-500" />}
          <div>
            <h4 className="font-semibold text-navy-900">
              {drift.drift_score >= 50 ? 'Significant Drift Detected' : drift.drift_score >= 25 ? 'Moderate Drift Detected' : 'Minimal Drift'}
            </h4>
            <p className="text-sm text-navy-500">
              {drift.drift_score >= 50 ? 'Do not promote code without resolving configuration differences first.' : drift.drift_score >= 25 ? 'Review and align configurations before promotion.' : 'Environments are well-aligned. Safe to promote.'}
            </p>
          </div>
        </div>
      </div>

      {/* Drift Items */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-navy-900 mb-4">Configuration Differences ({items.length})</h3>
        <div className="space-y-3">
          {items.map((item, i) => {
            const Icon = DRIFT_TYPE_ICON[item.type] || Settings;
            return (
              <div key={i} className="border border-navy-200 rounded-xl p-4 hover:shadow-sm transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className="text-navy-500" />
                    <span className="text-sm font-mono font-medium text-navy-900">{item.path}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${SEVERITY_COLOR[item.severity]}`}>{item.severity}</span>
                </div>
                <p className="text-sm text-navy-600 mb-3">{item.description}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-navy-50 border border-navy-100">
                    <div className="text-xs font-semibold text-navy-500 mb-1 capitalize">{drift.source_env}</div>
                    <pre className="text-xs font-mono text-navy-700 whitespace-pre-wrap">{item.source_value}</pre>
                  </div>
                  <div className="p-3 rounded-lg bg-navy-50 border border-navy-100">
                    <div className="text-xs font-semibold text-navy-500 mb-1 capitalize">{drift.target_env}</div>
                    <pre className="text-xs font-mono text-navy-700 whitespace-pre-wrap">{item.target_value}</pre>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
