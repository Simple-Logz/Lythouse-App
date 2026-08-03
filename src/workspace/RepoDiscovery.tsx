// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import {
  Loader as Loader2, Check, ArrowRight, Shield, Boxes, Database, AlertTriangle,
  Globe, Network, Cloud, TrendingUp, XCircle, CheckCircle2, Clock, GitBranch, ShieldAlert,
  Sparkles, Server, ChevronDown,
} from 'lucide-react';
import { InfoHint } from '../lib/ui';
import { supabase } from '../lib/supabase';
import { buildFixPlan, guidedFrom, createFixPR } from './remediation';
import { DetailedFindings } from './DetailedFindings';
import { getTree, getFile, ERROR_TEXT, loadReport, saveReport, clearReport, getHeadSha, getCompare } from './repoCache';
import { loadSettings } from './releaseSettings';

// Resolve a commit author to a REGISTERED LytHouse team member only. A raw git
// identity is never surfaced — unknown authors are shown as a neutral generic
// label, so nobody's tooling or personal git handle is ever exposed.
const GENERIC_AUTHOR = 'Third-Party App';
function resolveAuthor(commit, memberMap) {
  const keys = [commit?.authorEmail, commit?.authorLogin].filter(Boolean).map((s) => String(s).toLowerCase());
  for (const k of keys) { if (memberMap && memberMap[k]) return memberMap[k]; }
  return GENERIC_AUTHOR;
}

// Structural inventory from the file tree (no content needed).
function analyze(paths) {
  const has = (re) => paths.some((p) => re.test(p));
  const count = (re) => paths.filter((p) => re.test(p)).length;

  const EXT = [
    { re: /\.go$/, l: 'Go' }, { re: /\.tsx?$/, l: 'TypeScript' }, { re: /\.jsx?$/, l: 'JavaScript' },
    { re: /\.py$/, l: 'Python' }, { re: /\.rb$/, l: 'Ruby' }, { re: /\.rs$/, l: 'Rust' },
    { re: /\.java$/, l: 'Java' }, { re: /\.php$/, l: 'PHP' }, { re: /\.cs$/, l: 'C#' }, { re: /\.(ya?ml)$/, l: 'YAML' },
  ];
  const lc = {}; let cf = 0;
  paths.forEach((p) => { for (const { re, l } of EXT) { if (re.test(p)) { lc[l] = (lc[l] || 0) + 1; cf++; break; } } });
  const langs = Object.entries(lc).sort((a, b) => b[1] - a[1]).map(([l, c]) => ({ l, pct: Math.max(1, Math.round((c / Math.max(1, cf)) * 100)) })).slice(0, 5);

  const dockerfiles = count(/(^|\/)Dockerfile/i);
  const tf = count(/\.tf$/);
  const k8s = count(/(k8s|kubernetes|manifests?|deploy(ments?)?|overlays?|base)\/.*\.ya?ml$/i);
  const helm = count(/(^|\/)Chart\.ya?ml$/) + (has(/\/(charts|helm)\//i) ? 1 : 0);
  const ghActions = count(/\.github\/workflows\/[^/]+\.ya?ml$/);
  const gitlabCI = has(/(^|\/)\.gitlab-ci\.ya?ml$/), jenkins = has(/(^|\/)Jenkinsfile$/i), circleci = has(/(^|\/)\.circleci\//);
  const compose = count(/(^|\/)docker-compose[^/]*\.ya?ml$|(^|\/)compose\.ya?ml$/i);

  const monitoring = [];
  if (has(/opentelemetry|otel/i)) monitoring.push('OpenTelemetry');
  if (has(/prometheus/i)) monitoring.push('Prometheus');
  if (has(/grafana/i)) monitoring.push('Grafana');
  if (has(/jaeger/i)) monitoring.push('Jaeger');
  const cloud = [];
  if (has(/aws|eks|ecr|s3|lambda|ecs|dynamodb/i)) cloud.push('AWS');
  if (has(/gcp|gke|cloudrun/i)) cloud.push('GCP');
  if (has(/azure|aks|acr/i)) cloud.push('Azure');
  const stores = [];
  ['Redis|redis', 'Kafka|kafka', 'PostgreSQL|postgres', 'MySQL|mysql', 'MongoDB|mongo', 'RabbitMQ|rabbitmq'].forEach((s) => { const [name, re] = s.split('|'); if (has(new RegExp(re, 'i'))) stores.push(name); });
  const envs = [];
  if (has(/(^|\/)(dev|development)(\/|\.|-|$)/i)) envs.push('Development');
  if (has(/(^|\/)(staging|stage)(\/|\.|-|$)/i)) envs.push('Staging');
  if (has(/(^|\/)(prod|production)(\/|\.|-|$)/i)) envs.push('Production');

  const sd = new Set();
  paths.filter((p) => /(^|\/)Dockerfile/i.test(p)).forEach((p) => sd.add(p.split('/').slice(0, -1).join('/') || 'root'));
  paths.forEach((p) => { const m = p.match(/^(services|apps|cmd|packages|microservices|src\/services)\/([^/]+)\//); if (m) sd.add(m[2]); });
  const serviceNames = [...sd].map((d) => d.split('/').pop()).filter((n) => n && n !== 'root' && n !== '.').slice(0, 8);
  const services = Math.max(sd.size, dockerfiles, serviceNames.length);

  const orchestration = k8s > 0 || helm ? 'Kubernetes' : compose > 0 ? 'Docker Compose' : '—';
  const ci = ghActions > 0 ? 'GitHub Actions' : gitlabCI ? 'GitLab CI' : jenkins ? 'Jenkins' : circleci ? 'CircleCI' : '—';
  const container = dockerfiles > 0 ? 'Docker' : '—';
  const infra = tf > 0 ? 'Terraform' : '—';
  const appType = (k8s > 0 && dockerfiles > 2) || services > 3 ? 'Cloud-Native Microservices' : dockerfiles > 0 || compose > 0 ? 'Containerized Application' : (langs[0]?.l ? `${langs[0].l} Application` : 'Application');

  // Inventory (partitions every file)
  const CATS = [
    { key: 'Documentation', re: /\.(md|mdx|rst|adoc|txt)$/i, relevant: false },
    { key: 'Kubernetes', re: /(k8s|kubernetes|manifests?|deploy(ments?)?|overlays?|base)\/.*\.ya?ml$/i, relevant: true },
    { key: 'Helm', re: /(^|\/)(Chart\.ya?ml|values[^/]*\.ya?ml)$|\/(charts|helm)\/.*\/templates\//i, relevant: true },
    { key: 'Terraform', re: /\.tf(vars)?$/i, relevant: true },
    { key: 'Containers', re: /(^|\/)(Dockerfile|\.dockerignore)|docker-compose[^/]*\.ya?ml$|(^|\/)compose\.ya?ml$/i, relevant: true },
    { key: 'CI/CD', re: /\.github\/workflows\/|(^|\/)\.gitlab-ci\.ya?ml$|(^|\/)Jenkinsfile$|(^|\/)\.circleci\//i, relevant: true },
    { key: 'Source code', re: /\.(go|tsx?|jsx?|py|rb|rs|java|php|cs|kt|swift|scala|c|cc|cpp|h|hpp|vue|svelte|proto)$/i, relevant: true },
    { key: 'Configuration', re: /\.(ya?ml|json|toml|ini|env|conf|cfg|config|properties|xml|lock|sh|bash)$|(^|\/)(\.env[^/]*|Makefile|\.gitignore)$/i, relevant: true },
  ];
  const b = {}; CATS.forEach((c) => (b[c.key] = 0)); b['Other / assets'] = 0;
  paths.forEach((p) => { const c = CATS.find((c) => c.re.test(p)); b[c ? c.key : 'Other / assets']++; });
  const relevant = CATS.filter((c) => c.relevant).reduce((s, c) => s + b[c.key], 0);
  const inventory = { total: paths.length, relevant, ignored: paths.length - relevant, buckets: [...CATS.map((c) => ({ key: c.key, n: b[c.key] })), { key: 'Other / assets', n: b['Other / assets'] }].filter((x) => x.n > 0) };

  const detected = [];
  if (k8s > 0) detected.push('Kubernetes'); if (tf > 0) detected.push('Terraform'); if (ci !== '—') detected.push(ci);
  if (dockerfiles > 0) detected.push('Docker'); if (helm > 0) detected.push('Helm'); monitoring.forEach((m) => detected.push(m)); cloud.forEach((c) => detected.push(c));

  return { appType, services, serviceNames, langs, infra, container, orchestration, ci, cloud, monitoring, stores, envs, detected, inventory,
    counts: { files: paths.length, services, dockerfiles, tf, k8s, ghActions: ghActions || (gitlabCI || jenkins ? 1 : 0), helm, compose } };
}

// Opinions + maturity, grounded in real detected signals (some need content).
function deriveInsights(r, dockers, wfs, paths) {
  const has = (re) => paths.some((p) => re.test(p));
  const strengths = [], concerns = [];
  const inspectedDockers = dockers.length, inspectedWf = wfs.length;

  let rootImages = 0, latestTags = 0;
  dockers.forEach(({ c }) => {
    const nonRoot = /^\s*USER\s+(?!root\s*$)\S+/mi.test(c);
    if (!nonRoot) rootImages++;
    if (/^FROM\s+\S+:latest/mi.test(c) || /^FROM\s+[^:\s@]+\s*(as\s+\w+)?\s*$/mi.test(c)) latestTags++;
  });
  if (inspectedDockers > 0) {
    if (rootImages > 0) concerns.push({ sev: 'high', cat: 'Container security', text: `${rootImages} of ${inspectedDockers} inspected images run as root — this increases the blast radius of a container compromise and typically violates production security policy.` });
    else strengths.push('Container images drop root privileges.');
    if (latestTags > 0) concerns.push({ sev: 'medium', cat: 'Reproducibility', text: `${latestTags} image(s) build from mutable/':latest' base tags, so builds aren't reproducible.` });
  }

  let hasGate = false, hasSecScan = false;
  wfs.forEach(({ c }) => {
    if (/environment:\s*(\n\s*name:\s*)?["']?prod/i.test(c)) hasGate = true;
    if (/trivy|snyk|codeql|semgrep|grype|checkov|tfsec|gitleaks/i.test(c)) hasSecScan = true;
  });
  if (inspectedWf > 0) {
    if (!hasGate) concerns.push({ sev: 'high', cat: 'Governance', text: 'No production approval gate found in your CI workflows — a merged commit can currently reach production automatically.' });
    else strengths.push('Production deployments require an approval gate.');
    if (hasSecScan) strengths.push('CI runs automated security scanning.');
    else concerns.push({ sev: 'medium', cat: 'Pipeline security', text: 'No security scanning step (Trivy / Snyk / CodeQL / etc.) detected in CI.' });
  }

  if (has(/(^|\/)\.env($|\.)/i)) concerns.push({ sev: 'high', cat: 'Secrets', text: 'A committed .env file is present — secrets should never live in source control.' });
  if (r.counts.k8s > 0) {
    if (!has(/poddisruptionbudget|(^|\/)pdb[-.]/i)) concerns.push({ sev: 'medium', cat: 'Resilience', text: 'Kubernetes workloads were found but no PodDisruptionBudget — services may take avoidable downtime during node maintenance.' });
    if (has(/horizontalpodautoscaler|(^|\/)hpa[-.]/i)) strengths.push('Horizontal Pod Autoscaling is configured.');
  }
  if ((r.counts.helm > 0 && r.counts.k8s > 0) || (r.counts.compose > 0 && r.counts.k8s > 0)) concerns.push({ sev: 'low', cat: 'Consistency', text: 'Multiple deployment mechanisms detected (raw manifests + Helm/Compose) — this can produce inconsistent releases.' });
  if (r.stores.length === 1) concerns.push({ sev: 'low', cat: 'Single point of failure', text: `Multiple services appear to depend on a single ${r.stores[0]} — worth confirming it has failover before a major release.` });

  if (r.infra === 'Terraform') strengths.push('Infrastructure is managed as code (Terraform).');
  if (r.monitoring.length >= 2) strengths.push(`Centralized observability (${r.monitoring.slice(0, 3).join(', ')}).`);
  if (r.orchestration === 'Kubernetes') strengths.push('Modern Kubernetes-based architecture.');
  if (r.container === 'Docker') strengths.push('Workloads are containerized.');

  const clamp = (n) => Math.max(20, Math.min(98, Math.round(n)));
  const architecture = clamp(55 + (r.services > 3 ? 15 : 0) + (r.infra === 'Terraform' ? 12 : 0) + (r.container === 'Docker' ? 8 : 0) + (r.orchestration === 'Kubernetes' ? 12 : 0));
  const security = clamp(76 - rootImages * 9 - (has(/(^|\/)\.env($|\.)/i) ? 15 : 0) - latestTags * 4 + (hasSecScan ? 10 : 0) + (inspectedDockers > 0 && rootImages === 0 ? 8 : 0));
  const deployAuto = clamp(50 + (r.ci !== '—' ? 25 : 0) + (hasGate ? 18 : 0) + (r.counts.ghActions > 1 ? 7 : 0));
  const observability = clamp(44 + r.monitoring.length * 16);
  const dr = clamp(44 + (has(/poddisruptionbudget|(^|\/)pdb/i) ? 18 : 0) + (has(/horizontalpodautoscaler|(^|\/)hpa/i) ? 15 : 0) + (r.counts.helm > 0 ? 12 : 0) + (has(/backup|velero|snapshot/i) ? 12 : 0));
  const opsReady = clamp(50 + (has(/readme/i) ? 12 : 0) + (r.counts.helm > 0 ? 12 : 0) + (has(/runbook|playbook/i) ? 10 : 0) + (r.monitoring.length ? 10 : 0));
  const op = (s) => s >= 88 ? 'Excellent' : s >= 75 ? 'Mature' : s >= 65 ? 'Moderate' : s >= 50 ? 'Needs improvement' : 'Weak';
  const areas = [
    { k: 'Architecture', s: architecture }, { k: 'Security', s: security }, { k: 'Deployment Automation', s: deployAuto },
    { k: 'Observability', s: observability }, { k: 'Disaster Recovery', s: dr }, { k: 'Operational Readiness', s: opsReady },
  ].map((a) => ({ ...a, op: op(a.s) }));
  const overall = Math.round(areas.reduce((s, a) => s + a.s, 0) / areas.length);

  const blockers = concerns.filter((c) => c.sev === 'high').length;
  const warnings = concerns.filter((c) => c.sev === 'medium').length;
  const opportunities = concerns.filter((c) => c.sev === 'low').length;
  const totalIssues = blockers + warnings + opportunities;
  const recommendation = blockers > 0
    ? { verdict: 'Release Blocked', status: 'BLOCKED', tone: 'red', text: 'Resolve the blocking issues before promoting this release. Release approval is unavailable until they are cleared.' }
    : warnings > 0
    ? { verdict: 'Approval Required', status: 'REVIEW', tone: 'amber', text: 'No hard blockers. Review the open risks before promoting this release.' }
    : { verdict: 'Cleared for Release', status: 'CLEARED', tone: 'green', text: 'No blocking issues detected. Cleared to proceed.' };

  // ── Business consequence layer — issue title, owner, ETA, impact ──
  const META = {
    'Secrets': { label: 'Secrets in Source Control', impact: 'Credential exposure — unauthorized access to production systems and data.', owner: 'Security', eta: '15 min', etaMin: 15, delta: 12, fix: 'Remove committed .env, rotate secrets' },
    'Container security': { label: 'Containers Running as Root', impact: 'Privilege escalation — a compromised container can reach adjacent services and credentials.', owner: 'Platform', eta: '30 min', etaMin: 30, delta: 9, fix: 'Run containers as non-root' },
    'Governance': { label: 'Production Approval Missing', impact: 'Policy violation — a merged commit can reach production without sign-off.', owner: 'DevOps', eta: '10 min', etaMin: 10, delta: 6, fix: 'Add production approval gate' },
    'Pipeline security': { label: 'No CI Security Scanning', impact: 'Vulnerabilities can ship undetected without automated scanning.', owner: 'DevOps', eta: '20 min', etaMin: 20, delta: 5, fix: 'Add security scanning to CI' },
    'Reproducibility': { label: 'Mutable Image Tags', impact: 'Non-deterministic builds and unreliable rollbacks.', owner: 'Platform', eta: '15 min', etaMin: 15, delta: 4, fix: 'Pin image base tags' },
    'Resilience': { label: 'Missing PodDisruptionBudgets', impact: 'Avoidable downtime during node failure or maintenance.', owner: 'SRE', eta: '25 min', etaMin: 25, delta: 5, fix: 'Add PodDisruptionBudgets' },
    'Consistency': { label: 'Inconsistent Deployment Strategy', impact: 'Environment drift and inconsistent releases.', owner: 'Platform', eta: '30 min', etaMin: 30, delta: 3, fix: 'Consolidate deployment strategy' },
    'Single point of failure': { label: 'Single Datastore Dependency', impact: 'A failure in the shared dependency could affect a large share of the platform.', owner: 'SRE', eta: '—', etaMin: 20, delta: 5, fix: 'Add datastore failover' },
  };
  const sensitive = r.serviceNames.filter((n) => /pay|checkout|billing|order|auth|identity|user|account|login|cart/i.test(n)).slice(0, 3);
  concerns.forEach((c) => {
    const m = META[c.cat] || { label: c.cat, impact: 'Increases operational risk for this release.', owner: 'Platform', eta: '20 min', etaMin: 20, delta: 4, fix: `Address ${c.cat.toLowerCase()}` };
    Object.assign(c, m, { likelihood: c.sev === 'high' ? 'High' : c.sev === 'medium' ? 'Medium' : 'Low',
      affected: (/security|secret|failure/i.test(c.cat) && sensitive.length) ? sensitive : null });
  });
  const timeToReady = concerns.filter((c) => c.sev === 'high').reduce((s, c) => s + (c.etaMin || 20), 0);

  // ── AI prediction (transparent heuristics off readiness + findings) ──
  const clampP = (n) => Math.max(2, Math.min(60, Math.round(n)));
  const rollbackProb = clampP(4 + blockers * 7 + warnings * 3 + (security < 60 ? 8 : 0));
  const successProb = 100 - rollbackProb;
  const blockerDelta = concerns.filter((c) => c.sev === 'high').reduce((s, c) => s + c.delta, 0);
  const afterReadiness = Math.min(96, overall + blockerDelta);
  const afterRollback = Math.max(2, Math.min(rollbackProb, 4 + warnings * 3));
  const incident = rollbackProb >= 30 ? 'High' : rollbackProb >= 15 ? 'Medium' : 'Low';
  const expectedTime = 6 + Math.min(18, Math.round(r.services / 3));
  const prediction = { successProb, rollbackProb, incident, expectedTime, mostLikely: (concerns.find((c) => c.sev === 'high') || concerns[0])?.cat || null };

  // ── Prioritized quick wins & projection ──
  const priorities = [...concerns].sort((a, b) => b.delta - a.delta).slice(0, 3).map((c) => ({ fix: c.fix, delta: c.delta, eta: c.eta }));
  const projection = {
    readiness: [overall, afterReadiness],
    rollback: [rollbackProb, afterRollback],
    confidence: [successProb, Math.min(96, successProb + (rollbackProb - afterRollback))],
  };

  // ── Release summary (paste-able, platform voice — no first person) ──
  const topStrength = (strengths[0] || 'Solid engineering practices').replace(/\.$/, '');
  const topConcern = concerns.find((c) => c.sev === 'high') || concerns[0];
  const narrative = `${r.appType} platform. ${topStrength}${r.monitoring.length >= 2 ? '; centralized observability and automated CI/CD in place' : ''}. ` +
    (totalIssues
      ? `${blockers + warnings} issue${blockers + warnings === 1 ? '' : 's'} increase operational risk. Highest priority: ${topConcern ? topConcern.label : 'configuration gap'}. ` +
        (blockerDelta ? `Resolving the blockers raises release readiness from ${overall}% to ~${afterReadiness}% and lowers estimated rollback probability from ${rollbackProb}% to below ${afterRollback}%.` : '')
      : 'No material risks detected. Release cleared to proceed.');

  return { strengths: [...new Set(strengths)], concerns, areas, overall, summary: { blockers, warnings, opportunities }, recommendation,
    prediction, priorities, projection, narrative, timeToReady, inspected: { dockers: inspectedDockers, workflows: inspectedWf } };
}

const STEPS = ['Repository indexed', 'Services detected', 'Containers inspected', 'CI/CD pipelines parsed', 'Security posture assessed', 'Platform maturity scored', 'Risks evaluated', 'Assessment compiled'];

// ── Change-window classification ────────────────────────────────────────────
// Groups changed files by category, determines blast radius, and decides how
// the change affects the last verified release decision. Runs purely on the
// filenames GitHub's compare API returns — no fabricated telemetry.
const CHANGE_GROUPS = [
  { key: 'secrets', label: 'Secrets / credentials', re: /(^|\/)\.env($|\.)|(^|\/)[^/]*secret[^/]*\.(ya?ml|json|env)$|(^|\/)credentials?\.(json|ya?ml)$/i, functional: true },
  { key: 'db', label: 'Database migrations', re: /(^|\/)migrations?\/|(^|\/)migrate\/|\.sql$/i, functional: true },
  { key: 'tests', label: 'Tests', re: /(^|\/)(tests?|__tests__|spec|e2e)\/|[._-](test|spec)\.[a-z]+$|_test\.[a-z]+$/i, functional: false },
  { key: 'docs', label: 'Documentation', re: /\.(md|mdx|rst|adoc|txt)$|(^|\/)docs?\/|(^|\/)(LICENSE|CHANGELOG|CODEOWNERS)[^/]*$/i, functional: false },
  { key: 'deps', label: 'Dependencies', re: /(^|\/)(package(-lock)?\.json|yarn\.lock|pnpm-lock\.ya?ml|go\.(mod|sum)|requirements[^/]*\.txt|Pipfile(\.lock)?|poetry\.lock|Gemfile(\.lock)?|pom\.xml|build\.gradle[^/]*|Cargo\.(toml|lock)|composer\.(json|lock))$/i, functional: true },
  { key: 'cicd', label: 'CI/CD', re: /\.github\/workflows\/|(^|\/)\.gitlab-ci\.ya?ml$|(^|\/)Jenkinsfile$|(^|\/)\.circleci\//i, functional: true },
  { key: 'containers', label: 'Containers', re: /(^|\/)(Dockerfile|\.dockerignore)|docker-compose[^/]*\.ya?ml$|(^|\/)compose\.ya?ml$/i, functional: true },
  { key: 'k8s', label: 'Kubernetes', re: /(k8s|kubernetes|manifests?|deploy(ments?)?|overlays?|helm|charts?)\/.*\.ya?ml$|(^|\/)(Chart\.ya?ml|values[^/]*\.ya?ml)$/i, functional: true },
  { key: 'infra', label: 'Infrastructure (IaC)', re: /\.tf(vars)?$/i, functional: true },
  { key: 'app', label: 'Application code', re: /\.(go|tsx?|jsx?|py|rb|rs|java|php|cs|kt|swift|scala|c|cc|cpp|h|hpp|vue|svelte|proto|sh|bash)$/i, functional: true },
  { key: 'config', label: 'Configuration', re: /\.(ya?ml|json|toml|ini|conf|cfg|config|properties|xml)$|(^|\/)(Makefile|\.gitignore)$/i, functional: true },
];

function classifyChanges(files) {
  const items = (files || []).map((f) => (typeof f === 'string' ? { filename: f, status: 'modified' } : f));
  const groups = {};
  items.forEach((f) => {
    const g = CHANGE_GROUPS.find((c) => c.re.test(f.filename));
    const key = g ? g.key : 'other';
    (groups[key] || (groups[key] = { key, label: g ? g.label : 'Other / assets', functional: g ? g.functional : false, files: [] })).files.push(f);
  });
  const grouped = Object.values(groups).sort((a, b) => b.files.length - a.files.length);
  const names = items.map((f) => f.filename);
  const any = (re) => names.filter((n) => re.test(n));

  // Sensitive changes that suspend a prior release approval outright.
  const blockers = [];
  if (groups.secrets) blockers.push({ label: 'Secrets or credentials changed', files: groups.secrets.files.map((f) => f.filename) });
  if (groups.db) blockers.push({ label: 'Database migration(s) changed', files: groups.db.files.map((f) => f.filename) });
  const iam = any(/\.tf(vars)?$/i).filter((n) => /(iam|policy|policies|role|rbac)/i.test(n));
  if (iam.length) blockers.push({ label: 'IAM / access-policy changed', files: iam });
  const k8sSec = any(/(rbac|networkpolicy|podsecurity|psp|securitycontext|serviceaccount|clusterrole|secret)/i).filter((n) => /\.ya?ml$/i.test(n));
  if (k8sSec.length) blockers.push({ label: 'Kubernetes security manifest changed', files: k8sSec });
  const prodWf = any(/\.github\/workflows\/[^/]*\.ya?ml$/i).filter((n) => /(prod|production|release|deploy)/i.test(n));
  if (prodWf.length) blockers.push({ label: 'Production deployment workflow changed', files: prodWf });

  const functionalGroups = grouped.filter((g) => g.functional && g.key !== 'other');
  const state = blockers.length ? 'blocker' : functionalGroups.length ? 'assess' : 'low';

  // Canonical areas — the "evidence" that is either still trustworthy or now stale.
  const AREA_DEFS = [
    { key: 'app', label: 'Application' }, { key: 'deps', label: 'Dependencies' },
    { key: 'containers', label: 'Containers' }, { key: 'k8s', label: 'Kubernetes' },
    { key: 'infra', label: 'Infrastructure' }, { key: 'cicd', label: 'CI/CD' },
    { key: 'secrets', label: 'Secrets' }, { key: 'db', label: 'Database' },
  ];
  const areas = AREA_DEFS.map((a) => ({ ...a, touched: !!groups[a.key], count: groups[a.key]?.files.length || 0 }));

  // Which review dimensions the change touches — with the evidence for each.
  const secLabels = [
    ...(groups.secrets ? ['secrets'] : []), ...(groups.deps ? ['dependencies'] : []),
    ...(groups.containers ? ['container images'] : []), ...(iam.length ? ['IAM / access policy'] : []),
    ...(k8sSec.length ? ['Kubernetes security manifests'] : []),
  ];
  const platLabels = [
    ...(groups.infra ? ['Terraform / IaC'] : []), ...(groups.k8s ? ['Kubernetes manifests'] : []),
    ...(groups.containers ? ['container images'] : []), ...(groups.cicd ? ['CI/CD pipelines'] : []),
  ];
  const appLabels = [...(groups.app ? ['application code'] : []), ...(groups.db ? ['database migrations'] : [])];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const scopeImpact = [
    { key: 'security', scope: 'Security', touched: secLabels.length > 0, reason: secLabels.length ? `${cap(secLabels.join(', '))} changed.` : 'No security-related files changed.' },
    { key: 'platform', scope: 'Infrastructure', touched: platLabels.length > 0, reason: platLabels.length ? `${cap(platLabels.join(', '))} changed.` : 'No infrastructure, Kubernetes or pipeline changes.' },
    { key: 'application', scope: 'Application', touched: appLabels.length > 0, reason: appLabels.length ? `${cap(appLabels.join(', '))} changed.` : 'No application code changed.' },
  ];

  return { grouped, blockers, state, scopeImpact, areas,
    affected: functionalGroups.map((g) => g.label),
    unaffected: grouped.filter((g) => !g.functional).map((g) => g.label) };
}

// Services touched by the change, inferred from file paths (monorepo layouts +
// Dockerfile directories + known service names from the last assessment).
function affectedServices(files, known) {
  const names = new Set();
  (files || []).forEach((f) => {
    const p = typeof f === 'string' ? f : f.filename;
    const m = p.match(/^(services|apps|cmd|packages|microservices|src\/services)\/([^/]+)\//);
    if (m) names.add(m[2]);
    const d = p.match(/(^|\/)([^/]+)\/Dockerfile/i);
    if (d && d[2] && d[2] !== '.') names.add(d[2]);
  });
  (known || []).forEach((sn) => {
    if ((files || []).some((f) => { const p = typeof f === 'string' ? f : f.filename; return p.includes(`/${sn}/`) || p.startsWith(`${sn}/`); })) names.add(sn);
  });
  return [...names];
}

// Transparent confidence penalty — how much the previously-computed deployment
// confidence is discounted while the changed areas are unvalidated. Weights are
// fixed and visible; nothing here is telemetry.
const AREA_WEIGHT = { secrets: 26, db: 20, infra: 11, k8s: 11, deps: 9, containers: 8, cicd: 8, app: 6, config: 3, other: 2 };
function confidencePenalty(cx) {
  if (cx.state === 'low') return 0;
  let p = 0;
  cx.areas.forEach((a) => { if (a.touched) p += AREA_WEIGHT[a.key] || 5; });
  return Math.min(42, p);
}

const CHANGE_STATE = {
  blocker: {
    tone: 'bg-[#fde3e3] border-[#f5a3a3]', title: 'text-[#b3261e]', icon: 'text-[#d61f1f]', bar: '#d61f1f',
    heading: 'Release approval suspended', chipCls: 'bg-[#fde3e3] text-[#d61f1f] border border-[#f5a3a3]', chip: 'Immediate blocker',
    line: 'These changes invalidate the previous release decision — re-assess before promoting.',
  },
  assess: {
    tone: 'bg-[#fff7e9] border-[#f9c777]', title: 'text-[#8a5a00]', icon: 'text-[#e07600]', bar: '#e07600',
    heading: 'Assessment out of date', chipCls: 'bg-[#fff0d9] text-[#e07600] border border-[#f9c777]', chip: 'Assessment required',
    line: 'The current release decision may no longer be valid.',
  },
  low: {
    tone: 'bg-[#eef4ff] border-[#b9cffb]', title: 'text-[#1e40af]', icon: 'text-[#2f66e0]', bar: '#2f66e0',
    heading: 'Minor changes since last assessment', chipCls: 'bg-[#e3f7ea] text-[#0f9a4c] border border-[#9adcb4]', chip: 'Low impact',
    line: 'Only documentation or tests changed — the previous release decision remains valid.',
  },
};

function cap1(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function timeAgo(ts) {
  if (!ts) return null;
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function RepoDiscovery({ project, onRunValidation, onConnect, hadFailure }) {
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [pr, setPr] = useState({ state: 'idle', url: null, error: null, applied: [] });
  const [nonce, setNonce] = useState(0);
  const [stale, setStale] = useState(null);
  const [changeOpen, setChangeOpen] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [memberMap, setMemberMap] = useState({});
  const timer = useRef(null);

  // Load registered team members (best-effort). Keyed by lowercased email so a
  // commit author can be matched to a real member; unmatched → generic label.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const wid = localStorage.getItem('sandbox.activeWs');
        if (!wid) return;
        const { data } = await supabase.from('workspace_members').select('profiles(email,full_name)').eq('workspace_id', wid);
        if (!alive || !data) return;
        const map = {};
        data.forEach((m) => {
          const email = m.profiles?.email;
          const name = m.profiles?.full_name || (email ? email.split('@')[0] : null);
          if (email && name) map[email.toLowerCase()] = name;
        });
        setMemberMap(map);
      } catch { /* leave map empty → everyone shows as generic */ }
    })();
    return () => { alive = false; };
  }, []);
  const reanalyze = () => { clearReport('discovery', project); clearReport('findings', project); clearReport('validation', project); setResult(null); setError(null); setLoading(true); setRevealed(0); setNonce((n) => n + 1); };

  useEffect(() => {
    let alive = true;
    // Persistent cache: if this project was analyzed before, show it instantly.
    const cached = loadReport('discovery', project);
    if (cached && cached.data) {
      setResult(cached.data); setRevealed(STEPS.length); setLoading(false);
      // Continuous change detection: compare the analyzed commit to HEAD now.
      // Honors the per-project "Watch for repository changes" setting.
      if (!loadSettings(project).watchChanges) return () => { alive = false; };
      (async () => {
        const head = await getHeadSha(project);
        const analyzedSha = cached.data.analyzedSha;
        if (head && analyzedSha && head !== analyzedSha) {
          const cmp = await getCompare(project, analyzedSha, head);
          if (alive) setStale({
            head,
            since: cached.data.analyzedAt || null,
            commits: cmp?.commits || [],
            files: cmp?.files || [],
            permalink: cmp?.permalink || null,
          });
        }
      })();
      return () => { alive = false; };
    }
    timer.current = setInterval(() => setRevealed((r) => Math.min(STEPS.length, r + 1)), 320);
    (async () => {
      try {
        const tree = await getTree(project);
        if (tree.error) { if (alive) setError(ERROR_TEXT[tree.error]); return; }
        const paths = tree.paths;
        const base = analyze(paths);
        // Read a sample of Dockerfiles + workflows for real opinions
        const dPaths = paths.filter((p) => /(^|\/)Dockerfile/i.test(p)).slice(0, 6);
        const wPaths = paths.filter((p) => /\.github\/workflows\/[^/]+\.ya?ml$/.test(p)).slice(0, 4);
        const [dRes, wRes] = await Promise.all([
          Promise.all(dPaths.map((p) => getFile(project, p).then((c) => ({ p, c })))),
          Promise.all(wPaths.map((p) => getFile(project, p).then((c) => ({ p, c })))),
        ]);
        const insights = deriveInsights(base, dRes.filter((x) => x.c), wRes.filter((x) => x.c), paths);
        const analyzedSha = await getHeadSha(project);
        if (!alive) return;
        const full = { ...base, ...insights, allPaths: paths, analyzedSha, analyzedAt: Date.now() };
        setResult(full);
        saveReport('discovery', project, full);
      } catch (e) { if (alive) setError(e.message || 'Could not analyze the repository.'); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; clearInterval(timer.current); };
  }, [project.git_url, project.git_branch, nonce]);

  const stepsDone = revealed >= STEPS.length;
  if (loading || !stepsDone) {
    return (
      <div className="card">
        <p className="text-sm font-semibold text-navy-900 mb-4 flex items-center gap-2"><Loader2 size={15} className="animate-spin text-brand-600" />Assessing release…</p>
        <ul className="space-y-2">
          {STEPS.map((s, i) => (
            <li key={s} className={`flex items-center gap-2 text-sm transition-opacity ${i < revealed ? 'opacity-100' : 'opacity-30'}`}>
              {i < revealed ? <Check size={15} className="text-green-500" /> : <span className="h-3.5 w-3.5 rounded-full border border-gray-300" />}
              <span className={i < revealed ? 'text-navy-800' : 'text-gray-400'}>{s}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (error) {
    return (
      <div className="card border-amber-200 bg-amber-50">
        <p className="text-sm font-semibold text-amber-900 flex items-center gap-2"><AlertTriangle size={15} />Couldn't analyze the repository</p>
        <p className="text-sm text-amber-800 mt-1">{error}</p>
        <div className="mt-3"><button onClick={onRunValidation} className="btn-primary text-sm"><Shield size={14} />Run Validation anyway</button></div>
      </div>
    );
  }

  const r = result;
  const recTone = { red: 'text-[#e11d1d]', amber: 'text-[#ea7a00]', green: 'text-[#12a150]' }[r.recommendation.tone];
  const recBg = { red: 'bg-[#fde3e3] border-[#f5a3a3]', amber: 'bg-[#fff0d9] border-[#f9c777]', green: 'bg-[#e3f7ea] border-[#9adcb4]' }[r.recommendation.tone];
  const recBar = { red: '#d61f1f', amber: '#e07600', green: '#0f9a4c' }[r.recommendation.tone];
  // Vivid-but-tasteful semantic red/amber/green — explicit hex so the indigo
  // theme remap doesn't flatten these traffic-light severity signals.
  const SEV = {
    high: 'bg-[#fde3e3] text-[#d61f1f] border border-[#f5a3a3]',
    medium: 'bg-[#fff0d9] text-[#e07600] border border-[#f9c777]',
    low: 'bg-[#e3f7ea] text-[#0f9a4c] border border-[#9adcb4]',
  };
  const sevCls = (s) => SEV[s] || SEV.low;
  const scoreColor = (s) => s >= 88 ? 'text-green-600' : s >= 65 ? 'text-brand-700' : s >= 50 ? 'text-amber-600' : 'text-red-600';
  const totalIssues = r.summary.blockers + r.summary.warnings + r.summary.opportunities;

  return (
    <div className="space-y-5">
      {/* ── CONTINUOUS VALIDATION: change intelligence ───────────────────── */}
      {stale && (() => {
        const cx = classifyChanges(stale.files);
        const st = CHANGE_STATE[cx.state];
        const commitCount = stale.commits.length;
        const fileCount = stale.files.length;
        const latest = stale.commits[0]?.date ? new Date(stale.commits[0].date).getTime() : null;
        const Icon = cx.state === 'blocker' ? ShieldAlert : cx.state === 'assess' ? AlertTriangle : Check;

        // ── Prior decision → new status, with a transparent confidence delta ──
        const prevRec = r.recommendation || {};
        const prevConf = r.prediction?.successProb ?? r.overall ?? null;
        const penalty = confidencePenalty(cx);
        const nowConf = prevConf != null ? Math.max(25, prevConf - penalty) : null;
        const newStatus = cx.state === 'blocker' ? { t: 'Approval suspended', c: 'text-[#b3261e]' } : cx.state === 'assess' ? { t: 'Review required', c: 'text-[#b06a00]' } : { t: 'Still valid', c: 'text-[#0f7a3c]' };

        // ── Blast radius (all inferred from changed paths — no telemetry) ──
        const services = affectedServices(stale.files, r.serviceNames);
        const g = (k) => cx.areas.find((a) => a.key === k)?.touched;
        const present = { app: true, deps: !!g('deps'), containers: (r.counts?.dockerfiles || 0) > 0, k8s: (r.counts?.k8s || 0) > 0, infra: (r.counts?.tf || 0) > 0, cicd: r.ci && r.ci !== '—', secrets: !!g('secrets'), db: !!g('db') };
        const freshness = cx.areas.filter((a) => present[a.key] || a.touched);
        const btnLabel = cx.state === 'blocker' ? 'Revalidate now' : cx.state === 'assess' ? 'Revalidate changed components' : 'Refresh decision';

        // ── Release-engineer narrative (deterministic, grounded in the facts) ──
        const changedFn = cx.areas.filter((a) => a.touched).map((a) => a.label.toLowerCase());
        const untouched = cx.areas.filter((a) => !a.touched && present[a.key]).map((a) => a.label.toLowerCase());
        const svcPhrase = services.length ? ` in ${services.slice(0, 2).join(' and ')}${services.length > 2 ? ` and ${services.length - 2} more` : ''}` : '';
        const narrative = cx.state === 'low'
          ? `Only documentation or tests changed since your last verified assessment${svcPhrase}. Every prior validation still holds — the release decision does not need to change.`
          : `Since your last verified assessment, ${fileCount} file${fileCount === 1 ? '' : 's'} across ${changedFn.join(', ')}${svcPhrase} changed.` +
            (untouched.length ? ` ${cap1(untouched.join(', '))} ${untouched.length === 1 ? 'was' : 'were'} not modified, so ${untouched.length === 1 ? 'its' : 'their'} previous validation remains trustworthy.` : '') +
            (cx.state === 'blocker'
              ? ' Because sensitive components changed, the previous approval is suspended until they are revalidated.'
              : ` Only the changed ${changedFn.length === 1 ? 'area' : 'areas'} need revalidating before the release decision can be confirmed.`);

        const blast = [
          { l: 'Services affected', v: services.length ? String(services.length) : '—', sub: services.length ? services.slice(0, 3).join(', ') : 'None identifiable from paths', warn: services.length > 0 },
          { l: 'Infrastructure', v: g('infra') ? 'Changed' : 'Unaffected', warn: g('infra') },
          { l: 'Kubernetes', v: g('k8s') ? 'Changed' : 'Unaffected', warn: g('k8s') },
          { l: 'Secrets', v: g('secrets') ? 'Changed' : 'Unaffected', warn: g('secrets') },
          { l: 'Deployment policy', v: cx.blockers.length ? 'Review required' : 'No policy changes', warn: cx.blockers.length > 0 },
          { l: 'Rollback', v: g('db') ? 'Re-verify — migrations changed' : 'Unaffected', warn: g('db') },
        ];

        return (
          <div className={`card !p-3 border ${st.tone}`} style={{ borderLeftWidth: 4, borderLeftColor: st.bar }}>
            {/* collapsed header — always visible, click to expand */}
            <button onClick={() => setChangeOpen((v) => !v)} className="w-full flex items-center justify-between gap-3 text-left">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className={`text-sm font-bold flex items-center gap-1.5 ${st.title}`}><Icon size={15} className={st.icon} />{st.heading}</span>
                <span className={`chip text-[10px] ${st.chipCls}`}>{st.chip}</span>
                <span className="text-[11px] text-gray-500 hidden sm:inline">
                  · {commitCount || 'new'} commit{commitCount === 1 ? '' : 's'} · {fileCount} file{fileCount === 1 ? '' : 's'}
                  {penalty > 0 && prevConf != null && <> · confidence <span className="text-gray-400">{prevConf}%</span><ArrowRight size={9} className="inline mx-0.5 text-gray-300" /><span className={newStatus.c}>{nowConf}%</span></>}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span onClick={(e) => e.stopPropagation()} className="inline-flex items-center justify-center h-6 w-6 rounded-full border border-brand-200 bg-brand-50 hover:bg-brand-100 transition-colors">
                  <InfoHint align="right" text="Continuous validation. LytHouse watches your connected Git repository and detects new commits pushed after the last assessment — then tells you what changed, which review areas need revalidating, and whether your previous release decision is still valid." />
                </span>
                <span onClick={(e) => { e.stopPropagation(); reanalyze(); }} className="btn-brand text-xs cursor-pointer"><Shield size={13} />{btnLabel}</span>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${changeOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>
            {/* one-line teaser shown while collapsed */}
            {!changeOpen && (
              <p className="text-xs text-gray-600 mt-1.5">
                <span className={`font-semibold ${newStatus.c}`}>{newStatus.t}.</span> {cx.state === 'low' ? 'Docs/tests only — previous decision still valid.' : `${cap1(cx.areas.filter((a) => a.touched).map((a) => a.label.toLowerCase()).join(', '))} changed. Expand for the full impact assessment.`}
              </p>
            )}

            {changeOpen && (<div className="mt-3 space-y-3">

            {/* prior decision → new status + confidence delta */}
            <div className="grid gap-2 sm:grid-cols-3 rounded-lg border border-gray-200/70 bg-white/70 px-3 py-2">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400">Last assessed decision</div>
                <div className="text-sm font-bold text-navy-900">{prevRec.verdict || 'Assessed'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400">Status now</div>
                <div className={`text-sm font-bold ${newStatus.c}`}>{newStatus.t}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400 flex items-center gap-1">Deployment confidence<InfoHint text="The confidence from your last assessment, discounted while the changed areas remain unvalidated. The penalty is a fixed weighting of what changed — not live telemetry — and is restored when you revalidate." align="right" /></div>
                {prevConf != null ? (
                  penalty > 0
                    ? <div className="text-sm font-bold"><span className="text-gray-400">{prevConf}%</span> <ArrowRight size={11} className="inline text-gray-300" /> <span className={newStatus.c}>{nowConf}%</span></div>
                    : <div className="text-sm font-bold text-[#0f7a3c]">{prevConf}% · unchanged</div>
                ) : <div className="text-sm font-bold text-gray-400">—</div>}
              </div>
            </div>

            {/* AI narrative + verified/latest inline */}
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100"><Sparkles size={12} className="text-brand-600" /></span>
              <p className="text-[13px] text-navy-800 leading-relaxed">
                <span className="font-semibold text-brand-700">LytHouse assessment:</span> {narrative}
                <span className="text-[11px] text-gray-400"> · Verified {timeAgo(stale.since)} · latest change {timeAgo(latest)}</span>
              </p>
            </div>

            {/* explained review scopes — the freshness signal, in one row */}
            <div className="grid gap-2 sm:grid-cols-3">
              {cx.scopeImpact.map((s) => (
                <div key={s.key} className={`rounded-lg border px-3 py-2 ${s.touched ? 'border-[#f9c777] bg-[#fff7e9]' : 'border-[#9adcb4] bg-[#e3f7ea]'}`}>
                  <div className={`text-xs font-semibold flex items-center gap-1 ${s.touched ? 'text-[#b06a00]' : 'text-[#0f7a3c]'}`}>{s.touched ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}{s.scope}: {s.touched ? 'revalidate' : 'still valid'}</div>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{s.reason}</p>
                </div>
              ))}
            </div>

            {/* blast radius — compact inline pills */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
              <span className="uppercase tracking-wide text-gray-400 flex items-center gap-1"><Server size={11} />Blast radius:</span>
              {blast.map((b) => (
                <span key={b.l} className="inline-flex items-center gap-1"><span className="text-gray-400">{b.l}</span><span className={`font-semibold ${b.warn ? 'text-[#b06a00]' : 'text-[#0f7a3c]'}`}>{b.v}</span></span>
              ))}
            </div>

            {/* immediate-blocker reasons */}
            {cx.blockers.length > 0 && (
              <div className="mt-3 rounded-lg border border-[#f5a3a3] bg-[#fde3e3]/60 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#b3261e] mb-1">Why approval is suspended</p>
                <ul className="flex flex-wrap gap-x-4 gap-y-0.5">
                  {cx.blockers.map((b, i) => <li key={i} className="flex items-center gap-1.5 text-xs text-[#8a1f1a]"><XCircle size={12} className="shrink-0" />{b.label}</li>)}
                </ul>
              </div>
            )}

            {/* review-changes drawer */}
            <details className="group mt-3">
              <summary className="flex items-center gap-1.5 cursor-pointer list-none text-xs font-medium text-brand-700">
                <ArrowRight size={13} className="group-open:rotate-90 transition-transform" />Commits &amp; files
                {stale.permalink && <a href={stale.permalink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="ml-2 text-gray-400 hover:text-brand-700 hover:underline">Full diff on GitHub →</a>}
              </summary>
              <div className="mt-2 pt-2 border-t border-gray-200/70 grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Commits ({commitCount})</p>
                  <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {stale.commits.map((c) => (
                      <li key={c.sha} className="text-xs">
                        <a href={c.url || stale.permalink || '#'} target="_blank" rel="noreferrer" className="font-mono text-brand-700 hover:underline">{c.short}</a>
                        <span className="text-navy-800"> {c.message}</span>
                        <span className="block text-gray-400">{resolveAuthor(c, memberMap)}{c.date ? ` · ${timeAgo(new Date(c.date).getTime())}` : ''}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Changed files ({fileCount})</p>
                  <ul className="space-y-1 max-h-56 overflow-y-auto pr-1">
                    {stale.files.map((f, i) => (
                      <li key={i} className="text-xs flex items-center gap-1.5">
                        <span className={`shrink-0 w-14 font-medium ${f.status === 'added' ? 'text-[#0f9a4c]' : f.status === 'removed' ? 'text-[#d61f1f]' : 'text-[#e07600]'}`}>{f.status || 'modified'}</span>
                        {f.url ? <a href={f.url} target="_blank" rel="noreferrer" className="text-navy-700 hover:text-brand-700 hover:underline truncate">{f.filename}</a> : <span className="text-navy-700 truncate">{f.filename}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </details>

            </div>)}
          </div>
        );
      })()}

      {/* ── RELEASE DECISION (foldable; teaser visible when collapsed) ─────── */}
      {/* The single most consequential line on this page — given real
          visual weight instead of the same card treatment as everything
          else: a left accent bar in the verdict's own color, and the
          verdict itself set larger/bolder than any other text here. */}
      <div className={`card !p-0 border ${recBg} overflow-hidden relative`} style={{ borderLeftWidth: 4, borderLeftColor: recBar }}>
        {/* collapsed header — always visible, click to expand */}
        <button onClick={() => setDecisionOpen((v) => !v)} className="w-full text-left p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Release Decision</p>
              <div className={`text-3xl font-extrabold tracking-tight ${recTone} mt-0.5`}>{r.recommendation.verdict}</div>
              <p className="text-xs text-gray-500 mt-0.5">Release candidate · {r.appType}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`chip text-xs font-bold ${r.recommendation.tone === 'red' ? SEV.high : r.recommendation.tone === 'amber' ? SEV.medium : SEV.low}`}>{r.recommendation.status}</span>
              <ChevronDown size={18} className={`text-gray-400 transition-transform ${decisionOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>
          {/* teaser row — what to expect without unfolding */}
          {!decisionOpen && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span><span className={`font-bold ${scoreColor(r.overall)}`}>{r.overall}%</span> <span className="text-gray-500">ready</span></span>
              <span><span className={`font-bold ${r.summary.blockers ? 'text-[#d61f1f]' : 'text-[#0f9a4c]'}`}>{r.summary.blockers}</span> <span className="text-gray-500">blocker{r.summary.blockers === 1 ? '' : 's'}</span></span>
              {r.timeToReady ? <span><span className="font-bold text-navy-800">{r.timeToReady} min</span> <span className="text-gray-500">to ready</span></span> : null}
              <span className="text-brand-600 font-medium ml-auto">Details</span>
            </div>
          )}
        </button>

        {decisionOpen && (<div className="px-4 sm:px-5 pb-4">

        <div className="grid gap-2 grid-cols-3">
          {[
            { l: 'Release Readiness', v: `${r.overall}%`, c: scoreColor(r.overall), hint: 'A 0–100 score of how ready this release is to ship, averaged across architecture, security, deployment automation, observability, disaster recovery and operational readiness.' },
            { l: 'Blocking Issues', v: String(r.summary.blockers), c: r.summary.blockers ? 'text-[#d61f1f]' : 'text-[#0f9a4c]', hint: 'Findings serious enough that the release should not be promoted to production until they are resolved.' },
            { l: 'Est. Time to Ready', v: r.timeToReady ? `${r.timeToReady} min` : '—', c: 'text-navy-900', hint: 'Estimated total hands-on time to fix all blocking issues before this release can be approved.' },
          ].map((x) => (
            <div key={x.l}><div className={`text-xl font-bold ${x.c}`}>{x.v}</div><div className="text-[10px] uppercase tracking-wide text-gray-400 mt-0.5 flex items-center gap-1">{x.l}<InfoHint text={x.hint} /></div></div>
          ))}
        </div>

        <div className="mt-2.5 pt-2.5 border-t border-gray-200/70">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Recommendation</p>
          <p className="text-[13px] text-navy-800 leading-snug">{r.recommendation.text}</p>
        </div>

        {/* Why it's blocked + how to resolve — only when there are blockers */}
        {r.summary.blockers > 0 && (() => {
          const blockers = r.concerns.filter((c) => c.sev === 'high');
          return (
            <div className="mt-2.5 pt-2.5 border-t border-[#f5a3a3]/60">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-[#b3261e] mb-1.5 flex items-center gap-1.5"><AlertTriangle size={12} />Why this release is blocked ({blockers.length})</p>
              <ul className="space-y-1.5">
                {blockers.map((c, i) => (
                  <li key={i} className="rounded-lg border border-[#f5a3a3] bg-[#fde3e3]/40 px-3 py-1.5">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-navy-900">{c.label}</p>
                        <p className="text-xs text-gray-600 mt-0.5 leading-snug">{c.impact}{c.affected ? <span className="text-gray-400"> · Affects: {c.affected.join(', ')}</span> : null}</p>
                      </div>
                      <span className="text-[10px] text-gray-500 whitespace-nowrap shrink-0">{c.owner}{c.eta && c.eta !== '—' ? ` · ${c.eta}` : ''}</span>
                    </div>
                    <p className="text-xs mt-1 flex items-start gap-1.5"><ArrowRight size={12} className="text-[#0f9a4c] shrink-0 mt-0.5" /><span><span className="font-semibold text-[#0f7a3c]">Fix:</span> {c.fix}.</span></p>
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button onClick={onRunValidation} className="btn-brand text-sm"><Shield size={14} />Assess Release</button>
          {r.infra === 'Terraform' && onConnect && <button onClick={onConnect} className="btn-secondary text-sm"><Cloud size={13} />Verify {r.cloud[0] || 'cloud'} infra</button>}
          <button onClick={reanalyze} className="btn-ghost text-xs ml-auto" title="Re-read the repository and recompute">Re-analyze</button>
        </div>

        </div>)}
      </div>

      {/* ── FIX IT — the primary action when a release is blocked ─────────── */}
      {(() => {
        const fixes = buildFixPlan(r.concerns);
        const guided = guidedFrom(r.concerns);
        if (!fixes.length && !guided.length) return null;
        return (
          <div className="card border-brand-200 bg-brand-50/40">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold text-navy-900 flex items-center gap-1.5"><Shield size={14} className="text-brand-600" />AI Auto-Remediation<InfoHint text="Lythouse generates safe, additive fixes and opens a pull request on your repository. Risky in-place edits are left as guided recommendations for a human to own." /></h3>
                <p className="text-sm text-gray-600 mt-0.5">{fixes.length ? `${fixes.length} finding${fixes.length === 1 ? '' : 's'} can be fixed automatically in a pull request.` : 'No auto-fixable findings — the items below need a human decision.'}</p>
              </div>
              {fixes.length > 0 && pr.state !== 'done' && (
                <button
                  disabled={pr.state === 'running'}
                  onClick={async () => {
                    setPr({ state: 'running', url: null, error: null, applied: [] });
                    try { const res = await createFixPR({ project, fixes }); setPr({ state: 'done', url: res.url, applied: res.applied, error: null }); }
                    catch (e) { setPr({ state: 'error', url: null, applied: [], error: e.message }); }
                  }}
                  className="btn-brand text-sm shrink-0">
                  {pr.state === 'running' ? <><Loader2 size={14} className="animate-spin" />Opening PR…</> : <><ArrowRight size={14} />Generate Fix PR</>}
                </button>
              )}
            </div>
            {fixes.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {fixes.map((f) => (
                  <li key={f.cat} className="flex items-start gap-2 text-sm"><Check size={15} className="text-green-500 shrink-0 mt-0.5" /><span><span className="font-medium text-navy-800">{f.label}</span> <span className="text-gray-500">— {f.desc}</span></span></li>
                ))}
              </ul>
            )}
            {pr.state === 'done' && (
              <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm">
                <span className="font-medium text-green-800">Pull request opened.</span> <a href={pr.url} target="_blank" rel="noreferrer" className="text-brand-700 font-semibold hover:underline">Review PR →</a>
                <span className="block text-xs text-gray-500 mt-0.5">Changed: {pr.applied.join(', ')}</span>
              </div>
            )}
            {pr.state === 'error' && <div className="mt-3 rounded-lg border border-[#f5a3a3] bg-[#fde3e3] px-3 py-2.5 text-sm text-[#c0392b]">{pr.error}</div>}
            {guided.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-200/60">
                <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1.5">Guided — needs a human decision</p>
                <ul className="space-y-1">
                  {guided.map((g, i) => (<li key={i} className="flex items-start gap-2 text-sm text-gray-600"><ArrowRight size={13} className="text-gray-300 shrink-0 mt-0.5" /><span><span className="font-medium text-navy-700">{g.label}</span> — {g.hint}</span></li>))}
                </ul>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── FULL ANALYSIS (collapsed — supporting detail, one toggle) ─────── */}
      <details className="group">
        <summary className="card !py-3.5 flex items-center justify-between cursor-pointer list-none hover:bg-gray-50/60">
          <span className="text-sm font-semibold text-navy-900 flex items-center gap-1.5"><TrendingUp size={14} className="text-brand-600" />Full analysis — platform, forecast, maturity &amp; evidence</span>
          <ChevronDown size={16} className="text-gray-400 group-open:rotate-180 transition-transform" />
        </summary>
        <div className="mt-4 space-y-5">

      {/* ── PLATFORM INTELLIGENCE (terse) ────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-navy-900 mb-2">Platform Intelligence</h3>
        <div className="flex flex-wrap gap-2">
          {[`${r.appType}`, `${r.services} services`, ...r.cloud, r.orchestration, r.ci, r.infra, ...r.monitoring].filter((x) => x && x !== '—').map((x, i) => (
            <span key={i} className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-navy-700">{x}</span>
          ))}
        </div>
      </div>

      {/* ── RELEASE SUMMARY (paste-able) ─────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="text-sm font-semibold text-navy-900">Release Summary</h3>
          <button onClick={() => navigator.clipboard?.writeText(r.narrative)} className="btn-ghost text-xs">Copy</button>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">{r.narrative}</p>
      </div>

      {/* ── RELEASE FORECAST ─────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-navy-900 mb-2">Release Forecast</h3>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[
            { l: 'Deployment success', v: `${r.prediction.successProb}%`, c: r.prediction.successProb >= 85 ? 'text-[#0f9a4c]' : r.prediction.successProb >= 70 ? 'text-[#e07600]' : 'text-[#d61f1f]', hint: 'Estimated chance this release deploys cleanly with no rollback, if shipped as-is today.' },
            { l: 'Rollback probability', v: `${r.prediction.rollbackProb}%`, c: r.prediction.rollbackProb <= 10 ? 'text-[#0f9a4c]' : r.prediction.rollbackProb <= 25 ? 'text-[#e07600]' : 'text-[#d61f1f]', hint: 'Estimated chance you would need to roll this release back within the first hour after deploying.' },
            { l: 'Expected deploy time', v: `~${r.prediction.expectedTime} min`, c: 'text-navy-900', hint: 'Rough estimate of how long the deployment pipeline takes to run, based on service count and pipeline stages.' },
            { l: 'Incident risk', v: r.prediction.incident, c: r.prediction.incident === 'Low' ? 'text-[#0f9a4c]' : r.prediction.incident === 'Medium' ? 'text-[#e07600]' : 'text-[#d61f1f]', hint: 'Likelihood of a production incident if this release ships without addressing the open findings.' },
          ].map((x) => (
            <div key={x.l} className="card !p-3"><div className={`text-2xl font-bold ${x.c}`}>{x.v}</div><div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">{x.l}<InfoHint text={x.hint} /></div></div>
          ))}
        </div>
        {r.prediction.mostLikely && <p className="text-[11px] text-gray-400 mt-2">Most likely failure mode: <span className="text-gray-600">{r.prediction.mostLikely}</span>. Estimates are derived from the detected findings and maturity signals.</p>}
      </div>

      {/* ── VALIDATED CONTROLS ───────────────────────────────────────────── */}
      <div className="card">
        <h3 className="text-sm font-semibold text-navy-900 mb-2 flex items-center gap-1.5"><CheckCircle2 size={14} className="text-green-500" />Validated Controls</h3>
        {r.strengths.length ? (
          <ul className="grid gap-1.5 sm:grid-cols-2">{r.strengths.map((s, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><Check size={15} className="text-green-500 shrink-0 mt-0.5" />{s}</li>)}</ul>
        ) : <p className="text-sm text-gray-400">No controls verified yet.</p>}
      </div>

      {/* ── DEPLOYMENT RISKS ─────────────────────────────────────────────── */}
      {r.concerns.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-navy-900 mb-2 flex items-center gap-1.5"><AlertTriangle size={14} className="text-amber-500" />Deployment Risks</h3>
          <div className="card !p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100"><th className="px-4 py-2 font-medium">Risk</th><th className="px-4 py-2 font-medium">Business Impact</th><th className="px-4 py-2 font-medium">Owner</th><th className="px-4 py-2 font-medium"><span className="inline-flex items-center gap-1">Time to Fix<InfoHint text="Estimated hands-on effort to remediate this specific risk." align="right" /></span></th></tr></thead>
              <tbody>
                {r.concerns.map((c, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0 align-top">
                    <td className="px-4 py-2.5">
                      <span className={`chip text-[10px] mb-1 ${sevCls(c.sev)}`}>{c.sev === 'high' ? 'Blocker' : c.sev === 'medium' ? 'Needs Attention' : 'Optimization'}</span>
                      <div className="font-medium text-navy-800">{c.label}</div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 max-w-md">{c.impact}{c.affected ? <span className="block text-[11px] text-gray-400 mt-0.5">Potentially affects: {c.affected.join(', ')}</span> : null}</td>
                    <td className="px-4 py-2.5 text-navy-700 whitespace-nowrap">{c.owner}</td>
                    <td className="px-4 py-2.5 text-navy-700 whitespace-nowrap">{c.eta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── DETAILED FINDINGS (per-file drill-down) ──────────────────────── */}
      {r.allPaths && <DetailedFindings project={project} paths={r.allPaths} />}

      {/* ── PRIORITIZED QUICK WINS + IMPACT PROJECTION ───────────────────── */}
      {r.concerns.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card">
            <h3 className="text-sm font-semibold text-navy-900 mb-2">Recommended Actions</h3>
            <ol className="space-y-2">
              {r.priorities.map((p, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{i + 1}</span>
                  <span className="flex-1 text-sm text-navy-800">{p.fix}</span>
                  <span className="text-xs font-semibold text-green-600 whitespace-nowrap">+{p.delta} readiness</span>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{p.eta}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="card">
            <h3 className="text-sm font-semibold text-navy-900 mb-2">Projected Impact — Blockers Resolved</h3>
            <div className="space-y-2.5">
              {[
                { l: 'Deployment readiness', a: r.projection.readiness[0], b: r.projection.readiness[1], suf: '', up: true },
                { l: 'Rollback risk', a: r.projection.rollback[0], b: r.projection.rollback[1], suf: '%', up: false },
                { l: 'Deployment confidence', a: r.projection.confidence[0], b: r.projection.confidence[1], suf: '%', up: true },
              ].map((x) => (
                <div key={x.l} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{x.l}</span>
                  <span className="flex items-center gap-2"><span className="text-gray-400">{x.a}{x.suf}</span><ArrowRight size={12} className="text-gray-300" /><span className={`font-bold ${x.up ? 'text-green-600' : 'text-green-600'}`}>{x.b}{x.suf}</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── PLATFORM MATURITY ────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-navy-900 flex items-center gap-1.5"><TrendingUp size={14} className="text-brand-600" />Platform maturity<InfoHint text="Each area is scored 0–100 from signals detected in your repository (containers, CI, IaC, orchestration, observability, resilience). The overall score is their average." /></h3>
          <span className="text-sm text-gray-500">Overall <span className={`font-bold ${scoreColor(r.overall)}`}>{r.overall}/100</span></span>
        </div>
        <div className="space-y-2.5">
          {r.areas.map((a) => (
            <div key={a.k} className="flex items-center gap-3">
              <span className="w-44 shrink-0 text-sm text-navy-800">{a.k}</span>
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className={`h-full rounded-full ${a.s >= 88 ? 'bg-green-500' : a.s >= 65 ? 'bg-brand-500' : a.s >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${a.s}%` }} /></div>
              <span className={`w-10 shrink-0 text-right text-sm font-semibold ${scoreColor(a.s)}`}>{a.s}</span>
              <span className="w-36 shrink-0 text-xs text-gray-500">{a.op}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-3">Scores are derived from signals detected in your repository (containers, CI, IaC, orchestration, observability, resilience). Run the full assessment to validate them against live findings.</p>
      </div>

      {/* ── SUPPORTING EVIDENCE (glance + inventory + architecture) ──────── */}
      <details className="card group">
        <summary className="flex items-center justify-between cursor-pointer list-none">
          <span className="text-sm font-semibold text-navy-900">Evidence — platform inventory & architecture</span>
          <ArrowRight size={15} className="text-gray-400 group-open:rotate-90 transition-transform" />
        </summary>
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
          <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {[{ k: 'Application', v: r.appType }, { k: 'Services', v: String(r.services || '—') }, { k: 'Cloud', v: r.cloud.join(', ') || '—' }, { k: 'Containers', v: r.container }, { k: 'Orchestration', v: r.orchestration }, { k: 'Infrastructure', v: r.infra }, { k: 'CI/CD', v: r.ci }, { k: 'Monitoring', v: r.monitoring.join(', ') || '—' }, { k: 'Environments', v: r.envs.length ? String(r.envs.length) : '—' }].map((g) => (
              <div key={g.k} className="rounded-xl border border-gray-200 px-3 py-2.5"><div className="text-[10px] uppercase tracking-wide text-gray-400">{g.k}</div><div className="text-sm font-semibold text-navy-900 mt-0.5 leading-tight">{g.v}</div></div>
            ))}
          </div>
          {/* inferred architecture */}
          <div className="flex flex-col items-center gap-1.5 py-2">
            <ArchNode icon={<Globe size={13} />} label="Internet" /><Conn />
            {r.orchestration === 'Kubernetes' ? <><ArchNode icon={<Network size={13} />} label="Ingress / LB" /><Conn /></> : null}
            <div className="flex flex-wrap justify-center gap-2">
              {(r.serviceNames.length ? r.serviceNames.slice(0, 4) : [`${r.services} services`]).map((s) => <ArchNode key={s} icon={<Boxes size={13} />} label={s} accent />)}
              {r.serviceNames.length > 4 && <ArchNode icon={<Boxes size={13} />} label={`+${r.services - 4} more`} />}
            </div>
            {r.stores.length > 0 && <><Conn /><div className="flex flex-wrap justify-center gap-2">{r.stores.map((s) => <ArchNode key={s} icon={<Database size={13} />} label={s} />)}</div></>}
          </div>
          <div>
            <div className="text-xs font-semibold text-navy-900 mb-1.5">Repository inventory</div>
            <div className="space-y-1">
              {r.inventory.buckets.map((x) => <div key={x.key} className="flex justify-between text-sm"><span className="text-gray-600">{x.key}</span><span className="font-semibold text-navy-900 tabular-nums">{x.n.toLocaleString()}</span></div>)}
              <div className="flex justify-between text-sm pt-1 border-t border-gray-100"><span className="text-gray-500">Deployment-relevant / total</span><span className="font-semibold text-brand-700 tabular-nums">{r.inventory.relevant.toLocaleString()} / {r.inventory.total.toLocaleString()}</span></div>
            </div>
          </div>
        </div>
      </details>

        </div>
      </details>

      {hadFailure && <p className="text-[11px] text-amber-600">A previous validation didn't complete — running it again will retry.</p>}
    </div>
  );
}

function ArchNode({ icon, label, accent }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${accent ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-gray-200 bg-white text-navy-700'}`}><span className="text-gray-400">{icon}</span>{label}</span>;
}
function Conn() { return <span className="h-3 w-px bg-gray-300" />; }
