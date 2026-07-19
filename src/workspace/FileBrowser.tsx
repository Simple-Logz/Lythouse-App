// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { X, Folder, File as FileIcon, ChevronRight, ChevronDown, Loader as Loader2, Save, Edit3, ExternalLink } from 'lucide-react';
import { getTree, ERROR_TEXT } from './repoCache';

function parseGitUrl(url) { const m = (url || '').match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?(?:$|\/)/); return m ? { owner: m[1], repo: m[2] } : null; }

// Read a file (with its sha, needed for saving) directly from GitHub.
async function readFile(project, path) {
  const p = parseGitUrl(project.git_url); if (!p) return null;
  const branch = project.git_branch || 'main';
  const headers = { Accept: 'application/vnd.github+json' };
  if (project.github_token) headers.Authorization = 'Bearer ' + project.github_token;
  try {
    const r = await fetch(`https://api.github.com/repos/${p.owner}/${p.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${branch}`, { headers });
    if (!r.ok) return { error: r.status === 403 ? 'binary or too large' : `HTTP ${r.status}` };
    const d = await r.json();
    if (Array.isArray(d)) return { error: 'directory' };
    if (d.encoding !== 'base64') return { error: 'unsupported encoding' };
    return { sha: d.sha, content: decodeURIComponent(escape(atob((d.content || '').replace(/\n/g, '')))), html: d.html_url };
  } catch (e) { return { error: e.message }; }
}
async function saveFile(project, path, content, sha) {
  const p = parseGitUrl(project.git_url); if (!p) throw new Error('No GitHub repo.');
  if (!project.github_token) throw new Error('Saving needs a GitHub token with write access. Connect this repo with a token, or edit on GitHub.');
  const branch = project.git_branch || 'main';
  const b64 = btoa(unescape(encodeURIComponent(content)));
  const r = await fetch(`https://api.github.com/repos/${p.owner}/${p.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'PUT', headers: { Authorization: 'Bearer ' + project.github_token, 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' },
    body: JSON.stringify({ message: `edit ${path} [lythouse]`, content: b64, sha, branch }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || `HTTP ${r.status}`);
  return d.content?.sha;
}

function buildTree(paths) {
  const root = {};
  for (const path of paths) {
    const parts = path.split('/'); let cur = root;
    parts.forEach((part, i) => { const isFile = i === parts.length - 1; cur[part] = cur[part] || { __file: isFile, __path: parts.slice(0, i + 1).join('/'), children: {} }; cur = cur[part].children; });
  }
  return root;
}

function TreeNode({ node, name, depth, onSelect, selected, expanded, toggle }) {
  const isFile = node.__file; const open = expanded.has(node.__path);
  const kids = Object.entries(node.children).sort((a, b) => { const af = a[1].__file, bf = b[1].__file; return af === bf ? a[0].localeCompare(b[0]) : af ? 1 : -1; });
  return (
    <div>
      <button onClick={() => (isFile ? onSelect(node.__path) : toggle(node.__path))} className={`flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-sm hover:bg-gray-50 ${selected === node.__path ? 'bg-brand-50 text-brand-700' : 'text-navy-700'}`} style={{ paddingLeft: depth * 14 + 8 }}>
        {isFile ? <FileIcon size={14} className="shrink-0 text-gray-400" /> : (open ? <ChevronDown size={14} className="shrink-0 text-gray-400" /> : <ChevronRight size={14} className="shrink-0 text-gray-400" />)}
        {!isFile && <Folder size={14} className="shrink-0 text-brand-400" />}
        <span className="truncate">{name}</span>
      </button>
      {!isFile && open && kids.map(([n, c]) => <TreeNode key={c.__path} node={c} name={n} depth={depth + 1} onSelect={onSelect} selected={selected} expanded={expanded} toggle={toggle} />)}
    </div>
  );
}

export function FileBrowser({ project, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paths, setPaths] = useState([]);
  const [expanded, setExpanded] = useState(new Set());
  const [selected, setSelected] = useState(null);
  const [file, setFile] = useState(null); // {sha, content, html}
  const [fileLoading, setFileLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  useEffect(() => {
    (async () => { const t = await getTree(project); if (t.error) { setError(ERROR_TEXT[t.error]); setLoading(false); return; } setPaths(t.paths); setLoading(false); })();
  }, [project.git_url]);

  const tree = useMemo(() => buildTree(paths), [paths]);
  const toggle = (p) => setExpanded((s) => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n; });
  const select = async (p) => {
    setSelected(p); setEditing(false); setSaveMsg(null); setFileLoading(true); setFile(null);
    const r = await readFile(project, p); setFileLoading(false);
    if (r?.error) setFile({ error: r.error, html: r.html }); else { setFile(r); setDraft(r.content); }
  };
  const doSave = async () => {
    setSaving(true); setSaveMsg(null);
    try { const newSha = await saveFile(project, selected, draft, file.sha); setFile({ ...file, sha: newSha, content: draft }); setEditing(false); setSaveMsg({ ok: 'Saved & committed to ' + (project.git_branch || 'main') + '.' }); }
    catch (e) { setSaveMsg({ err: e.message }); }
    finally { setSaving(false); }
  };

  const topKids = Object.entries(tree).sort((a, b) => { const af = a[1].__file, bf = b[1].__file; return af === bf ? a[0].localeCompare(b[0]) : af ? 1 : -1; });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-5xl h-[85vh] animate-scale-in rounded-xl bg-white shadow-xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold flex items-center gap-2"><Folder size={16} className="text-brand-600" />Repository Files — {project.name}</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
        </div>
        <div className="flex flex-1 min-h-0">
          {/* tree */}
          <div className="w-72 shrink-0 border-r border-gray-100 overflow-auto py-2">
            {loading ? <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-gray-400" /></div>
              : error ? <p className="px-4 text-sm text-amber-700">{error}</p>
                : topKids.map(([n, c]) => <TreeNode key={c.__path} node={c} name={n} depth={0} onSelect={select} selected={selected} expanded={expanded} toggle={toggle} />)}
          </div>
          {/* viewer / editor */}
          <div className="flex-1 min-w-0 flex flex-col">
            {!selected ? <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Select a file to view or edit.</div>
              : (
                <>
                  <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 shrink-0">
                    <span className="font-mono text-xs text-navy-800 truncate">{selected}</span>
                    <div className="flex items-center gap-2">
                      {file?.html && <a href={file.html} target="_blank" rel="noreferrer" className="btn-ghost text-xs"><ExternalLink size={12} />GitHub</a>}
                      {file && !file.error && (editing
                        ? <button onClick={doSave} disabled={saving} className="btn-primary text-xs">{saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}Save</button>
                        : <button onClick={() => { setDraft(file.content); setEditing(true); }} className="btn-secondary text-xs"><Edit3 size={12} />Edit</button>)}
                    </div>
                  </div>
                  {saveMsg && <div className={`px-4 py-1.5 text-xs ${saveMsg.ok ? 'text-green-700 bg-green-50' : 'text-[#c0392b] bg-[#fde3e3]'}`}>{saveMsg.ok || saveMsg.err}</div>}
                  <div className="flex-1 min-h-0 overflow-auto">
                    {fileLoading ? <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-gray-400" /></div>
                      : file?.error ? <div className="p-4 text-sm text-gray-500">Can't preview this file ({file.error}).{file.html && <> <a href={file.html} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Open on GitHub →</a></>}</div>
                        : editing ? <textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="w-full h-full resize-none border-0 p-4 font-mono text-xs leading-5 text-navy-900 focus:outline-none" spellCheck={false} />
                          : <pre className="p-4 font-mono text-xs leading-5 text-navy-900 whitespace-pre">{file?.content}</pre>}
                  </div>
                </>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
