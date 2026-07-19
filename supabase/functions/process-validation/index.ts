import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Finding {
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  file_path: string | null;
  line: number | null;
  recommendation: string | null;
  confidence: number | null;
}

const SECRET_PATTERNS: { name: string; pattern: RegExp; severity: "high" | "critical"; recommendation: string }[] = [
  { name: "AWS Access Key", pattern: /AKIA[0-9A-Z]{16}/g, severity: "critical", recommendation: "Move to environment variable or secrets manager. Never commit AWS keys to source." },
  { name: "GitHub Personal Access Token", pattern: /ghp_[A-Za-z0-9]{36}/g, severity: "critical", recommendation: "Revoke this token immediately at github.com/settings/tokens and use environment variables." },
  { name: "GitHub Fine-grained Token", pattern: /github_pat_[A-Za-z0-9_]{22,}/g, severity: "critical", recommendation: "Revoke this token immediately and use environment variables." },
  { name: "Google API Key", pattern: /AIza[0-9A-Za-z\-_]{35}/g, severity: "high", recommendation: "Move to environment variable. Restrict API key usage in Google Cloud Console." },
  { name: "Slack Token", pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/g, severity: "high", recommendation: "Revoke this Slack token and use environment variables." },
  { name: "Stripe Secret Key", pattern: /sk_live_[0-9A-Za-z]{24,}/g, severity: "critical", recommendation: "Revoke this Stripe key immediately and rotate. Use environment variables." },
  { name: "Generic High-entropy Secret", pattern: /(?:password|secret|token|api_key|apikey|private_key)\s*[:=]\s*["']([A-Za-z0-9+/=_\-]{20,})["']/gi, severity: "high", recommendation: "Move this secret to an environment variable or secrets manager." },
  { name: "Private Key Block", pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, severity: "critical", recommendation: "Remove this private key from source. Rotate the key immediately." },
  { name: "JWT Secret", pattern: /jwt[_-]?secret\s*[:=]\s*["']([A-Za-z0-9+/=_\-]{16,})["']/gi, severity: "high", recommendation: "Move JWT signing secret to environment variable." },
  { name: "Database URL with Credentials", pattern: /postgres(?:ql)?:\/\/[^:]+:[^@]+@[^\s]+/gi, severity: "high", recommendation: "Remove embedded credentials from connection string. Use environment variable." },
  { name: "Hardcoded Password Assignment", pattern: /(?:password|passwd|pwd)\s*[:=]\s*["']([^"'\s]{6,})["']/gi, severity: "medium", recommendation: "Avoid hardcoding passwords. Use environment variables or a secrets manager." },
];

const SUSPICIOUS_PATTERNS: { name: string; pattern: RegExp; severity: "medium" | "high"; recommendation: string; category: string }[] = [
  { name: "eval() usage", pattern: /\beval\s*\(/g, severity: "medium", recommendation: "Avoid eval() — it enables code injection. Use JSON.parse() or a safe alternative.", category: "static_analysis" },
  { name: "innerHTML assignment", pattern: /\.innerHTML\s*=/g, severity: "medium", recommendation: "Use textContent or sanitize input to prevent XSS.", category: "static_analysis" },
  { name: "dangerouslySetInnerHTML", pattern: /dangerouslySetInnerHTML/g, severity: "high", recommendation: "Ensure content is sanitized before using dangerouslySetInnerHTML.", category: "static_analysis" },
  { name: "exec() call", pattern: /\bexec\s*\(/g, severity: "high", recommendation: "Avoid exec() — it enables command injection. Use spawn() with argument arrays.", category: "static_analysis" },
  { name: "Disabled HTTPS verification", pattern: /rejectUnauthorized\s*:\s*false|verify\s*:\s*false|ssl\s*verify\s*:\s*none/gi, severity: "high", recommendation: "Do not disable TLS verification. Fix the certificate issue instead.", category: "static_analysis" },
  { name: "CORS wildcard", pattern: /Access-Control-Allow-Origin["']?\s*[:=]\s*["']\*["']/g, severity: "medium", recommendation: "Restrict CORS to specific origins instead of wildcard.", category: "static_analysis" },
  { name: "SQL string concatenation", pattern: /(?:query|execute|raw)\s*\(\s*["'`].*\$\{/gi, severity: "high", recommendation: "Use parameterized queries instead of string interpolation in SQL.", category: "static_analysis" },
];

const SKIP_DIRS = ["node_modules", ".git", "dist", "build", ".next", "__pycache__", ".cache", "vendor", ".venv", "venv", "coverage", ".nuxt", ".output"];
const SCAN_EXTENSIONS = [".js", ".ts", ".jsx", ".tsx", ".py", ".rb", ".go", ".rs", ".java", ".kt", ".php", ".env", ".sh", ".yaml", ".yml", ".json", ".toml", ".config", ".vue", ".svelte"];
const MAX_FILES = 50;
const MAX_FILE_SIZE = 100_000;

function parseGitUrl(url: string): { owner: string; repo: string } | null {
  const sshMatch = url.match(/git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };
  const httpsMatch = url.match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?$/);
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] };
  return null;
}

async function fetchGitHubTree(owner: string, repo: string, branch: string, token: string | null): Promise<{ path: string; type: string }[] | null> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "sandbox-ai" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, { headers });
  if (!res.ok) {
    const text = await res.text();
    console.error(`GitHub tree fetch failed: ${res.status} ${text}`);
    return null;
  }
  const data = await res.json();
  return data.tree as { path: string; type: string }[];
}

async function fetchFileContent(owner: string, repo: string, path: string, branch: string, token: string | null): Promise<string | null> {
  const headers: Record<string, string> = { Accept: "application/vnd.github.raw+json", "User-Agent": "sandbox-ai" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, { headers });
  if (!res.ok) return null;
  return await res.text();
}

function shouldScan(path: string): boolean {
  const parts = path.split("/");
  if (parts.some((p) => SKIP_DIRS.includes(p))) return false;
  if (path.includes(".env") || path.endsWith(".env")) return true;
  return SCAN_EXTENSIONS.some((ext) => path.endsWith(ext));
}

function scanContent(content: string, filePath: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split("\n");

  for (const { name, pattern, severity, recommendation } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split("\n").length;
      findings.push({
        category: "secret_scan",
        severity,
        title: name,
        description: `Potential ${name} detected in ${filePath}:${lineNum}.`,
        file_path: filePath,
        line: lineNum,
        recommendation,
        confidence: severity === "critical" ? 95 : 80,
      });
    }
  }

  for (const { name, pattern, severity, recommendation, category } of SUSPICIOUS_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split("\n").length;
      findings.push({
        category,
        severity,
        title: name,
        description: `${name} detected in ${filePath}:${lineNum}.`,
        file_path: filePath,
        line: lineNum,
        recommendation,
        confidence: 75,
      });
    }
  }

  return findings;
}

function scanDependencies(content: string, filePath: string): Finding[] {
  const findings: Finding[] = [];
  try {
    const pkg = JSON.parse(content);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const vulnerablePackages: Record<string, { severity: "medium" | "high" | "critical"; reason: string; recommendation: string }> = {
      "lodash": { severity: "high", reason: "lodash < 4.17.21 has prototype pollution vulnerabilities (CVE-2021-23337).", recommendation: "Upgrade lodash to ^4.17.21 or later." },
      "axios": { severity: "high", reason: "axios < 0.21.1 has SSRF and prototype pollution vulnerabilities.", recommendation: "Upgrade axios to ^1.6.0 or later." },
      "minimist": { severity: "high", reason: "minimist < 1.2.6 has prototype pollution vulnerability (CVE-2021-44906).", recommendation: "Upgrade minimist to ^1.2.6 or later." },
      "handlebars": { severity: "high", reason: "handlebars < 4.7.7 has prototype pollution and RCE vulnerabilities.", recommendation: "Upgrade handlebars to ^4.7.7 or later." },
      "moment": { severity: "medium", reason: "moment.js is deprecated and has ReDoS vulnerabilities in older versions.", recommendation: "Consider migrating to date-fns or day.js. If staying, upgrade to latest." },
      "node-fetch": { severity: "medium", reason: "node-fetch < 2.6.7 / 3.2.10 has SSRF vulnerability.", recommendation: "Upgrade node-fetch to latest version." },
      "ws": { severity: "high", reason: "ws < 8.17.1 has DoS vulnerability via overly large HTTP headers (CVE-2024-37890).", recommendation: "Upgrade ws to ^8.17.1 or later." },
      "jsonwebtoken": { severity: "high", reason: "jsonwebtoken < 9.0.0 has signature verification bypass in some configurations.", recommendation: "Upgrade jsonwebtoken to ^9.0.0 or later." },
      "express-jwt": { severity: "high", reason: "express-jwt < 6.0.1 has auth bypass when algorithms not specified.", recommendation: "Upgrade express-jwt and explicitly set algorithms." },
    };
    for (const [name, info] of Object.entries(vulnerablePackages)) {
      if (deps[name]) {
        const version = deps[name];
        findings.push({
          category: "dependency_audit",
          severity: info.severity,
          title: `Vulnerable dependency: ${name}`,
          description: `${info.reason} Found version: ${version}`,
          file_path: filePath,
          line: null,
          recommendation: info.recommendation,
          confidence: 85,
        });
      }
    }
  } catch {
    // Not valid JSON, skip
  }
  return findings;
}

function calculateRiskScore(findings: Finding[]): { score: number; severity: "none" | "low" | "medium" | "high" | "critical" } {
  const weights = { critical: 25, high: 15, medium: 8, low: 3 };
  let score = 0;
  for (const f of findings) {
    score += weights[f.severity];
  }
  score = Math.min(100, score);
  let severity: "none" | "low" | "medium" | "high" | "critical" = "none";
  if (score >= 75 || findings.some((f) => f.severity === "critical")) severity = "critical";
  else if (score >= 50) severity = "high";
  else if (score >= 25) severity = "medium";
  else if (score > 0) severity = "low";
  return { score, severity };
}

function buildSummary(findings: Finding[], fileCount: number): string {
  if (findings.length === 0) return `Scanned ${fileCount} files. No security issues detected.`;
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  findings.forEach((f) => counts[f.severity]++);
  const parts: string[] = [];
  if (counts.critical) parts.push(`${counts.critical} critical`);
  if (counts.high) parts.push(`${counts.high} high`);
  if (counts.medium) parts.push(`${counts.medium} medium`);
  if (counts.low) parts.push(`${counts.low} low`);
  return `Scanned ${fileCount} files. Found ${findings.length} security ${findings.length === 1 ? "issue" : "issues"}: ${parts.join(", ")}.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { validationId } = await req.json();
    if (!validationId) {
      return new Response(JSON.stringify({ error: "validationId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Fetch the validation + project
    const { data: validation } = await sb.from("validations").select("*").eq("id", validationId).single();
    if (!validation) {
      return new Response(JSON.stringify({ error: "validation not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: project } = await sb.from("projects").select("*").eq("id", validation.project_id).single();
    if (!project) {
      await sb.from("validations").update({ status: "failed", summary: "Project not found." }).eq("id", validationId);
      return new Response(JSON.stringify({ error: "project not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Public repos need no token; private repos do. We try the token if present
    // and fall back to unauthenticated for public repos.
    const ghToken: string | null = ghToken || null;
    const branch: string = branch || "main";

    const startTime = Date.now();

    // Set validation to running
    await sb.from("validations").update({ status: "running" }).eq("id", validationId);

    // Create validation steps
    const steps = [
      { key: "repo_fetch", name: "Repository Fetch" },
      { key: "secret_scan", name: "Secret Scanning" },
      { key: "static_analysis", name: "Static Analysis" },
      { key: "dependency_audit", name: "Dependency Audit" },
      { key: "risk_assessment", name: "Risk Assessment" },
    ];
    const stepRows = steps.map((s, i) => ({
      validation_id: validationId,
      step_index: i,
      key: s.key,
      name: s.name,
      status: "pending" as const,
    }));
    await sb.from("validation_steps").insert(stepRows);

    // Step 1: Fetch repo tree
    const stepStart = Date.now();
    await sb.from("validation_steps").update({ status: "running", started_at: new Date().toISOString() }).eq("validation_id", validationId).eq("key", "repo_fetch");

    const parsed = parseGitUrl(project.git_url);
    if (!parsed) {
      await sb.from("validation_steps").update({ status: "failed", detail: `Could not parse git URL: ${project.git_url}`, duration_ms: Date.now() - stepStart, completed_at: new Date().toISOString() }).eq("validation_id", validationId).eq("key", "repo_fetch");
      await sb.from("validations").update({ status: "failed", summary: `Could not parse git URL: ${project.git_url}` }).eq("id", validationId);
      return new Response(JSON.stringify({ error: "invalid git url" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const tree = await fetchGitHubTree(parsed.owner, parsed.repo, branch, ghToken);
    if (!tree) {
      await sb.from("validation_steps").update({ status: "failed", detail: "Failed to fetch repository tree. Check the token has repo scope and the branch exists.", duration_ms: Date.now() - stepStart, completed_at: new Date().toISOString() }).eq("validation_id", validationId).eq("key", "repo_fetch");
      await sb.from("validations").update({ status: "failed", summary: "Failed to fetch repository from GitHub. Verify the token has 'repo' scope and the branch name is correct." }).eq("id", validationId);
      return new Response(JSON.stringify({ error: "github fetch failed" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const scanableFiles = tree.filter((f) => f.type === "blob" && shouldScan(f.path)).slice(0, MAX_FILES);
    await sb.from("validation_steps").update({ status: "completed", detail: `Fetched ${tree.length} files from ${parsed.owner}/${parsed.repo} on branch ${branch}. ${scanableFiles.length} files to scan.`, duration_ms: Date.now() - stepStart, completed_at: new Date().toISOString() }).eq("validation_id", validationId).eq("key", "repo_fetch");

    // Step 2 & 3 & 4: Scan files for secrets, static analysis, and dependencies
    const allFindings: Finding[] = [];
    let filesScanned = 0;

    // Mark all three scan steps as running
    for (const key of ["secret_scan", "static_analysis", "dependency_audit"]) {
      await sb.from("validation_steps").update({ status: "running", started_at: new Date().toISOString() }).eq("validation_id", validationId).eq("key", key);
    }

    const secretStart = Date.now();
    const staticStart = Date.now();
    const depStart = Date.now();
    let secretCount = 0, staticCount = 0, depCount = 0;

    for (const file of scanableFiles) {
      const content = await fetchFileContent(parsed.owner, parsed.repo, file.path, branch, ghToken);
      if (!content || content.length > MAX_FILE_SIZE) continue;
      filesScanned++;

      const fileFindings = scanContent(content, file.path);
      allFindings.push(...fileFindings);
      secretCount += fileFindings.filter((f) => f.category === "secret_scan").length;
      staticCount += fileFindings.filter((f) => f.category === "static_analysis").length;

      if (file.path.endsWith("package.json")) {
        const depFindings = scanDependencies(content, file.path);
        allFindings.push(...depFindings);
        depCount += depFindings.length;
      }
    }

    await sb.from("validation_steps").update({ status: "completed", detail: `Scanned ${filesScanned} files. Found ${secretCount} potential secrets.`, duration_ms: Date.now() - secretStart, completed_at: new Date().toISOString() }).eq("validation_id", validationId).eq("key", "secret_scan");
    await sb.from("validation_steps").update({ status: "completed", detail: `Found ${staticCount} code quality / security issues.`, duration_ms: Date.now() - staticStart, completed_at: new Date().toISOString() }).eq("validation_id", validationId).eq("key", "static_analysis");
    await sb.from("validation_steps").update({ status: "completed", detail: depCount > 0 ? `Found ${depCount} vulnerable dependencies.` : "No known vulnerable dependencies detected.", duration_ms: Date.now() - depStart, completed_at: new Date().toISOString() }).eq("validation_id", validationId).eq("key", "dependency_audit");

    // Step 5: Risk assessment
    const riskStart = Date.now();
    await sb.from("validation_steps").update({ status: "running", started_at: new Date().toISOString() }).eq("validation_id", validationId).eq("key", "risk_assessment");

    const { score, severity } = calculateRiskScore(allFindings);
    const summary = buildSummary(allFindings, filesScanned);
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    allFindings.forEach((f) => counts[f.severity]++);

    await sb.from("validation_steps").update({ status: "completed", detail: `Risk score: ${score}/100. Severity: ${severity}.`, duration_ms: Date.now() - riskStart, completed_at: new Date().toISOString() }).eq("validation_id", validationId).eq("key", "risk_assessment");

    // Insert findings
    if (allFindings.length > 0) {
      const findingRows = allFindings.map((f) => ({
        validation_id: validationId,
        project_id: validation.project_id,
        ...f,
      }));
      await sb.from("findings").insert(findingRows);
    }

    // Update validation with results
    const totalDuration = Date.now() - startTime;
    await sb.from("validations").update({
      status: "completed",
      risk_score: score,
      severity,
      summary,
      total_findings: allFindings.length,
      critical_count: counts.critical,
      high_count: counts.high,
      medium_count: counts.medium,
      low_count: counts.low,
      duration_ms: totalDuration,
      completed_at: new Date().toISOString(),
    }).eq("id", validationId);

    // Write audit log
    await sb.from("audit_logs").insert({
      workspace_id: validation.workspace_id,
      action: "validation_run",
      entity_type: "validation",
      entity_id: validationId,
      metadata: { project_id: validation.project_id, findings: allFindings.length, risk_score: score, severity },
    });

    return new Response(JSON.stringify({
      success: true,
      validationId,
      filesScanned,
      findings: allFindings.length,
      riskScore: score,
      severity,
      summary,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
