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
  { name: "Hardcoded Password Assignment", pattern: /(?:password|passwd|pwd)\s*[:=]\s*["']([^"'\s]{6,})["']/gi, severity: "medium" as "high", recommendation: "Avoid hardcoding passwords. Use environment variables or a secrets manager." },
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
// Dependency manifests we can resolve real CVEs for (via OSV.dev).
const MANIFESTS = new Set(["package.json", "requirements.txt", "go.mod"]);
const MAX_FILES = 60;
const MAX_FILE_SIZE = 100_000;
const MAX_DEPS = 400;         // cap OSV batch size
const MAX_VULN_DETAILS = 30;  // cap per-vuln detail fetches

function parseGitUrl(url: string): { owner: string; repo: string } | null {
  const sshMatch = url.match(/git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };
  const httpsMatch = url.match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?$/);
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] };
  return null;
}

async function fetchGitHubTree(owner: string, repo: string, branch: string, token: string | null): Promise<{ path: string; type: string }[] | null> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "lythouse" };
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
  const headers: Record<string, string> = { Accept: "application/vnd.github.raw+json", "User-Agent": "lythouse" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, { headers });
  if (!res.ok) return null;
  return await res.text();
}

function baseName(path: string): string { return path.split("/").pop() || path; }
function inSkippedDir(path: string): boolean { return path.split("/").some((p) => SKIP_DIRS.includes(p)); }

function shouldScan(path: string): boolean {
  if (inSkippedDir(path)) return false;
  if (path.includes(".env") || path.endsWith(".env")) return true;
  return SCAN_EXTENSIONS.some((ext) => path.endsWith(ext));
}
function isManifest(path: string): boolean {
  return !inSkippedDir(path) && MANIFESTS.has(baseName(path));
}

function scanContent(content: string, filePath: string): Finding[] {
  const findings: Finding[] = [];
  for (const { name, pattern, severity, recommendation } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split("\n").length;
      findings.push({ category: "secret_scan", severity, title: name, description: `Potential ${name} detected in ${filePath}:${lineNum}.`, file_path: filePath, line: lineNum, recommendation, confidence: severity === "critical" ? 95 : 80 });
    }
  }
  for (const { name, pattern, severity, recommendation, category } of SUSPICIOUS_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split("\n").length;
      findings.push({ category, severity, title: name, description: `${name} detected in ${filePath}:${lineNum}.`, file_path: filePath, line: lineNum, recommendation, confidence: 75 });
    }
  }
  return findings;
}

// ── Real dependency CVE scanning via OSV.dev ────────────────────────────────
interface Dep { ecosystem: string; name: string; version: string; manifest: string; }

function cleanVersion(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.match(/\d+\.\d+(?:\.\d+)?/);
  return m ? m[0] : null;
}
function parseNpm(content: string, manifest: string): Dep[] {
  try {
    const pkg = JSON.parse(content);
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const out: Dep[] = [];
    for (const [name, ver] of Object.entries(deps)) {
      const version = cleanVersion(ver);
      if (version) out.push({ ecosystem: "npm", name, version, manifest });
    }
    return out;
  } catch { return []; }
}
function parsePip(content: string, manifest: string): Dep[] {
  const out: Dep[] = [];
  for (let line of content.split("\n")) {
    line = line.split("#")[0].trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z0-9._-]+)\s*==\s*([0-9][^\s;]*)/);
    if (m) { const version = cleanVersion(m[2]); if (version) out.push({ ecosystem: "PyPI", name: m[1], version, manifest }); }
  }
  return out;
}
function parseGoMod(content: string, manifest: string): Dep[] {
  const out: Dep[] = [];
  for (let line of content.split("\n")) {
    line = line.trim();
    if (line.startsWith("require ")) line = line.slice(8).trim();  // single-line require form
    const m = line.match(/^([\w.\-/]+)\s+v(\d+\.\d+\.\d+[\w.\-]*)/);
    if (m && m[1] !== "go" && m[1] !== "module" && m[1] !== "require") out.push({ ecosystem: "Go", name: m[1], version: m[2], manifest });
  }
  return out;
}
function parseManifest(path: string, content: string): Dep[] {
  const b = baseName(path);
  if (b === "package.json") return parseNpm(content, path);
  if (b === "requirements.txt") return parsePip(content, path);
  if (b === "go.mod") return parseGoMod(content, path);
  return [];
}

async function osvBatch(deps: Dep[]): Promise<(string[] | null)[]> {
  const queries = deps.map((d) => ({ version: d.version, package: { name: d.name, ecosystem: d.ecosystem } }));
  try {
    const res = await fetch("https://api.osv.dev/v1/querybatch", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queries }),
    });
    if (!res.ok) { console.error("OSV batch failed", res.status); return deps.map(() => null); }
    const data = await res.json();
    return (data.results || []).map((r: { vulns?: { id: string }[] }) => (r.vulns ? r.vulns.map((v) => v.id) : []));
  } catch (e) { console.error("OSV batch error", (e as Error).message); return deps.map(() => null); }
}
async function osvVuln(id: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`https://api.osv.dev/v1/vulns/${id}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}
function osvSeverity(vuln: Record<string, unknown>): "low" | "medium" | "high" | "critical" {
  const ds = (vuln?.database_specific as { severity?: string })?.severity;
  if (typeof ds === "string") {
    const s = ds.toUpperCase();
    if (s === "CRITICAL") return "critical";
    if (s === "HIGH") return "high";
    if (s === "MODERATE" || s === "MEDIUM") return "medium";
    if (s === "LOW") return "low";
  }
  return "medium"; // conservative default when the advisory carries no rating
}
function osvFixedVersion(vuln: Record<string, unknown>): string | null {
  const affected = (vuln?.affected as { ranges?: { events?: { fixed?: string }[] }[] }[]) || [];
  for (const a of affected) for (const r of a.ranges || []) for (const ev of r.events || []) if (ev.fixed) return ev.fixed;
  return null;
}

async function scanDependenciesOSV(deps: Dep[]): Promise<Finding[]> {
  if (!deps.length) return [];
  // dedupe by ecosystem:name:version
  const seen = new Set<string>();
  const unique = deps.filter((d) => { const k = `${d.ecosystem}:${d.name}:${d.version}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, MAX_DEPS);

  const results = await osvBatch(unique);
  const findings: Finding[] = [];
  let detailBudget = MAX_VULN_DETAILS;

  for (let i = 0; i < unique.length; i++) {
    const ids = results[i];
    if (!ids || ids.length === 0) continue;
    const dep = unique[i];
    for (const id of ids) {
      let severity: "low" | "medium" | "high" | "critical" = "medium";
      let title = `${id} in ${dep.name}@${dep.version}`;
      let summary = "";
      let fixed: string | null = null;
      if (detailBudget > 0) {
        detailBudget--;
        const v = await osvVuln(id);
        if (v) {
          severity = osvSeverity(v);
          summary = (v.summary as string) || (v.details as string || "").slice(0, 200);
          fixed = osvFixedVersion(v);
        }
      }
      findings.push({
        category: "dependency_audit",
        severity,
        title: `Vulnerable dependency: ${dep.name}@${dep.version}`,
        description: `${id}${summary ? ` — ${summary}` : ""} (${dep.ecosystem}, from ${baseName(dep.manifest)})`,
        file_path: dep.manifest,
        line: null,
        recommendation: fixed ? `Upgrade ${dep.name} to ${fixed} or later.` : `Upgrade ${dep.name} to a patched version. See https://osv.dev/vulnerability/${id}`,
        confidence: 90,
      });
    }
  }
  return findings;
}

function calculateRiskScore(findings: Finding[]): { score: number; severity: "none" | "low" | "medium" | "high" | "critical" } {
  const weights = { critical: 25, high: 15, medium: 8, low: 3 };
  let score = 0;
  for (const f of findings) score += weights[f.severity];
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
  return `Scanned ${fileCount} files. Found ${findings.length} ${findings.length === 1 ? "issue" : "issues"}: ${parts.join(", ")}.`;
}

// ── AI reasoning layer ──────────────────────────────────────────────────────
// Rules decide the verdict (severity/score). The AI EXPLAINS it, grounded only
// in the real findings — it never invents anything and never overrides the call.
const SEV_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
async function aiExplain(
  projectName: string, branch: string, findings: Finding[],
  counts: Record<string, number>, score: number, severity: string, filesScanned: number,
): Promise<{ summary: string; actions: string[] } | null> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return null;
  const top = [...findings].sort((a, b) => (SEV_RANK[a.severity] - SEV_RANK[b.severity])).slice(0, 25)
    .map((f) => ({ severity: f.severity, category: f.category, title: f.title, file: f.file_path, line: f.line }));
  const evidence = { project: projectName, branch, filesScanned, riskScore: score, rulesVerdictSeverity: severity, counts, findings: top };
  const system = "You are LytHouse's release-validation analyst. You are given the REAL results of a static security analysis of a repository — secret scanning, insecure code patterns, and dependency CVEs from OSV. The ship/review/block decision is made by deterministic rules and is provided to you as `rulesVerdictSeverity` and `riskScore`; DO NOT override it. Explain, in plain language for the engineer who owns this release, what was found and whether it is safe to ship, grounded ONLY in the evidence provided. Never invent findings, CVE IDs, file names, or numbers. Reply with STRICT JSON only: {\"summary\": string (2-4 plain-English sentences that state the verdict and why), \"actions\": string[] (up to 3 concrete next steps; empty array if the release is clean)}.";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 700, system, messages: [{ role: "user", content: JSON.stringify(evidence) }] }),
    });
    if (!res.ok) { console.error("Anthropic call failed", res.status, await res.text()); return null; }
    const data = await res.json();
    const text = (data.content || []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n");
    const jsonStr = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = JSON.parse(jsonStr);
    return { summary: String(parsed.summary || "").trim(), actions: Array.isArray(parsed.actions) ? parsed.actions.map(String).slice(0, 3) : [] };
  } catch (e) { console.error("aiExplain error", (e as Error).message); return null; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { validationId } = await req.json();
    if (!validationId) return new Response(JSON.stringify({ error: "validationId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const { data: validation } = await sb.from("validations").select("*").eq("id", validationId).single();
    if (!validation) return new Response(JSON.stringify({ error: "validation not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: project } = await sb.from("projects").select("*").eq("id", validation.project_id).single();
    if (!project) {
      await sb.from("validations").update({ status: "failed", summary: "Project not found." }).eq("id", validationId);
      return new Response(JSON.stringify({ error: "project not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Real repo access: use the project's stored token (private repos) and branch.
    const ghToken: string | null = project.github_token || null;
    const branch: string = project.git_branch || "main";

    const startTime = Date.now();
    await sb.from("validations").update({ status: "running" }).eq("id", validationId);

    const steps = [
      { key: "repo_fetch", name: "Repository Fetch" },
      { key: "secret_scan", name: "Secret Scanning" },
      { key: "static_analysis", name: "Static Analysis" },
      { key: "dependency_audit", name: "Dependency Audit (OSV)" },
      { key: "risk_assessment", name: "AI Risk Analysis" },
    ];
    await sb.from("validation_steps").insert(steps.map((s, i) => ({ validation_id: validationId, step_index: i, key: s.key, name: s.name, status: "pending" as const })));

    // Step 1: Fetch repo tree
    let stepStart = Date.now();
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

    // Prioritise dependency manifests so they're never cut off by the file cap.
    const candidates = tree.filter((f) => f.type === "blob" && (shouldScan(f.path) || isManifest(f.path)));
    candidates.sort((a, b) => (isManifest(b.path) ? 1 : 0) - (isManifest(a.path) ? 1 : 0));
    const scanableFiles = candidates.slice(0, MAX_FILES);
    await sb.from("validation_steps").update({ status: "completed", detail: `Fetched ${tree.length} files from ${parsed.owner}/${parsed.repo} on branch ${branch}. ${scanableFiles.length} files to scan.`, duration_ms: Date.now() - stepStart, completed_at: new Date().toISOString() }).eq("validation_id", validationId).eq("key", "repo_fetch");

    // Steps 2 & 3: secret + static scanning over real file content
    for (const key of ["secret_scan", "static_analysis"]) {
      await sb.from("validation_steps").update({ status: "running", started_at: new Date().toISOString() }).eq("validation_id", validationId).eq("key", key);
    }
    const allFindings: Finding[] = [];
    const deps: Dep[] = [];
    let filesScanned = 0, secretCount = 0, staticCount = 0;
    stepStart = Date.now();

    for (const file of scanableFiles) {
      const content = await fetchFileContent(parsed.owner, parsed.repo, file.path, branch, ghToken);
      if (!content || content.length > MAX_FILE_SIZE) continue;
      filesScanned++;
      if (shouldScan(file.path)) {
        const fileFindings = scanContent(content, file.path);
        allFindings.push(...fileFindings);
        secretCount += fileFindings.filter((f) => f.category === "secret_scan").length;
        staticCount += fileFindings.filter((f) => f.category === "static_analysis").length;
      }
      if (isManifest(file.path)) deps.push(...parseManifest(file.path, content));
    }

    await sb.from("validation_steps").update({ status: "completed", detail: `Scanned ${filesScanned} files. Found ${secretCount} potential secret${secretCount === 1 ? "" : "s"}.`, duration_ms: Date.now() - stepStart, completed_at: new Date().toISOString() }).eq("validation_id", validationId).eq("key", "secret_scan");
    await sb.from("validation_steps").update({ status: "completed", detail: `Found ${staticCount} insecure code pattern${staticCount === 1 ? "" : "s"}.`, duration_ms: Date.now() - stepStart, completed_at: new Date().toISOString() }).eq("validation_id", validationId).eq("key", "static_analysis");

    // Step 4: real dependency CVEs via OSV.dev
    stepStart = Date.now();
    await sb.from("validation_steps").update({ status: "running", started_at: new Date().toISOString() }).eq("validation_id", validationId).eq("key", "dependency_audit");
    const depFindings = await scanDependenciesOSV(deps);
    allFindings.push(...depFindings);
    await sb.from("validation_steps").update({ status: "completed", detail: `Checked ${Math.min(deps.length, MAX_DEPS)} dependencies against OSV. Found ${depFindings.length} vulnerable ${depFindings.length === 1 ? "dependency" : "dependencies"}.`, duration_ms: Date.now() - stepStart, completed_at: new Date().toISOString() }).eq("validation_id", validationId).eq("key", "dependency_audit");

    // Step 5: rules score the risk; the AI explains it in plain language.
    stepStart = Date.now();
    await sb.from("validation_steps").update({ status: "running", started_at: new Date().toISOString() }).eq("validation_id", validationId).eq("key", "risk_assessment");

    const { score, severity } = calculateRiskScore(allFindings);
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    allFindings.forEach((f) => counts[f.severity]++);

    const ai = await aiExplain(project.name, branch, allFindings, counts, score, severity, filesScanned);
    let summary = ai?.summary || buildSummary(allFindings, filesScanned);
    if (ai?.actions?.length) summary += `\n\nRecommended next steps:\n` + ai.actions.map((a) => `• ${a}`).join("\n");

    await sb.from("validation_steps").update({ status: "completed", detail: `Risk score ${score}/100 (${severity}). ${ai ? "AI analysis complete." : "AI analysis unavailable — used deterministic summary."}`, duration_ms: Date.now() - stepStart, completed_at: new Date().toISOString() }).eq("validation_id", validationId).eq("key", "risk_assessment");

    if (allFindings.length > 0) {
      await sb.from("findings").insert(allFindings.map((f) => ({ validation_id: validationId, project_id: validation.project_id, ...f })));
    }

    const totalDuration = Date.now() - startTime;
    await sb.from("validations").update({
      status: "completed", risk_score: score, severity, summary,
      total_findings: allFindings.length,
      critical_count: counts.critical, high_count: counts.high, medium_count: counts.medium, low_count: counts.low,
      duration_ms: totalDuration, completed_at: new Date().toISOString(),
    }).eq("id", validationId);

    await sb.from("audit_logs").insert({
      workspace_id: validation.workspace_id, action: "validation_run", entity_type: "validation", entity_id: validationId,
      metadata: { project_id: validation.project_id, findings: allFindings.length, risk_score: score, severity, ai_analysis: !!ai },
    });

    return new Response(JSON.stringify({ success: true, validationId, filesScanned, findings: allFindings.length, riskScore: score, severity, summary, ai_analysis: !!ai }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
