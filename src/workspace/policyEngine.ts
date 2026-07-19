// @ts-nocheck
// Policy-as-Code engine. Org-defined deployment rules evaluated against the
// analysis LytHouse already produces. Rules + overrides persist in localStorage.
import { loadReport } from './repoCache';

const LS = 'lh_policies_v1';

// Rule catalog. Each rule evaluates the discovery report `r` -> { pass, detail }.
export const RULE_CATALOG = [
  { id: 'no-root', label: 'Containers must not run as root', category: 'Container Security', def: true, evaluate: (r) => ok(!hasCat(r, 'Container security'), 'A container runs as root.') },
  { id: 'no-secrets', label: 'No secrets committed to source control', category: 'Secrets', def: true, evaluate: (r) => ok(!hasCat(r, 'Secrets'), 'A committed secret / .env was found.') },
  { id: 'immutable-tags', label: 'Container images must use immutable tags', category: 'Reproducibility', def: true, evaluate: (r) => ok(!hasCat(r, 'Reproducibility'), 'A mutable / :latest image tag is in use.') },
  { id: 'ci-scan', label: 'CI must run security scanning', category: 'Pipeline', def: true, evaluate: (r) => ok(!hasCat(r, 'Pipeline security'), 'No security scanning step in CI.') },
  { id: 'approval-gate', label: 'Production requires an approval gate', category: 'Governance', def: true, evaluate: (r) => ok(!hasCat(r, 'Governance'), 'No production approval gate in CI.') },
  { id: 'observability', label: 'Observability must be configured', category: 'Reliability', def: false, evaluate: (r) => ok((r.monitoring || []).length > 0, 'No monitoring/observability detected.') },
  { id: 'min-readiness', label: 'Minimum release readiness', category: 'Readiness', def: true, threshold: 70, evaluate: (r, t) => ok((r.overall ?? 0) >= (t ?? 70), `Readiness ${r.overall ?? 0}% is below the ${t ?? 70}% threshold.`) },
  { id: 'no-friday', label: 'No deployments on Fridays', category: 'Change Management', def: false, evaluate: () => ok(new Date().getDay() !== 5, 'Today is Friday — deployments are restricted.') },
];

function ok(pass, failDetail) { return { pass: !!pass, detail: pass ? 'Compliant' : failDetail }; }
function hasCat(r, cat) { return (r?.concerns || []).some((c) => c.cat === cat); }

export function loadPolicies() {
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(LS) || '{}'); } catch {}
  return RULE_CATALOG.map((rule) => ({ ...rule, enabled: saved[rule.id]?.enabled ?? rule.def, threshold: saved[rule.id]?.threshold ?? rule.threshold }));
}
export function savePolicy(id, patch) {
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(LS) || '{}'); } catch {}
  saved[id] = { ...saved[id], ...patch };
  try { localStorage.setItem(LS, JSON.stringify(saved)); } catch {}
}

// Evaluate active policies against a project's cached analysis.
export function evaluateProject(project) {
  const cached = loadReport('discovery', project);
  if (!cached || !cached.data) return { analyzed: false, results: [], pass: 0, fail: 0 };
  const r = cached.data;
  const policies = loadPolicies().filter((p) => p.enabled);
  const results = policies.map((p) => { const res = p.evaluate(r, p.threshold); return { id: p.id, label: p.label, category: p.category, ...res }; });
  return { analyzed: true, results, pass: results.filter((x) => x.pass).length, fail: results.filter((x) => !x.pass).length };
}
