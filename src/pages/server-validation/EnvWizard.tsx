import { useEffect, useState, useCallback } from 'react';
import {
  supabase,
  type PlanId,
  type ServerTarget,
  type DiscoveredComponent,
  type ApplicationGroup,
  type DiscoveryJob,
  type CollectionPolicy,
  type ConnectionMethod,
  COLLECTION_DEFAULT_CATEGORIES,
  COLLECTION_NEVER_CATEGORIES,
} from '../../lib/supabase';
import { PageHeader, Spinner, Breadcrumb } from '../../lib/ui';
import { useRouter } from '../../lib/router';
import { Server, Wifi, KeyRound, ListPlus, ShieldCheck, Plug, Search, FileCheck, Check, ChevronLeft, ChevronRight, ArrowLeft, TriangleAlert as AlertTriangle } from 'lucide-react';
import {
  StepDetails,
  StepConnectionMethod,
  StepCredentials,
  StepTargets,
  StepCollectionPolicy,
  StepPreCheck,
  StepDiscover,
  StepBlueprint,
} from './wizardSteps';

const STEPS = [
  { label: 'Environment Details', icon: Server },
  { label: 'Connection Method', icon: Wifi },
  { label: 'Credentials', icon: KeyRound },
  { label: 'Server Targets', icon: ListPlus },
  { label: 'Collection Policy', icon: ShieldCheck },
  { label: 'Connectivity Pre-check', icon: Plug },
  { label: 'Discover & Review', icon: Search },
  { label: 'Generate Blueprint', icon: FileCheck },
] as const;

type CheckResult = { dns: string; network: string; auth: string; os: string; permissions: string; agent: string };

export function EnvWizard({ planId }: { planId: PlanId }) {
  const { navigate } = useRouter();
  const wsId = () => localStorage.getItem('sandbox.activeWs');
  const [step, setStep] = useState(0);
  const [envId, setEnvId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [form, setForm] = useState({
    name: '', business_unit: '', owner: '', environment_type: 'production',
    location: '', expected_server_count: 1, primary_purpose: '', method: 'offline' as ConnectionMethod,
    cred_token: '', cred_host: '', cred_port: 22, cred_user: '', cred_key: '', cred_password: '', cred_auth_type: 'key',
  });
  const [targets, setTargets] = useState<Partial<ServerTarget>[]>([{ hostname: '', ip: '', os_platform: 'linux', server_role: '', port_override: null }]);
  const [policy, setPolicy] = useState<{ default_categories: string[]; optional_categories: string[]; never_categories: string[] }>({
    default_categories: [...COLLECTION_DEFAULT_CATEGORIES] as unknown as string[],
    optional_categories: [],
    never_categories: [...COLLECTION_NEVER_CATEGORIES] as unknown as string[],
  });
  const [checkResults, setCheckResults] = useState<Record<number, CheckResult>>({});
  const [checking, setChecking] = useState(false);
  const [components, setComponents] = useState<DiscoveredComponent[]>([]);
  const [appGroups, setAppGroups] = useState<ApplicationGroup[]>([]);
  const [discoveryRunning, setDiscoveryRunning] = useState(false);
  const [generating, setGenerating] = useState(false);

  // ─── Save environment (step 0) ───
  const saveEnvironment = useCallback(async () => {
    const wid = wsId();
    if (!wid || !form.name.trim()) return null;
    const payload = {
      workspace_id: wid, name: form.name.trim(), business_unit: form.business_unit || null,
      owner: form.owner || null, environment_type: form.environment_type, location: form.location || null,
      expected_server_count: form.expected_server_count, primary_purpose: form.primary_purpose || null, status: 'draft',
    };
    if (envId) {
      const { data, error } = await supabase.from('server_environments').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', envId).select().single();
      if (error) { setError(error.message); return null; }
      return envId;
    }
    const { data, error } = await supabase.from('server_environments').insert(payload).select().single();
    if (error) { setError(error.message); return null; }
    setEnvId(data.id);
    return data.id as string;
  }, [form, envId]);

  // ─── Save connection profile (step 2) ───
  const saveConnectionProfile = async (eid: string) => {
    const wid = wsId();
    if (!wid) return;
    const existing = await supabase.from('connection_profiles').select('id').eq('environment_id', eid).limit(1).maybeSingle();
    const payload = {
      environment_id: eid, workspace_id: wid, method: form.method,
      bastion_host: form.cred_host || null, bastion_port: form.cred_port || null,
      auth_type: form.cred_auth_type || null, server_target_id: null,
      credential_ref_id: form.cred_token || null, test_result: null, test_details: {},
    };
    if (existing.data) {
      await supabase.from('connection_profiles').update(payload).eq('id', (existing.data as any).id);
    } else {
      await supabase.from('connection_profiles').insert(payload);
    }
  };

  // ─── Save targets (step 3) ───
  const saveTargets = async (eid: string) => {
    const wid = wsId();
    if (!wid) return;
    // Delete existing and re-insert
    await supabase.from('server_targets').delete().eq('environment_id', eid);
    const valid = targets.filter(t => t.hostname?.trim());
    if (valid.length) {
      await supabase.from('server_targets').insert(valid.map(t => ({
        environment_id: eid, workspace_id: wid, hostname: t.hostname!.trim(),
        ip: t.ip || null, os_platform: t.os_platform ?? 'linux',
        server_role: t.server_role || null, port_override: t.port_override ?? null, status: 'pending',
      })));
    }
  };

  // ─── Save collection policy (step 4) ───
  const savePolicy = async (eid: string) => {
    const wid = wsId();
    if (!wid) return;
    const existing = await supabase.from('collection_policies').select('id').eq('environment_id', eid).limit(1).maybeSingle();
    const payload = {
      environment_id: eid, workspace_id: wid,
      default_categories: policy.default_categories, optional_categories: policy.optional_categories,
      never_categories: policy.never_categories, approved_at: new Date().toISOString(),
    };
    if (existing.data) {
      await supabase.from('collection_policies').update(payload).eq('id', (existing.data as any).id);
    } else {
      await supabase.from('collection_policies').insert(payload);
    }
  };

  // ─── Run pre-checks (step 5) ───
  const runPreChecks = async (eid: string) => {
    setChecking(true);
    // Simulate checks for each target
    for (let i = 0; i < targets.length; i++) {
      const checks = ['dns', 'network', 'auth', 'os', 'permissions', 'agent'];
      const result: CheckResult = { dns: 'pending', network: 'pending', auth: 'pending', os: 'pending', permissions: 'pending', agent: 'pending' };
      setCheckResults(prev => ({ ...prev, [i]: { ...result, dns: 'running' } }));
      for (const ck of checks) {
        await new Promise(r => setTimeout(r, 200));
        (result as any)[ck] = Math.random() > 0.15 ? 'pass' : 'fail';
        setCheckResults(prev => ({ ...prev, [i]: { ...result } }));
      }
    }
    setChecking(false);
  };

  // ─── Run discovery (step 6) ───
  const runDiscovery = async () => {
    if (!envId) return;
    const wid = wsId();
    if (!wid) return;
    setDiscoveryRunning(true);
    setError('');
    const { data: jobData, error: jobErr } = await supabase.from('discovery_jobs').insert({
      environment_id: envId, workspace_id: wid, status: 'running', component_count: 0, group_suggestion_count: 0,
    }).select().single();
    if (jobErr) { setError(jobErr.message); setDiscoveryRunning(false); return; }
    const job = jobData as DiscoveryJob;
    // Simulate discovery: generate mock components
    await new Promise(r => setTimeout(r, 1500));
    const mockTypes = ['service', 'web_server', 'database', 'runtime', 'package', 'container', 'scheduled_task'];
    const mockNames = ['nginx', 'postgresql', 'nodejs', 'redis', 'systemd-timer', 'docker', 'java-app', 'python-app'];
    const compRows = Array.from({ length: Math.min(12, targets.length * 3) }, (_, i) => ({
      job_id: job.id, environment_id: envId, workspace_id: wid, server_target_id: null,
      component_type: mockTypes[i % mockTypes.length], name: `${mockNames[i % mockNames.length]}-${i + 1}`,
      evidence: {}, confidence: 0.7 + Math.random() * 0.3,
    }));
    const { data: compData } = await supabase.from('discovered_components').insert(compRows).select('*');
    setComponents((compData ?? []) as DiscoveredComponent[]);
    // Generate mock app groups
    const groupRows = Array.from({ length: 3 }, (_, i) => ({
      environment_id: envId, workspace_id: wid, blueprint_id: null,
      name: `App Group ${i + 1}`, component_ids: (compData ?? []).slice(i * 4, (i + 1) * 4).map(c => (c as any).id),
      human_confirmed: false, business_context: 'AI-inferred group based on dependency analysis', ai_confidence: 0.65 + Math.random() * 0.3,
    }));
    const { data: groupData } = await supabase.from('application_groups').insert(groupRows).select('*');
    setAppGroups((groupData ?? []) as ApplicationGroup[]);
    await supabase.from('discovery_jobs').update({ status: 'completed', component_count: compRows.length, group_suggestion_count: groupRows.length, completed_at: new Date().toISOString() }).eq('id', job.id);
    setDiscoveryRunning(false);
  };

  // ─── Confirm/edit app group ───
  const confirmGroup = async (id: string, confirmed: boolean) => {
    await supabase.from('application_groups').update({ human_confirmed: confirmed }).eq('id', id);
    setAppGroups(prev => prev.map(g => g.id === id ? { ...g, human_confirmed: confirmed } : g));
  };

  // ─── Generate blueprint (step 7) ───
  const generateBlueprint = async () => {
    if (!envId) return;
    const wid = wsId();
    if (!wid) return;
    setGenerating(true);
    setError('');
    const { data: bpData, error: bpErr } = await supabase.from('environment_blueprints').insert({
      environment_id: envId, workspace_id: wid, version: '1.0', capture_method: form.method,
      capture_timestamp: new Date().toISOString(), is_stale: false,
      component_count: components.length, app_group_count: appGroups.length, dependency_count: 0,
      known_gaps: [], status: 'active',
    }).select().single();
    if (bpErr) { setError(bpErr.message); setGenerating(false); return; }
    // Link app groups to blueprint
    if (appGroups.length) {
      await supabase.from('application_groups').update({ blueprint_id: bpData.id }).in('id', appGroups.map(g => g.id));
    }
    // Update env status
    await supabase.from('server_environments').update({ status: 'ready', updated_at: new Date().toISOString() }).eq('id', envId);
    setGenerating(false);
    navigate(`/server-validation/${envId}`);
  };

  // ─── Step validation ───
  const canProceed = (): boolean => {
    if (step === 0) return !!form.name.trim();
    if (step === 1) return !!form.method;
    if (step === 3) return targets.some(t => t.hostname?.trim());
    return true;
  };

  // ─── Next handler with save ───
  const handleNext = async () => {
    setError('');
    setSaving(true);
    try {
      if (step === 0) { const eid = await saveEnvironment(); if (!eid) { setSaving(false); return; } }
      if (step === 1) { /* method saved with profile in step 2 */ }
      if (step === 2 && envId) { await saveConnectionProfile(envId); }
      if (step === 3 && envId) { await saveTargets(envId); }
      if (step === 4 && envId) { await savePolicy(envId); }
      if (step === 5 && envId && !checking) { await runPreChecks(envId); setSaving(false); return; }
      if (step === 6 && envId) { /* discovery is manual */ }
    } catch (e: any) { setError(e.message); setSaving(false); return; }
    setSaving(false);
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const handleBack = () => { if (step > 0) setStep(step - 1); else navigate('/server-validation'); };

  const StepIcon = STEPS[step].icon;

  return (
    <div>
      <PageHeader
        title="New Environment"
        description="Set up a server environment for discovery and validation."
        breadcrumb={<Breadcrumb items={[{ label: 'Server Validation', to: '/server-validation' }, { label: 'New Environment' }]} />}
      />

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Progress sidebar */}
        <div className="lg:sticky lg:top-8 lg:self-start">
          <div className="card p-3">
            <div className="space-y-0.5">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const active = i === step;
                const done = i < step;
                return (
                  <button key={i} onClick={() => i <= step && setStep(i)} disabled={i > step}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${active ? 'bg-brand-50 text-brand-700' : done ? 'text-gray-600 hover:bg-gray-50' : 'text-gray-300 cursor-not-allowed'}`}>
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${active ? 'border-brand-500 bg-brand-500 text-white' : done ? 'border-brand-300 bg-brand-50 text-brand-600' : 'border-[#71717a] bg-white'}`}>
                      {done ? <Check size={13} strokeWidth={3} /> : <Icon size={13} />}
                    </div>
                    <span className="font-medium">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Step content */}
        <div>
          <div className="card">
            <div className="mb-5 flex items-center gap-2 border-b border-gray-100 pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><StepIcon size={18} /></div>
              <div>
                <h2 className="text-base font-semibold text-navy-900">{STEPS[step].label}</h2>
                <p className="text-xs text-gray-400">Step {step + 1} of {STEPS.length}</p>
              </div>
            </div>

            {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-danger-600">{error}</div>}

            {step === 0 && <StepDetails form={form} setForm={setForm} />}
            {step === 1 && <StepConnectionMethod form={form} setForm={setForm} planId={planId} />}
            {step === 2 && <StepCredentials form={form} setForm={setForm} />}
            {step === 3 && <StepTargets targets={targets} setTargets={setTargets} />}
            {step === 4 && <StepCollectionPolicy policy={policy} setPolicy={setPolicy} />}
            {step === 5 && <StepPreCheck targets={targets} results={checkResults} checking={checking} />}
            {step === 6 && <StepDiscover envId={envId} components={components} appGroups={appGroups} discoveryRunning={discoveryRunning} onDiscover={runDiscovery} onConfirmGroup={confirmGroup} />}
            {step === 7 && <StepBlueprint form={form} targets={targets} components={components} appGroups={appGroups} generating={generating} onGenerate={generateBlueprint} />}
          </div>

          {/* Navigation */}
          <div className="mt-4 flex items-center justify-between">
            <button onClick={handleBack} className="btn-secondary">
              <ChevronLeft size={16} /> {step === 0 ? 'Cancel' : 'Back'}
            </button>
            {step < STEPS.length - 1 ? (
              <button onClick={handleNext} disabled={saving || !canProceed()} className="btn-primary">
                {saving ? <Spinner size={16} /> : <>Next <ChevronRight size={16} /></>}
              </button>
            ) : (
              <button onClick={generateBlueprint} disabled={generating || components.length === 0} className="btn-primary">
                {generating ? <Spinner size={16} /> : <><FileCheck size={16} /> Finish</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
