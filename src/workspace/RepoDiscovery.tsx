// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import {
  Loader as Loader2, Check, ArrowRight, Shield, Boxes, Database, AlertTriangle,
  Globe, Network, Cloud, TrendingUp, XCircle, CheckCircle2,
} from 'lucide-react';

function parseGitUrl(url) {
  if (!url) return null;
  const m = url.match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?(?:$|\/)/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

async function fetchRaw(owner, repo, path, branch, token) {
  const headers = { Accept: 'application/vnd.github.raw' };
  if (token) headers.Authorization = 'Bearer ' + token;
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${branch}`, { headers });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
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
  const recommendation = blockers > 0
    ? { verdict: 'Do not promote this release yet', tone: 'red', text: `I found ${blockers} issue${blockers === 1 ? '' : 's'} that should be resolved before production — chiefly around ${[...new Set(concerns.filter((c) => c.sev === 'high').map((c) => c.cat))].join(' and ')}.` }
    : warnings > 0
    ? { verdict: 'Proceed with caution', tone: 'amber', text: `No hard blockers, but ${warnings} item${warnings === 1 ? '' : 's'} warrant review before release.` }
    : { verdict: 'Looks release-ready', tone: 'green', text: 'I found no blocking issues in what I could inspect.' };

  return { strengths: [...new Set(strengths)], concerns, areas, overall, summary: { blockers, warnings, opportunities }, recommendation, inspected: { dockers: inspectedDockers, workflows: inspectedWf } };
}

const STEPS = ['Reading repository', 'Detecting services', 'Inspecting containers', 'Reading CI/CD pipelines', 'Assessing security posture', 'Scoring platform maturity', 'Forming an opinion', 'Writing your briefing'];

export function RepoDiscovery({ project, onRunValidation, onConnect, hadFailure }) {
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    let alive = true;
    timer.current = setInterval(() => setRevealed((r) => Math.min(STEPS.length, r + 1)), 320);
    (async () => {
      try {
        const parsed = parseGitUrl(project.git_url);
        if (!parsed) throw new Error('This project has no GitHub repository URL to analyze.');
        const headers = { Accept: 'application/vnd.github+json' };
        if (project.github_token) headers.Authorization = 'Bearer ' + project.github_token;
        const branch = project.git_branch || 'main';
        const res = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${branch}?recursive=1`, { headers });
        if (!res.ok) throw new Error(res.status === 404 ? 'Repository or branch not found (private repos need a token).' : res.status === 403 ? 'GitHub rate limit reached — try again shortly.' : `GitHub returned ${res.status}.`);
        const data = await res.json();
        const paths = (data.tree || []).filter((t) => t.type === 'blob').map((t) => t.path);
        const base = analyze(paths);
        // Read a sample of Dockerfiles + workflows for real opinions
        const dPaths = paths.filter((p) => /(^|\/)Dockerfile/i.test(p)).slice(0, 6);
        const wPaths = paths.filter((p) => /\.github\/workflows\/[^/]+\.ya?ml$/.test(p)).slice(0, 4);
        const [dRes, wRes] = await Promise.all([
          Promise.all(dPaths.map((p) => fetchRaw(parsed.owner, parsed.repo, p, branch, project.github_token).then((c) => ({ p, c })))),
          Promise.all(wPaths.map((p) => fetchRaw(parsed.owner, parsed.repo, p, branch, project.github_token).then((c) => ({ p, c })))),
        ]);
        const insights = deriveInsights(base, dRes.filter((x) => x.c), wRes.filter((x) => x.c), paths);
        if (!alive) return;
        setResult({ ...base, ...insights });
      } catch (e) { if (alive) setError(e.message || 'Could not analyze the repository.'); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; clearInterval(timer.current); };
  }, [project.git_url, project.git_branch]);

  const stepsDone = revealed >= STEPS.length;
  if (loading || !stepsDone) {
    return (
      <div className="card">
        <p className="text-sm font-semibold text-navy-900 mb-4 flex items-center gap-2"><Loader2 size={15} className="animate-spin text-brand-600" />Analyzing your delivery platform…</p>
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
  const recTone = { red: 'text-red-600', amber: 'text-amber-600', green: 'text-green-600' }[r.recommendation.tone];
  const recBg = { red: 'bg-red-50 border-red-200', amber: 'bg-amber-50 border-amber-200', green: 'bg-green-50 border-green-200' }[r.recommendation.tone];
  const scoreColor = (s) => s >= 88 ? 'text-green-600' : s >= 65 ? 'text-brand-700' : s >= 50 ? 'text-amber-600' : 'text-red-600';
  const totalIssues = r.summary.blockers + r.summary.warnings + r.summary.opportunities;

  return (
    <div className="space-y-5">
      {/* ── AI EXECUTIVE BRIEFING ────────────────────────────────────────── */}
      <div className={`card border ${recBg}`}>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1 flex items-center gap-1.5"><Boxes size={12} />AI Executive Briefing</p>
        <p className="text-sm text-gray-700 leading-relaxed max-w-3xl">
          I analyzed your <span className="font-semibold">{r.appType}</span> platform — {r.inventory.relevant.toLocaleString()} deployment-relevant files across {r.services} service{r.services === 1 ? '' : 's'}
          {r.inspected.dockers || r.inspected.workflows ? `, including the contents of ${r.inspected.dockers} Dockerfile${r.inspected.dockers === 1 ? '' : 's'} and ${r.inspected.workflows} CI workflow${r.inspected.workflows === 1 ? '' : 's'}` : ''}. Here's my assessment.
        </p>
        <div className="mt-3 flex items-baseline gap-3 flex-wrap">
          <span className={`text-2xl font-bold ${recTone}`}>{r.recommendation.verdict}</span>
          <span className="text-sm text-gray-500">Enterprise readiness <span className={`font-bold ${scoreColor(r.overall)}`}>{r.overall}/100</span></span>
        </div>
        <p className="text-sm text-gray-600 mt-1">{r.recommendation.text}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button onClick={onRunValidation} className="btn-primary text-sm"><Shield size={14} />Run Full Assessment</button>
          {r.infra === 'Terraform' && onConnect && <button onClick={onConnect} className="btn-secondary text-sm"><Cloud size={13} />Verify {r.cloud[0] || 'cloud'} infra</button>}
        </div>
      </div>

      {/* ── STRENGTHS / CONCERNS ─────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="text-sm font-semibold text-navy-900 mb-2 flex items-center gap-1.5"><CheckCircle2 size={14} className="text-green-500" />What impressed me</h3>
          {r.strengths.length ? (
            <ul className="space-y-1.5">{r.strengths.map((s, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><Check size={15} className="text-green-500 shrink-0 mt-0.5" />{s}</li>)}</ul>
          ) : <p className="text-sm text-gray-400">Nothing notable detected yet.</p>}
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-navy-900 mb-2 flex items-center gap-1.5"><AlertTriangle size={14} className="text-amber-500" />What concerns me</h3>
          {r.concerns.length ? (
            <ul className="space-y-2">
              {r.concerns.map((c, i) => (
                <li key={i} className="text-sm">
                  <span className="flex items-center gap-1.5">
                    <span className={`chip text-[10px] ${c.sev === 'high' ? 'bg-red-50 text-red-700 border border-red-200' : c.sev === 'medium' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>{c.sev === 'high' ? 'Blocker' : c.sev === 'medium' ? 'Needs attention' : 'Optimization'}</span>
                    <span className="font-medium text-navy-800">{c.cat}</span>
                  </span>
                  <p className="text-gray-600 mt-0.5 leading-snug">{c.text}</p>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-green-700">No concerns in what I could inspect.</p>}
        </div>
      </div>

      {/* ── AI FINDINGS SUMMARY ──────────────────────────────────────────── */}
      <div className="card">
        <h3 className="text-sm font-semibold text-navy-900 mb-1">AI findings summary</h3>
        <p className="text-sm text-gray-600 mb-3">After analyzing {r.inventory.total.toLocaleString()} files, I found <span className="font-semibold text-navy-900">{totalIssues} issue{totalIssues === 1 ? '' : 's'} that matter</span>{totalIssues === 0 ? '.' : ':'}</p>
        <div className="grid gap-3 grid-cols-3">
          {[{ n: r.summary.blockers, l: 'Blockers', c: 'text-red-600' }, { n: r.summary.warnings, l: 'Need attention', c: 'text-amber-600' }, { n: r.summary.opportunities, l: 'Optimizations', c: 'text-brand-700' }].map((x) => (
            <div key={x.l} className="rounded-xl border border-gray-200 p-3 text-center"><div className={`text-2xl font-bold ${x.c}`}>{x.n}</div><div className="text-xs text-gray-500 mt-0.5">{x.l}</div></div>
          ))}
        </div>
      </div>

      {/* ── PLATFORM MATURITY ────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-navy-900 flex items-center gap-1.5"><TrendingUp size={14} className="text-brand-600" />Platform maturity</h3>
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

      {hadFailure && <p className="text-[11px] text-amber-600">A previous validation didn't complete — running it again will retry.</p>}
    </div>
  );
}

function ArchNode({ icon, label, accent }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${accent ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-gray-200 bg-white text-navy-700'}`}><span className="text-gray-400">{icon}</span>{label}</span>;
}
function Conn() { return <span className="h-3 w-px bg-gray-300" />; }
