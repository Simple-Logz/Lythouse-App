// @ts-nocheck
// Shared, per-session in-memory cache for GitHub reads. Discovery, Validation
// and DetailedFindings all go through here, so a project's tree and files are
// fetched ONCE and reused — which avoids exhausting GitHub's 60/hour anonymous
// rate limit when opening several projects or switching stages.

const trees = new Map();
const files = new Map();

export function parseGitUrl(url) {
  const m = (url || '').match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?(?:$|\/)/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

// Returns { paths, parsed, branch } or { error: 'not-github'|'not-found'|'rate-limit'|'error'|'network' }
export async function getTree(project) {
  const parsed = parseGitUrl(project.git_url);
  if (!parsed) return { error: 'not-github' };
  const branch = project.git_branch || 'main';
  const key = `${parsed.owner}/${parsed.repo}#${branch}`;
  if (trees.has(key)) return trees.get(key);
  const headers = { Accept: 'application/vnd.github+json' };
  if (project.github_token) headers.Authorization = 'Bearer ' + project.github_token;
  let result;
  try {
    const r = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${branch}?recursive=1`, { headers });
    if (r.status === 404) result = { error: 'not-found' };
    else if (r.status === 403) result = { error: 'rate-limit' };
    else if (!r.ok) result = { error: 'error', status: r.status };
    else { const d = await r.json(); const blobs = (d.tree || []).filter((t) => t.type === 'blob'); result = { paths: blobs.map((t) => t.path), blobs: Object.fromEntries(blobs.map((t) => [t.path, t.sha])), parsed, branch }; }
  } catch { result = { error: 'network' }; }
  if (!result.error) trees.set(key, result); // only cache successes; errors can be retried
  return result;
}

export async function getFile(project, path) {
  const parsed = parseGitUrl(project.git_url);
  if (!parsed) return null;
  const branch = project.git_branch || 'main';
  const key = `${parsed.owner}/${parsed.repo}#${branch}#${path}`;
  if (files.has(key)) return files.get(key);
  const headers = { Accept: 'application/vnd.github.raw' };
  if (project.github_token) headers.Authorization = 'Bearer ' + project.github_token;
  let content = null;
  try { const r = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${branch}`, { headers }); content = r.ok ? await r.text() : null; } catch { content = null; }
  if (content != null) files.set(key, content);
  return content;
}

// ── Persistent report cache (localStorage) ───────────────────────────────
// Stores the FINAL computed report so a project keeps its analysis across
// page reloads and sessions — no GitHub re-fetch, no rate-limit dependency.
const CACHE_VERSION = 'v4';
function reportKey(kind, project) {
  const p = parseGitUrl(project.git_url);
  const b = project.git_branch || 'main';
  return `lh_report_${CACHE_VERSION}_${kind}_${p ? p.owner + '/' + p.repo : project.id}#${b}`;
}
export function loadReport(kind, project) {
  try { const s = localStorage.getItem(reportKey(kind, project)); return s ? JSON.parse(s) : null; } catch { return null; }
}
export function saveReport(kind, project, data) {
  try { localStorage.setItem(reportKey(kind, project), JSON.stringify({ t: Date.now(), data })); } catch {}
}
export function clearReport(kind, project) {
  try { localStorage.removeItem(reportKey(kind, project)); } catch {}
}

// Latest commit SHA of the branch head (cheap — used for change detection).
export async function getHeadSha(project) {
  const parsed = parseGitUrl(project.git_url); if (!parsed) return null;
  const branch = project.git_branch || 'main';
  const headers = { Accept: 'application/vnd.github+json' };
  if (project.github_token) headers.Authorization = 'Bearer ' + project.github_token;
  try { const r = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits/${branch}`, { headers }); if (!r.ok) return null; return (await r.json()).sha; } catch { return null; }
}

// What changed between two commits (files + count) — the basis for impact.
export async function getCompare(project, base, head) {
  const parsed = parseGitUrl(project.git_url); if (!parsed || !base || !head) return null;
  const headers = { Accept: 'application/vnd.github+json' };
  if (project.github_token) headers.Authorization = 'Bearer ' + project.github_token;
  try {
    const r = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/compare/${base}...${head}`, { headers });
    if (!r.ok) return null;
    const d = await r.json();
    return { ahead: d.ahead_by || 0, files: (d.files || []).map((f) => f.filename), commits: (d.commits || []).length };
  } catch { return null; }
}

export const ERROR_TEXT = {
  'not-github': 'Live analysis currently supports GitHub repositories only. This project uses a different provider (GitLab, Bitbucket, Azure, or a non-GitHub URL), so the report can’t be generated yet.',
  'not-found': 'The repository or branch couldn’t be reached. Private repositories need a token (import them with one), and the branch must exist.',
  'rate-limit': 'GitHub’s hourly rate limit was hit (public repos are limited to 60 requests/hour without a token). Reopen this project in a little while, or connect a token to raise the limit.',
  'error': 'GitHub returned an unexpected error reading this repository.',
  'network': 'Couldn’t reach GitHub to analyze this repository.',
};
