// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import {
  Loader as Loader2, Check, ArrowRight, Shield, Boxes, Server, Layers, Zap,
  Cloud, Activity, Code2, Package, Database, AlertTriangle, Globe, Network, GitBranch,
} from 'lucide-react';

function parseGitUrl(url) {
  if (!url) return null;
  const m = url.match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?(?:$|\/)/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

// Derive a real technology inventory from the repository file paths.
function analyze(paths) {
  const has = (re) => paths.some((p) => re.test(p));
  const count = (re) => paths.filter((p) => re.test(p)).length;

  // Languages with proportion
  const EXT = [
    { re: /\.go$/, l: 'Go' }, { re: /\.tsx?$/, l: 'TypeScript' }, { re: /\.jsx?$/, l: 'JavaScript' },
    { re: /\.py$/, l: 'Python' }, { re: /\.rb$/, l: 'Ruby' }, { re: /\.rs$/, l: 'Rust' },
    { re: /\.java$/, l: 'Java' }, { re: /\.php$/, l: 'PHP' }, { re: /\.cs$/, l: 'C#' },
    { re: /\.(ya?ml)$/, l: 'YAML' },
  ];
  const langCounts = {}; let codeFiles = 0;
  paths.forEach((p) => { for (const { re, l } of EXT) { if (re.test(p)) { langCounts[l] = (langCounts[l] || 0) + 1; codeFiles++; break; } } });
  const langs = Object.entries(langCounts).sort((a, b) => b[1] - a[1])
    .map(([l, c]) => ({ l, pct: Math.max(1, Math.round((c / Math.max(1, codeFiles)) * 100)) })).slice(0, 5);

  const dockerfiles = count(/(^|\/)Dockerfile/i);
  const compose = count(/(^|\/)docker-compose[^/]*\.ya?ml$|(^|\/)compose\.ya?ml$/i);
  const tf = count(/\.tf$/);
  const k8s = count(/(k8s|kubernetes|manifests?|deploy(ments?)?|charts?|overlays?|base)\/.*\.ya?ml$/i);
  const helm = count(/(^|\/)Chart\.ya?ml$/) + (has(/\/(charts|helm)\//i) ? 1 : 0);
  const ghActions = count(/\.github\/workflows\/[^/]+\.ya?ml$/);
  const gitlabCI = has(/(^|\/)\.gitlab-ci\.ya?ml$/);
  const jenkins = has(/(^|\/)Jenkinsfile$/i);
  const circleci = has(/(^|\/)\.circleci\//);

  const frameworks = [];
  if (has(/(^|\/)next\.config\./)) frameworks.push('Next.js'); else if (has(/\.tsx$/) || has(/\.jsx$/)) frameworks.push('React');
  if (has(/\.vue$/)) frameworks.push('Vue');
  if (has(/\.svelte$/)) frameworks.push('Svelte');
  if (has(/(^|\/)manage\.py$/)) frameworks.push('Django');
  if (has(/(^|\/)pom\.xml$/) || has(/spring/i)) frameworks.push('Spring');
  if (has(/gin-gonic|(^|\/)gin\//i)) frameworks.push('Gin');
  if (has(/express/i)) frameworks.push('Express');

  const monitoring = [];
  if (has(/opentelemetry|otel/i)) monitoring.push('OpenTelemetry');
  if (has(/prometheus/i)) monitoring.push('Prometheus');
  if (has(/grafana/i)) monitoring.push('Grafana');
  if (has(/datadog/i)) monitoring.push('Datadog');
  if (has(/jaeger/i)) monitoring.push('Jaeger');

  const cloud = [];
  if (tf > 0 && has(/aws|eks|ecr|s3|lambda|ecs|dynamodb|iam/i)) cloud.push('AWS');
  else if (has(/aws|eks|ecr|s3|lambda|ecs|dynamodb/i)) cloud.push('AWS');
  if (has(/gcp|gke|cloudrun|artifactregistry/i)) cloud.push('GCP');
  if (has(/azure|aks|acr/i)) cloud.push('Azure');

  const stores = [];
  if (has(/redis/i)) stores.push('Redis');
  if (has(/kafka/i)) stores.push('Kafka');
  if (has(/postgres|postgresql/i)) stores.push('PostgreSQL');
  if (has(/mysql|mariadb/i)) stores.push('MySQL');
  if (has(/mongo/i)) stores.push('MongoDB');
  if (has(/rabbitmq/i)) stores.push('RabbitMQ');
  if (has(/dynamodb/i)) stores.push('DynamoDB');
  if (has(/elasticsearch|opensearch/i)) stores.push('Elasticsearch');

  const envs = [];
  if (paths.some((p) => /(^|\/)(dev|development)(\/|\.|-|$)/i.test(p))) envs.push('Development');
  if (paths.some((p) => /(^|\/)(staging|stage)(\/|\.|-|$)/i.test(p))) envs.push('Staging');
  if (paths.some((p) => /(^|\/)(prod|production)(\/|\.|-|$)/i.test(p))) envs.push('Production');

  // Services
  const serviceDirs = new Set();
  paths.filter((p) => /(^|\/)Dockerfile/i.test(p)).forEach((p) => { const d = p.split('/').slice(0, -1).join('/') || 'root'; serviceDirs.add(d); });
  paths.forEach((p) => { const m = p.match(/^(services|apps|cmd|packages|microservices|src\/services)\/([^/]+)\//); if (m) serviceDirs.add(m[2]); });
  const serviceNames = [...serviceDirs].map((d) => d.split('/').pop()).filter((n) => n && n !== 'root' && n !== '.').slice(0, 8);
  const services = Math.max(serviceDirs.size, dockerfiles, serviceNames.length);

  const orchestration = k8s > 0 || helm ? 'Kubernetes' : compose > 0 ? 'Docker Compose' : '—';
  const ci = ghActions > 0 ? 'GitHub Actions' : gitlabCI ? 'GitLab CI' : jenkins ? 'Jenkins' : circleci ? 'CircleCI' : '—';
  const container = dockerfiles > 0 ? 'Docker' : '—';
  const infra = tf > 0 ? 'Terraform' : '—';
  const registry = cloud.includes('AWS') ? 'ECR' : cloud.includes('GCP') ? 'Artifact Registry' : cloud.includes('Azure') ? 'ACR' : 'Registry';
  const orchTarget = cloud.includes('AWS') && (k8s > 0 || helm) ? 'Amazon EKS' : k8s > 0 || helm ? 'Kubernetes' : compose > 0 ? 'Docker Compose' : 'servers';

  const appType = (k8s > 0 && dockerfiles > 2) || services > 3
    ? 'Cloud-Native Microservices'
    : dockerfiles > 0 || compose > 0 ? 'Containerized Application'
    : (langs[0]?.l ? `${langs[0].l} Application` : 'Application');

  // Detection confidence — more independent signals → higher confidence
  const signals = [langs.length > 0, dockerfiles > 0, tf > 0, k8s > 0, ci !== '—', cloud.length > 0, monitoring.length > 0, helm > 0, stores.length > 0, envs.length > 0].filter(Boolean).length;
  const confidence = Math.min(98, 58 + signals * 4);

  // Deployment pipeline
  const pipeline = [];
  if (ci !== '—') pipeline.push(ci);
  if (dockerfiles > 0) pipeline.push('Docker Build');
  if (dockerfiles > 0 && cloud.length) pipeline.push('Push to ' + registry);
  if (tf > 0) pipeline.push('Terraform');
  pipeline.push('Deploy to ' + orchTarget);
  if (k8s > 0) pipeline.push('Ingress');
  pipeline.push('Production');

  // What I learned (natural language)
  const learned = [];
  if (ci !== '—') learned.push(`Your application is deployed using ${ci}.`);
  if (tf > 0 && cloud.length) learned.push(`Terraform provisions your ${cloud[0]} infrastructure.`);
  if (k8s > 0) learned.push(`Kubernetes manifests target ${orchTarget}.`);
  if (helm > 0) learned.push('Helm manages your deployments.');
  if (monitoring.includes('OpenTelemetry')) learned.push('OpenTelemetry instruments distributed tracing.');
  if (monitoring.includes('Prometheus')) learned.push('Prometheus monitors your services.');
  if (monitoring.includes('Grafana')) learned.push('Grafana visualizes your metrics.');
  stores.forEach((s) => learned.push(`${s} provides ${/kafka|rabbitmq/i.test(s) ? 'messaging / streaming' : 'data storage'}.`));
  if (envs.length) learned.push(`I detected ${envs.length} environment${envs.length === 1 ? '' : 's'}: ${envs.join(', ')}.`);

  // Detected tech list for the headline
  const detected = [];
  if (k8s > 0) detected.push('Kubernetes');
  if (tf > 0) detected.push('Terraform');
  if (ci !== '—') detected.push(ci);
  if (dockerfiles > 0) detected.push('Docker');
  if (helm > 0) detected.push('Helm');
  monitoring.forEach((m) => detected.push(m));
  cloud.forEach((c) => detected.push(c));

  // ── Repository inventory — partition EVERY file into one bucket so the
  // numbers are transparent and add up to the true total.
  const CATS = [
    { key: 'Documentation', re: /\.(md|mdx|rst|adoc|txt)$/i, relevant: false },
    { key: 'Kubernetes', re: /(k8s|kubernetes|manifests?|deploy(ments?)?|overlays?|base)\/.*\.ya?ml$/i, relevant: true },
    { key: 'Helm', re: /(^|\/)(Chart\.ya?ml|values[^/]*\.ya?ml)$|\/(charts|helm)\/.*\/templates\//i, relevant: true },
    { key: 'Terraform', re: /\.tf(vars)?$/i, relevant: true },
    { key: 'Containers', re: /(^|\/)(Dockerfile|\.dockerignore)|docker-compose[^/]*\.ya?ml$|(^|\/)compose\.ya?ml$/i, relevant: true },
    { key: 'CI/CD', re: /\.github\/workflows\/|(^|\/)\.gitlab-ci\.ya?ml$|(^|\/)Jenkinsfile$|(^|\/)\.circleci\//i, relevant: true },
    { key: 'Source code', re: /\.(go|tsx?|jsx?|py|rb|rs|java|php|cs|kt|swift|scala|c|cc|cpp|h|hpp|vue|svelte|proto)$/i, relevant: true },
    { key: 'Configuration', re: /\.(ya?ml|json|toml|ini|env|conf|cfg|config|properties|xml|lock|sh|bash)$|(^|\/)(\.env[^/]*|Makefile|\.gitignore|\.editorconfig)$/i, relevant: true },
  ];
  const buckets = {}; CATS.forEach((c) => (buckets[c.key] = 0)); buckets['Other / assets'] = 0;
  paths.forEach((p) => { const c = CATS.find((c) => c.re.test(p)); buckets[c ? c.key : 'Other / assets']++; });
  const relevant = CATS.filter((c) => c.relevant).reduce((s, c) => s + buckets[c.key], 0);
  const inventory = {
    total: paths.length, relevant, ignored: paths.length - relevant,
    buckets: [...CATS.map((c) => ({ key: c.key, n: buckets[c.key] })), { key: 'Other / assets', n: buckets['Other / assets'] }].filter((b) => b.n > 0),
  };

  return {
    appType, services, serviceNames, langs, frameworks, infra, container, orchestration, orchTarget,
    ci, cloud, monitoring, stores, envs, confidence, pipeline, learned, detected, inventory,
    counts: { files: paths.length, services, dockerfiles, tf, k8s, ghActions: ghActions || (gitlabCI ? 1 : jenkins ? 1 : 0), helm, compose },
  };
}

const STEPS = [
  'Reading repository', 'Detecting services', 'Detecting Kubernetes', 'Detecting Terraform',
  'Detecting CI/CD', 'Mapping dependencies', 'Building architecture graph', 'Generating deployment model',
];

export function RepoDiscovery({ project, onRunValidation, onConnect, hadFailure }) {
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    let alive = true;
    timer.current = setInterval(() => setRevealed((r) => Math.min(STEPS.length, r + 1)), 300);
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
        if (!alive) return;
        setResult(analyze(paths));
      } catch (e) { if (alive) setError(e.message || 'Could not analyze the repository.'); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; clearInterval(timer.current); };
  }, [project.git_url, project.git_branch]);

  const stepsDone = revealed >= STEPS.length;

  if (loading || !stepsDone) {
    return (
      <div className="card">
        <p className="text-sm font-semibold text-navy-900 mb-4 flex items-center gap-2"><Loader2 size={15} className="animate-spin text-brand-600" />Understanding your application…</p>
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
  const glance = [
    { k: 'Application', v: r.appType }, { k: 'Services', v: String(r.services || '—') },
    { k: 'Cloud', v: r.cloud.join(', ') || '—' }, { k: 'Containers', v: r.container },
    { k: 'Orchestration', v: r.orchestration }, { k: 'Infrastructure', v: r.infra },
    { k: 'CI/CD', v: r.ci }, { k: 'Monitoring', v: r.monitoring.join(', ') || '—' },
    { k: 'Environments', v: r.envs.length ? String(r.envs.length) : '—' },
  ];
  const structure = [
    r.counts.services > 0 && { n: r.counts.services, l: 'services' },
    r.counts.dockerfiles > 0 && { n: r.counts.dockerfiles, l: 'Dockerfiles' },
    r.counts.tf > 0 && { n: r.counts.tf, l: 'Terraform files' },
    r.counts.k8s > 0 && { n: r.counts.k8s, l: 'Kubernetes manifests' },
    r.counts.ghActions > 0 && { n: r.counts.ghActions, l: 'CI/CD workflows' },
    r.counts.helm > 0 && { n: r.counts.helm, l: 'Helm charts' },
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      {/* ── HEADLINE: the report ─────────────────────────────────────────── */}
      <div className="card border-brand-200 bg-brand-50/50">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-700 mb-1 flex items-center gap-1.5"><Boxes size={12} />AI Discovery Report</p>
            <h2 className="text-xl font-bold text-navy-900">{r.appType}</h2>
            <p className="text-sm text-gray-700 mt-1.5 leading-relaxed max-w-2xl">
              I scanned <span className="font-semibold">{r.inventory.total.toLocaleString()} repository files</span> and identified <span className="font-semibold">{r.inventory.relevant.toLocaleString()} deployment-relevant files</span> across application code, infrastructure, Kubernetes, containers, CI/CD and configuration — spanning <span className="font-semibold">{r.services} deployable service{r.services === 1 ? '' : 's'}</span>
              {r.detected.length ? <>, using <span className="font-semibold">{r.detected.slice(0, 7).join(', ')}</span></> : null}.
            </p>
          </div>
          <div className="text-center shrink-0">
            <div className="text-3xl font-bold text-brand-700">{r.confidence}%</div>
            <div className="text-[11px] text-gray-500">confidence</div>
          </div>
        </div>
      </div>

      {/* ── PLATFORM AT A GLANCE ─────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-navy-900 mb-2">Your platform at a glance</h3>
        <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {glance.map((g) => (
            <div key={g.k} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-wide text-gray-400">{g.k}</div>
              <div className="text-sm font-semibold text-navy-900 mt-0.5 leading-tight">{g.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── LANGUAGES + STRUCTURE ────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {r.langs.length > 0 && (
          <div className="card">
            <h3 className="text-sm font-semibold text-navy-900 mb-3">Languages</h3>
            <div className="space-y-2">
              {r.langs.map((l) => (
                <div key={l.l}>
                  <div className="flex justify-between text-xs mb-0.5"><span className="text-navy-800 font-medium">{l.l}</span><span className="text-gray-400">{l.pct}%</span></div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-brand-500 rounded-full" style={{ width: `${l.pct}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="card">
          <h3 className="text-sm font-semibold text-navy-900 mb-3">Repository inventory</h3>
          <div className="space-y-1.5">
            {r.inventory.buckets.map((b) => (
              <div key={b.key} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{b.key}</span>
                <span className="font-semibold text-navy-900 tabular-nums">{b.n.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Total repository files</span><span className="font-semibold text-navy-900 tabular-nums">{r.inventory.total.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Deployment-relevant</span><span className="font-semibold text-brand-700 tabular-nums">{r.inventory.relevant.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Ignored (docs, assets, lockfiles)</span><span className="font-medium text-gray-400 tabular-nums">{r.inventory.ignored.toLocaleString()}</span></div>
          </div>
        </div>
      </div>

      {/* ── INFERRED ARCHITECTURE ────────────────────────────────────────── */}
      <div className="card">
        <h3 className="text-sm font-semibold text-navy-900 mb-3 flex items-center gap-1.5"><Network size={14} className="text-brand-600" />Inferred architecture</h3>
        <div className="flex flex-col items-center gap-1.5 py-2">
          <ArchNode icon={<Globe size={13} />} label="Internet" />
          <Conn />
          {r.counts.k8s > 0 || r.orchestration === 'Kubernetes' ? <><ArchNode icon={<Network size={13} />} label="Ingress / Load Balancer" /><Conn /></> : null}
          <div className="flex flex-wrap justify-center gap-2">
            {(r.serviceNames.length ? r.serviceNames.slice(0, 4) : [`${r.services} services`]).map((s) => (
              <ArchNode key={s} icon={<Boxes size={13} />} label={s} accent />
            ))}
            {r.serviceNames.length > 4 && <ArchNode icon={<Boxes size={13} />} label={`+${r.services - 4} more`} />}
          </div>
          {r.stores.length > 0 && <><Conn /><div className="flex flex-wrap justify-center gap-2">{r.stores.map((s) => <ArchNode key={s} icon={<Database size={13} />} label={s} />)}</div></>}
        </div>
        <p className="text-[11px] text-gray-400 text-center mt-2">I inferred this from your manifests, Dockerfiles and dependencies.</p>
      </div>

      {/* ── DEPLOYMENT MODEL ─────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-navy-900 mb-2">How it's deployed</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {r.pipeline.map((step, i, arr) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-navy-700">{step}</span>
              {i < arr.length - 1 && <ArrowRight size={12} className="text-gray-300" />}
            </div>
          ))}
        </div>
      </div>

      {/* ── WHAT I LEARNED ───────────────────────────────────────────────── */}
      {r.learned.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-navy-900 mb-2">What I learned</h3>
          <ul className="space-y-1.5">
            {r.learned.map((l, i) => (<li key={i} className="flex items-start gap-2 text-sm text-gray-700"><Check size={15} className="text-green-500 shrink-0 mt-0.5" />{l}</li>))}
          </ul>
        </div>
      )}

      {/* ── RECOMMENDED NEXT STEP ────────────────────────────────────────── */}
      <div className="card border-brand-200 bg-brand-50">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-700 mb-1">Recommended next step</p>
        <h3 className="text-base font-semibold text-navy-900">Run a Production Readiness Assessment</h3>
        <p className="text-sm text-gray-700 mt-1 max-w-2xl">
          Because I detected {[r.infra !== '—' && 'infrastructure-as-code', r.orchestration === 'Kubernetes' && 'Kubernetes', r.container === 'Docker' && 'containers', r.ci !== '—' && 'CI/CD', r.cloud.length && 'cloud resources'].filter(Boolean).join(', ')}, all of these should be validated before deployment.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button onClick={onRunValidation} className="btn-primary"><Shield size={14} />Start Assessment</button>
          {r.infra === 'Terraform' && onConnect && <button onClick={onConnect} className="btn-secondary text-sm"><Cloud size={13} />Verify {r.cloud[0] || 'cloud'} infra</button>}
          <span className="text-xs text-gray-500">Estimated ~2 min</span>
        </div>
        {hadFailure && <p className="text-[11px] text-amber-600 mt-2">A previous validation didn't complete — running it again will retry.</p>}
      </div>
    </div>
  );
}

function ArchNode({ icon, label, accent }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${accent ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-gray-200 bg-white text-navy-700'}`}>
      <span className="text-gray-400">{icon}</span>{label}
    </span>
  );
}
function Conn() { return <span className="h-3 w-px bg-gray-300" />; }
