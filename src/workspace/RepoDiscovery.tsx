// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import {
  Loader as Loader2, Check, ArrowRight, Shield, Boxes, Server, Layers, Zap,
  Cloud, Activity, Code2, Package, GitBranch, AlertTriangle,
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

  const langs = [];
  if (has(/\.go$/) || has(/(^|\/)go\.mod$/)) langs.push('Go');
  if (has(/\.tsx?$/)) langs.push('TypeScript'); else if (has(/(^|\/)package\.json$/) || has(/\.jsx?$/)) langs.push('Node.js');
  if (has(/\.py$/) || has(/(^|\/)requirements\.txt$/) || has(/(^|\/)pyproject\.toml$/)) langs.push('Python');
  if (has(/\.rb$/) || has(/(^|\/)Gemfile$/)) langs.push('Ruby');
  if (has(/\.rs$/) || has(/(^|\/)Cargo\.toml$/)) langs.push('Rust');
  if (has(/\.java$/) || has(/(^|\/)pom\.xml$/)) langs.push('Java');
  if (has(/\.php$/)) langs.push('PHP');
  if (has(/\.cs$/)) langs.push('C#');

  const dockerfiles = count(/(^|\/)Dockerfile(\.|$|[^/]*$)/i);
  const compose = count(/(^|\/)docker-compose[^/]*\.ya?ml$|(^|\/)compose\.ya?ml$/i);
  const tf = count(/\.tf$/);
  const k8s = count(/(k8s|kubernetes|manifests?|deploy(ments?)?|charts?)\/.*\.ya?ml$/i);
  const helm = has(/(^|\/)Chart\.ya?ml$/) || has(/\/(charts|helm)\//i);
  const ghActions = count(/\.github\/workflows\/[^/]+\.ya?ml$/);
  const gitlabCI = has(/(^|\/)\.gitlab-ci\.ya?ml$/);
  const circleci = has(/(^|\/)\.circleci\//);
  const jenkins = has(/(^|\/)Jenkinsfile$/i);

  const monitoring = [];
  if (has(/prometheus/i)) monitoring.push('Prometheus');
  if (has(/grafana/i)) monitoring.push('Grafana');
  if (has(/datadog/i)) monitoring.push('Datadog');
  if (has(/opentelemetry|otel/i)) monitoring.push('OpenTelemetry');

  const cloud = [];
  if (tf > 0 || has(/(aws|eks|s3|lambda|ecs|dynamodb)/i)) cloud.push('AWS');
  if (has(/(gcp|gke|cloudrun|bigquery)/i)) cloud.push('GCP');
  if (has(/(azure|aks)/i)) cloud.push('Azure');

  // Count service-like units: dirs that contain a Dockerfile, plus services/apps/cmd children
  const serviceDirs = new Set();
  paths.filter((p) => /(^|\/)Dockerfile/i.test(p)).forEach((p) => {
    const d = p.split('/').slice(0, -1).join('/') || 'root';
    serviceDirs.add(d);
  });
  paths.forEach((p) => {
    const m = p.match(/^(services|apps|cmd|packages|microservices)\/([^/]+)\//);
    if (m) serviceDirs.add(m[1] + '/' + m[2]);
  });
  const services = Math.max(serviceDirs.size, dockerfiles);

  const orchestration = k8s > 0 || helm ? 'Kubernetes' : compose > 0 ? 'Docker Compose' : '—';
  const ci = ghActions > 0 ? 'GitHub Actions' : gitlabCI ? 'GitLab CI' : circleci ? 'CircleCI' : jenkins ? 'Jenkins' : '—';
  const appType = (k8s > 0 && dockerfiles > 2) || services > 3
    ? 'Cloud-native Microservices'
    : dockerfiles > 0 || compose > 0 ? 'Containerized Application'
    : langs.length ? `${langs[0]} Application` : 'Application';

  return {
    appType, services, langs,
    infra: tf > 0 ? 'Terraform' : '—',
    container: dockerfiles > 0 ? 'Docker' : '—',
    orchestration, ci, cloud, monitoring,
    counts: { k8s, tf, dockerfiles, ghActions: ghActions || (gitlabCI ? 1 : 0), helm, compose, files: paths.length },
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
    // staged reveal for the "understanding your application" moment
    timer.current = setInterval(() => setRevealed((r) => Math.min(STEPS.length, r + 1)), 380);
    (async () => {
      try {
        const parsed = parseGitUrl(project.git_url);
        if (!parsed) throw new Error('This project has no GitHub repository URL to analyze.');
        const headers = { Accept: 'application/vnd.github+json' };
        if (project.github_token) headers.Authorization = 'Bearer ' + project.github_token;
        const branch = project.git_branch || 'main';
        const res = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${branch}?recursive=1`, { headers });
        if (!res.ok) {
          throw new Error(res.status === 404 ? 'Repository or branch not found (private repos need a token).' : res.status === 403 ? 'GitHub rate limit reached — try again shortly.' : `GitHub returned ${res.status}.`);
        }
        const data = await res.json();
        const paths = (data.tree || []).filter((t) => t.type === 'blob').map((t) => t.path);
        if (!alive) return;
        setResult(analyze(paths));
      } catch (e) {
        if (alive) setError(e.message || 'Could not analyze the repository.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; clearInterval(timer.current); };
  }, [project.git_url, project.git_branch]);

  const stepsDone = revealed >= STEPS.length;

  // ── Loading "wow" moment ────────────────────────────────────────────────
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
        <div className="mt-3 flex gap-2">
          <button onClick={onRunValidation} className="btn-primary text-sm"><Shield size={14} />Run Validation anyway</button>
        </div>
      </div>
    );
  }

  const r = result;
  const facts = [
    r.counts.k8s > 0 && `${r.counts.k8s} Kubernetes manifests`,
    r.counts.tf > 0 && `${r.counts.tf} Terraform files`,
    r.counts.dockerfiles > 0 && `${r.counts.dockerfiles} Dockerfiles`,
    r.counts.ghActions > 0 && `${r.counts.ghActions} CI/CD workflows`,
    r.counts.helm && 'Helm charts',
    r.services > 0 && `${r.services} service${r.services === 1 ? '' : 's'}`,
  ].filter(Boolean);

  const inventory = [
    { k: 'Application Type', v: r.appType, icon: Boxes },
    { k: 'Services Detected', v: String(r.services || '—'), icon: Boxes },
    { k: 'Languages', v: r.langs.join(', ') || '—', icon: Code2 },
    { k: 'Infrastructure', v: r.infra, icon: Layers },
    { k: 'Container Platform', v: r.container, icon: Package },
    { k: 'Orchestration', v: r.orchestration, icon: Server },
    { k: 'CI/CD', v: r.ci, icon: Zap },
    { k: 'Cloud', v: r.cloud.join(', ') || '—', icon: Cloud },
    { k: 'Monitoring', v: r.monitoring.join(', ') || '—', icon: Activity },
  ];

  return (
    <div className="space-y-5">
      {/* Discovery result */}
      <div className="card">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-700 mb-1 flex items-center gap-1.5"><Check size={12} />Discovery Complete</p>
        <h2 className="text-xl font-bold text-navy-900">I understand your application.</h2>
        <p className="text-sm text-gray-600 mt-1">Here's what I discovered about <span className="font-semibold text-navy-800">{project.name}</span> from its repository.</p>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 mt-4">
          {inventory.map((it) => (
            <div key={it.k} className="rounded-xl border border-gray-200 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gray-400"><it.icon size={12} />{it.k}</div>
              <div className="text-sm font-semibold text-navy-900 mt-0.5">{it.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* What I found */}
      {facts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-navy-900 mb-2">What I found</h3>
          <div className="flex flex-wrap gap-2">
            {facts.map((f) => (
              <span key={f} className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-800"><Check size={12} />{f}</span>
            ))}
          </div>
        </div>
      )}

      {/* Recommendation, not settings */}
      {r.infra === 'Terraform' && (!onConnect ? null : (
        <div className="card border-brand-200 bg-brand-50 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-navy-800">I detected <span className="font-semibold">Terraform{r.cloud.length ? ` configured for ${r.cloud[0]}` : ''}</span>. Want me to verify it against your live infrastructure?</p>
          <button onClick={onConnect} className="btn-secondary text-sm shrink-0"><Cloud size={14} />Connect {r.cloud[0] || 'Cloud'}</button>
        </div>
      ))}

      {/* Phase 2 CTA */}
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-gray-400">Next step</div>
          <div className="text-sm font-semibold text-navy-900">Validate this release</div>
          <div className="text-xs text-gray-500 mt-0.5">Now that I understand your app, I'll analyze code, dependencies, secrets and config to tell you if it's safe to deploy.</div>
        </div>
        <button onClick={onRunValidation} className="btn-primary shrink-0"><Shield size={14} />Run Validation</button>
      </div>
      {hadFailure && <p className="text-[11px] text-amber-600">A previous validation didn't complete — running it again will retry.</p>}
    </div>
  );
}
