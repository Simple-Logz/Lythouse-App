// Browser-safe repository cache. No repository credential is ever read or sent here.
// Public GitHub repositories may be read anonymously; private repository operations
// must go through authenticated server-side LytHouse functions.

const trees = new Map<string, any>();
const files = new Map<string, string>();

export function parseGitUrl(url?: string) {
  const m = (url || '').match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?(?:$|\/)/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

function headers(raw = false): HeadersInit {
  return { Accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github+json' };
}

export async function getTree(project: any) {
  const parsed = parseGitUrl(project.git_url);
  if (!parsed) return { error: 'not-github' };
  const branch = project.git_branch || 'main';
  const key = `${parsed.owner}/${parsed.repo}#${branch}`;
  if (trees.has(key)) return trees.get(key);
  let result: any;
  try {
    const r = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, { headers: headers() });
    if (r.status === 404) result = { error: 'private-or-not-found' };
    else if (r.status === 403) result = { error: 'rate-limit' };
    else if (!r.ok) result = { error: 'error', status: r.status };
    else { const d = await r.json(); const blobs = (d.tree || []).filter((t: any) => t.type === 'blob'); result = { paths: blobs.map((t: any) => t.path), blobs: Object.fromEntries(blobs.map((t: any) => [t.path, t.sha])), parsed, branch }; }
  } catch { result = { error: 'network' }; }
  if (!result.error) trees.set(key, result);
  return result;
}

export async function getFile(project: any, path: string) {
  const parsed = parseGitUrl(project.git_url); if (!parsed) return null;
  const branch = project.git_branch || 'main';
  const key = `${parsed.owner}/${parsed.repo}#${branch}#${path}`;
  if (files.has(key)) return files.get(key)!;
  try {
    const safePath = path.split('/').map(encodeURIComponent).join('/');
    const r = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/${safePath}?ref=${encodeURIComponent(branch)}`, { headers: headers(true) });
    const content = r.ok ? await r.text() : null;
    if (content != null) files.set(key, content);
    return content;
  } catch { return null; }
}

const CACHE_VERSION = 'v5';
function reportKey(kind: string, project: any) { const p = parseGitUrl(project.git_url); const b = project.git_branch || 'main'; return `lh_report_${CACHE_VERSION}_${kind}_${p ? p.owner + '/' + p.repo : project.id}#${b}`; }
export function loadReport(kind: string, project: any) { try { const s = localStorage.getItem(reportKey(kind, project)); return s ? JSON.parse(s) : null; } catch { return null; } }
export function saveReport(kind: string, project: any, data: any) { try { localStorage.setItem(reportKey(kind, project), JSON.stringify({ t: Date.now(), data })); } catch {} }
export function clearReport(kind: string, project: any) { try { localStorage.removeItem(reportKey(kind, project)); } catch {} }

export async function getHeadSha(project: any) {
  const parsed = parseGitUrl(project.git_url); if (!parsed) return null;
  const branch = project.git_branch || 'main';
  try { const r = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits/${encodeURIComponent(branch)}`, { headers: headers() }); return r.ok ? (await r.json()).sha : null; } catch { return null; }
}

export async function getCompare(project: any, base: string, head: string) {
  const parsed = parseGitUrl(project.git_url); if (!parsed || !base || !head) return null;
  try {
    const r = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`, { headers: headers() });
    if (!r.ok) return null;
    const d = await r.json();
    const commits = (d.commits || []).map((c: any) => ({ sha:c.sha, short:(c.sha||'').slice(0,7), message:(c.commit?.message||'').split('\n')[0], authorEmail:c.commit?.author?.email||null, authorLogin:c.author?.login||null, date:c.commit?.author?.date||null, url:c.html_url||null }));
    const changedFiles = (d.files || []).map((f: any) => ({ filename:f.filename, status:f.status||'modified', additions:f.additions||0, deletions:f.deletions||0, url:f.blob_url||null }));
    return { ahead:d.ahead_by||0, commits, files:changedFiles, fileNames:changedFiles.map((f:any)=>f.filename), commitCount:commits.length, permalink:d.permalink_url||d.html_url||null };
  } catch { return null; }
}

export const ERROR_TEXT: Record<string,string> = {
  'not-github': 'Live browser analysis currently supports GitHub repositories only.',
  'private-or-not-found': 'This repository is private or unavailable to anonymous GitHub access. Private repository evidence is accessed only through LytHouse server-side connectors; credentials are never exposed to this browser.',
  'rate-limit': 'GitHub anonymous API rate limit reached. Server-side connected repository validation remains available.',
  'error': 'GitHub returned an unexpected repository error.',
  'network': 'Couldn’t reach GitHub to analyze this repository.',
};
