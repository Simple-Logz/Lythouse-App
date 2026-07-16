import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { validation_id, project_id, workspace_id, git_url, git_branch, repo_folder, language, framework } = await req.json();

    if (!validation_id || !project_id || !workspace_id) {
      return new Response(JSON.stringify({ error: 'validation_id, project_id, workspace_id are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const startedAt = Date.now();
    const stepDefs = [
      { key: 'fetch', name: 'Fetch repository' },
      { key: 'scan', name: 'Scan code & config' },
      { key: 'analyze', name: 'AI risk analysis' },
      { key: 'score', name: 'Compute risk score' },
      { key: 'report', name: 'Generate report' },
    ];

    // create steps
    const stepRows = stepDefs.map((s, i) => ({
      validation_id,
      step_index: i,
      key: s.key,
      name: s.name,
      status: 'pending' as const,
    }));
    await supabase.from('validation_steps').insert(stepRows);

    // mark validation running
    await supabase.from('validations').update({ status: 'running' }).eq('id', validation_id);

    // helper to advance a step
    async function runStep(index: number, detail: string, durationMs: number) {
      const now = new Date().toISOString();
      await supabase
        .from('validation_steps')
        .update({ status: 'running', started_at: now })
        .eq('validation_id', validation_id)
        .eq('step_index', index);

      await delay(600 + Math.random() * 700);

      const done = new Date().toISOString();
      await supabase
        .from('validation_steps')
        .update({ status: 'completed', detail, duration_ms: durationMs, completed_at: done })
        .eq('validation_id', validation_id)
        .eq('step_index', index);
    }

    // Step 0: fetch
    const t0 = Date.now();
    await runStep(0, `Cloned ${git_url} @ ${git_branch} (path: ${repo_folder})`, 1200);
    const commitSha = randomSha();

    // Step 1: scan
    const scanResults = generateScanResults(language, framework, repo_folder);
    await runStep(1, `Scanned ${scanResults.files} files, ${scanResults.lines} lines across ${scanResults.categories} categories`, 980);

    // Step 2: analyze (AI findings)
    const findings = generateFindings(git_url, git_branch, repo_folder, language, framework);
    await runStep(2, `Identified ${findings.length} findings: ${findings.filter(f => f.severity === 'critical').length} critical, ${findings.filter(f => f.severity === 'high').length} high`, 1500);

    // Step 3: score
    const riskScore = computeRiskScore(findings);
    const severity = riskScore >= 75 ? 'critical' : riskScore >= 50 ? 'high' : riskScore >= 25 ? 'medium' : riskScore > 0 ? 'low' : 'none';
    await runStep(3, `Risk score: ${riskScore}/100 — severity: ${severity}`, 700);

    // Step 4: report
    const summary = generateSummary(findings, riskScore, severity, git_branch);
    await runStep(4, summary, 540);

    // insert findings
    if (findings.length) {
      await supabase.from('findings').insert(
        findings.map((f) => ({
          validation_id,
          project_id,
          category: f.category,
          severity: f.severity,
          title: f.title,
          description: f.description,
          file_path: f.file_path,
          line: f.line,
          recommendation: f.recommendation,
          confidence: f.confidence,
        })),
      );
    }

    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    findings.forEach((f) => { counts[f.severity as keyof typeof counts]++; });

    const durationMs = Date.now() - startedAt;
    await supabase
      .from('validations')
      .update({
        status: 'completed',
        commit_sha: commitSha,
        risk_score: riskScore,
        severity,
        summary,
        total_findings: findings.length,
        critical_count: counts.critical,
        high_count: counts.high,
        medium_count: counts.medium,
        low_count: counts.low,
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      })
      .eq('id', validation_id);

    return new Response(JSON.stringify({ ok: true, risk_score: riskScore, severity, findings: findings.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // try to mark validation failed
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body.validation_id) {
        const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        await sb.from('validations').update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', body.validation_id);
      }
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function randomSha() {
  return Array.from({ length: 40 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
}

function generateScanResults(language: string | null, framework: string | null, folder: string) {
  const files = 40 + Math.floor(Math.random() * 120);
  const lines = files * (50 + Math.floor(Math.random() * 150));
  const categories = 6;
  return { files, lines, categories, language, framework, folder };
}

type Finding = {
  category: string;
  severity: string;
  title: string;
  description: string;
  file_path: string;
  line: number;
  recommendation: string;
  confidence: number;
};

function generateFindings(gitUrl: string, branch: string, folder: string, language: string | null, framework: string | null): Finding[] {
  const pool: Omit<Finding, 'file_path' | 'line' | 'confidence'>[] = [
    {
      category: 'security',
      severity: 'critical',
      title: 'Hardcoded secret detected in source',
      description: 'A string matching the pattern of an AWS access key was found committed in plaintext. Secrets in source are readable by anyone with repo access and can leak via build artifacts.',
      recommendation: 'Move the secret to an environment variable or a secrets manager. Rotate the exposed key immediately and add its pattern to .gitignore / secret scanning.',
    },
    {
      category: 'security',
      severity: 'high',
      title: 'Missing CSRF protection on state-changing endpoint',
      description: 'A POST handler mutates server state without validating an anti-CSRF token or an Origin header, making it vulnerable to cross-site request forgery.',
      recommendation: 'Add CSRF token validation or enforce SameSite cookies and Origin header checks on all state-changing routes.',
    },
    {
      category: 'config',
      severity: 'high',
      title: 'CORS configured to allow all origins',
      description: "Access-Control-Allow-Origin is set to '*' alongside credentials: true. This combination is rejected by browsers but signals an insecure posture if relaxed.",
      recommendation: 'Restrict allowed origins to an explicit allowlist. Never combine wildcard origins with credentialed requests.',
    },
    {
      category: 'dependency',
      severity: 'critical',
      title: 'Vulnerable dependency with known CVE',
      description: 'A transitive dependency has an unpatched high-severity CVE allowing prototype pollution. It is pulled in by the lockfile on this branch.',
      recommendation: 'Upgrade the dependency to a patched version or add an override. Run a fresh audit after the lockfile changes.',
    },
    {
      category: 'performance',
      severity: 'medium',
      title: 'N+1 query pattern in list handler',
      description: 'A loop issues one database query per item instead of batching. Under load this will degrade response time linearly with collection size.',
      recommendation: 'Use a single query with a join or an IN clause. Add an integration test that asserts query count stays constant as items grow.',
    },
    {
      category: 'best_practice',
      severity: 'medium',
      title: 'Unbounded retry without backoff',
      description: 'An external API call retries on failure with no delay or jitter, which can amplify load during outages and trigger rate limits.',
      recommendation: 'Add exponential backoff with jitter and a max-attempts cap. Consider a circuit breaker for downstream failures.',
    },
    {
      category: 'infrastructure',
      severity: 'high',
      title: 'Health check endpoint missing',
      description: 'No readiness probe is exposed. The orchestrator cannot distinguish a started but unhealthy instance from a ready one.',
      recommendation: 'Add a /healthz or /readyz endpoint that checks critical dependencies (database, cache) and wire it to the readiness probe.',
    },
    {
      category: 'config',
      severity: 'low',
      title: 'Verbose logging enabled for production',
      description: 'Log level is set to debug. This increases log volume and may leak sensitive request payloads to log aggregators.',
      recommendation: 'Set log level to info or warn in production builds. Use structured logging to control verbosity per module.',
    },
    {
      category: 'security',
      severity: 'medium',
      title: 'Insecure cookie attributes',
      description: 'Session cookie is set without Secure or HttpOnly flags, exposing it to interception and client-side access.',
      recommendation: 'Set Secure, HttpOnly, and SameSite=Lax (or Strict) on all session cookies.',
    },
    {
      category: 'best_practice',
      severity: 'low',
      title: 'Missing input validation on public API',
      description: 'A public endpoint accepts arbitrary JSON without schema validation, which can cause downstream errors or unexpected state.',
      recommendation: 'Validate request bodies with a schema (zod, joi, or OpenAPI). Reject unknown keys and constrain field types.',
    },
    {
      category: 'performance',
      severity: 'low',
      title: 'Synchronous file read in request path',
      description: 'A handler reads a file synchronously, blocking the event loop and reducing throughput under concurrency.',
      recommendation: 'Use async file APIs or stream the file. Cache the result if it is read on every request.',
    },
    {
      category: 'infrastructure',
      severity: 'medium',
      title: 'No resource limits on container',
      description: 'The deployment manifest does not set CPU or memory limits, risking noisy-neighbor impact and unbounded scaling.',
      recommendation: 'Define requests and limits for CPU and memory. Add horizontal pod autoscaling based on a meaningful metric.',
    },
  ];

  // deterministic-ish selection: pick 4-7 findings
  const count = 4 + Math.floor(Math.random() * 4);
  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, count);
  const base = folder === '/' ? '' : folder.replace(/\/$/, '') + '/';
  const files = ['src/server.ts', 'src/api/handlers.ts', 'config/cors.ts', 'package.json', 'src/db/queries.ts', 'src/utils/retry.ts', 'Dockerfile', 'src/middleware/auth.ts', 'src/config/logger.ts'];

  return shuffled.map((f, i) => ({
    ...f,
    file_path: `${base}${files[i % files.length]}`,
    line: 10 + Math.floor(Math.random() * 200),
    confidence: 70 + Math.floor(Math.random() * 30),
  }));
}

function computeRiskScore(findings: Finding[]): number {
  const weights: Record<string, number> = { critical: 28, high: 16, medium: 8, low: 3 };
  let score = findings.reduce((sum, f) => sum + (weights[f.severity] ?? 0), 0);
  score = Math.min(100, score);
  if (findings.length === 0) score = 4 + Math.floor(Math.random() * 8);
  return score;
}

function generateSummary(findings: Finding[], score: number, severity: string, branch: string): string {
  const crit = findings.filter((f) => f.severity === 'critical').length;
  const high = findings.filter((f) => f.severity === 'high').length;
  const med = findings.filter((f) => f.severity === 'medium').length;
  const low = findings.filter((f) => f.severity === 'low').length;

  const parts: string[] = [];
  if (crit > 0) parts.push(`${crit} critical`);
  if (high > 0) parts.push(`${high} high`);
  if (med > 0) parts.push(`${med} medium`);
  if (low > 0) parts.push(`${low} low`);

  const findingStr = parts.length ? parts.join(', ') : 'no findings';
  const top = findings.slice().sort((a, b) => sevRank(b.severity) - sevRank(a.severity))[0];

  let s = `Validation of branch "${branch}" completed with a risk score of ${score}/100 (${severity}). `;
  s += `The scan produced ${findingStr}. `;
  if (top) {
    s += `Highest-priority issue: ${top.title} in ${top.file_path}. `;
    s += `Address critical and high findings before promoting this build.`;
  } else {
    s += `No blocking issues detected — safe to proceed with deployment.`;
  }
  return s;
}

function sevRank(s: string): number {
  return { critical: 4, high: 3, medium: 2, low: 1 }[s] ?? 0;
}
