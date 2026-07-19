// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { X, Folder, File as FileIcon, ChevronRight, ChevronDown, Loader as Loader2, Save, Code2, ExternalLink, Eye } from 'lucide-react';
import { getTree, ERROR_TEXT } from './repoCache';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { yaml } from '@codemirror/lang-yaml';
import { json } from '@codemirror/lang-json';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { markdown } from '@codemirror/lang-markdown';

const GH = ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 24 24"><path fill="#000" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>;

function parseGitUrl(url) { const m = (url || '').match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?(?:$|\/)/); return m ? { owner: m[1], repo: m[2] } : null; }
function langFor(path) {
  const e = (path.split('.').pop() || '').toLowerCase();
  if (['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(e)) return [javascript({ jsx: true, typescript: /tsx?$/.test(e) })];
  if (e === 'py') return [python()];
  if (['yml', 'yaml'].includes(e)) return [yaml()];
  if (e === 'json') return [json()];
  if (['html', 'htm', 'vue', 'svelte', 'xml'].includes(e)) return [html()];
  if (['css', 'scss', 'less'].includes(e)) return [css()];
  if (['md', 'mdx', 'markdown'].includes(e)) return [markdown()];
  return [];
}
function isBinary(s) { const n = Math.min(s.length, 4000); let ctrl = 0; for (let i = 0; i < n; i++) { const c = s.charCodeAt(i); if (c === 0) return true; if (c < 9 || (c > 13 && c < 32)) ctrl++; } return n > 0 && ctrl / n > 0.15; }

// Read via the Blobs API (handles files up to 100MB, unlike the 1MB Contents API).
async function readBlob(project, path, sha) {
  const p = parseGitUrl(project.git_url); if (!p || !sha) return { error: 'no sha' };
  const branch = project.git_branch || 'main';
  const headers = { Accept: 'application/vnd.github+json' };
  if (project.github_token) headers.Authorization = 'Bearer ' + project.github_token;
  const html = `https://github.com/${p.owner}/${p.repo}/blob/${branch}/${path}`;
  try {
    const r = await fetch(`https://api.github.com/repos/${p.owner}/${p.repo}/git/blobs/${sha}`, { headers });
    if (!r.ok) return { error: `HTTP ${r.status}`, html };
    const d = await r.json();
    if (d.encoding !== 'base64') return { error: 'unsupported encoding', html };
    const raw = atob((d.content || '').replace(/\n/g, ''));
    if (isBinary(raw)) return { error: 'binary', html, sha };
    return { sha, content: decodeURIComponent(escape(raw)), html };
  } catch (e) { return { error: e.message, html }; }
}
async function saveFile(project, path, content, sha) {
  const p = parseGitUrl(project.git_url); if (!p) throw new Error('No GitHub repo.');
  if (!project.github_token) throw new Error('Saving needs a GitHub token with write access. Otherwise use "Open on GitHub" to edit there.');
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
  for (const path of paths) { const parts = path.split('/'); let cur = root; parts.forEach((part, i) => { const isFile = i === parts.length - 1; cur[part] = cur[part] || { __file: isFile, __path: parts.slice(0, i + 1).join('/'), children: {} }; cur = cur[part].children; }); }
  return root;
}
function Node({ node, name, depth, onSelect, selected, expanded, toggle }) {
  const isFile = node.__file; const open = expanded.has(node.__path);
  const kids = Object.entries(node.children).sort((a, b) => { const af = a[1].__file, bf = b[1].__file; return af === bf ? a[0].localeCompare(b[0]) : af ? 1 : -1; });
  return (
    <div>
      <button onClick={() => (isFile ? onSelect(node.__path) : toggle(node.__path))} className={`flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-sm hover:bg-gray-50 ${selected === node.__path ? 'bg-brand-50 text-brand-700' : 'text-navy-700'}`} style={{ paddingLeft: depth * 14 + 8 }}>
        {isFile ? <FileIcon size={14} className="shrink-0 text-gray-400" /> : (open ? <ChevronDown size={14} className="shrink-0 text-gray-400" /> : <ChevronRight size={14} className="shrink-0 text-gray-400" />)}
        {!isFile && <Folder size={14} className="shrink-0 text-brand-400" />}
        <span className="truncate">{name}</span>
      </button>
      {!isFile && open && kids.map(([n, c]) => <Node key={c.__path} node={c} name={n} depth={depth + 1} onSelect={onSelect} selected={selected} expanded={expanded} toggle={toggle} />)}
    </div>
  );
}

export function FileBrowser({ project, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paths, setPaths] = useState([]);
  const [blobs, setBlobs] = useState({});
  const [expanded, setExpanded] = useState(new Set());
  const [selected, setSelected] = useState(null);
  const [file, setFile] = useState(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  useEffect(() => { (async () => { const t = await getTree(project); if (t.error) { setError(ERROR_TEXT[t.error]); setLoading(false); return; } setPaths(t.paths); setBlobs(t.blobs || {}); setLoading(false); })(); }, [project.git_url]);

  const tree = useMemo(() => buildTree(paths), [paths]);
  const toggle = (p) => setExpanded((s) => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n; });
  const select = async (p) => {
    setSelected(p); setEditing(false); setSaveMsg(null); setFileLoading(true); setFile(null);
    const r = await readBlob(project, p, blobs[p]); setFileLoading(false);
    setFile(r); if (!r.error) setDraft(r.content);
  };
  const doSave = async () => {
    setSaving(true); setSaveMsg(null);
    try { const newSha = await saveFile(project, selected, draft, file.sha); setFile({ ...file, sha: newSha, content: draft }); setEditing(false); setSaveMsg({ ok: 'Saved & committed to ' + (project.git_branch || 'main') + '.' }); }
    catch (e) { setSaveMsg({ err: e.message }); } finally { setSaving(false); }
  };
  const topKids = Object.entries(tree).sort((a, b) => { const af = a[1].__file, bf = b[1].__file; return af === bf ? a[0].localeCompare(b[0]) : af ? 1 : -1; });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full max-w-none sm:max-w-5xl h-full sm:h-[85vh] animate-scale-in rounded-none sm:rounded-xl bg-white shadow-xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold flex items-center gap-2 min-w-0"><Folder size={16} className="text-brand-600 shrink-0" /><span className="truncate">Files — {project.name}</span></h2>
          <div className="flex items-center gap-2 shrink-0">
            {selected && file && !file.error && (
              editing
                ? <><button onClick={() => setEditing(false)} className="btn-ghost text-xs"><Eye size={13} />Preview</button><button onClick={doSave} disabled={saving} className="btn-primary text-xs">{saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}Save</button></>
                : <button onClick={() => { setDraft(file.content); setEditing(true); }} className="btn-primary text-xs"><Code2 size={13} />Open in Editor</button>
            )}
            <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
          </div>
        </div>
        <div className="flex flex-1 min-h-0">
          {/* file tree — hidden on mobile once a file is open */}
          <div className={`${selected ? 'hidden' : 'block'} sm:block w-full sm:w-72 shrink-0 border-r border-gray-100 overflow-auto py-2`}>
            {loading ? <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-gray-400" /></div>
              : error ? <p className="px-4 text-sm text-amber-700">{error}</p>
                : topKids.map(([n, c]) => <Node key={c.__path} node={c} name={n} depth={0} onSelect={select} selected={selected} expanded={expanded} toggle={toggle} />)}
          </div>
          <div className={`${selected ? 'flex' : 'hidden'} sm:flex flex-1 min-w-0 flex-col`}>
            {!selected ? <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Select a file to view. Use “Open in Editor” to make changes.</div>
              : (
                <>
                  <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <button onClick={() => { setSelected(null); setEditing(false); }} className="sm:hidden shrink-0 text-brand-600 -ml-1 p-1"><ChevronRight size={16} className="rotate-180" /></button>
                      <span className="font-mono text-xs text-navy-800 truncate">{selected}{editing && <span className="ml-2 text-[10px] text-brand-600 font-sans font-semibold uppercase">editing</span>}</span>
                    </div>
                    {file?.html && <a href={file.html} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-semibold text-black hover:bg-gray-50"><GH s={14} /><ExternalLink size={12} />Open on GitHub</a>}
                  </div>
                  {editing && !file?.error && (
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-[#fff7e9] border-b border-[#f9c777] text-[11px] text-[#8a5a00]">
                      <Code2 size={12} /><span className="font-semibold">Editor open</span><span className="text-[#b06a00]">— edits are committed to the <span className="font-mono">{project.git_branch || 'main'}</span> branch when you press Save.</span>
                    </div>
                  )}
                  {saveMsg && <div className={`px-4 py-1.5 text-xs ${saveMsg.ok ? 'text-green-700 bg-green-50' : 'text-[#c0392b] bg-[#fde3e3]'}`}>{saveMsg.ok || saveMsg.err}</div>}
                  <div className="flex-1 min-h-0 overflow-hidden">
                    {fileLoading ? <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-gray-400" /></div>
                      : file?.error === 'binary' ? <div className="p-6 text-center text-sm text-gray-500"><FileIcon size={28} className="mx-auto text-gray-300 mb-2" />This is a binary file (image, archive, etc.) and can't be shown as text.{file.html && <div className="mt-2"><a href={file.html} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-black font-semibold hover:underline"><GH s={13} />Open on GitHub</a></div>}</div>
                        : file?.error ? <div className="p-4 text-sm text-gray-500">Couldn't load this file ({file.error}).</div>
                          : editing
                            ? <div className="h-full overflow-auto ring-2 ring-inset ring-brand-400"><CodeMirror value={draft} theme={oneDark} editable autoFocus extensions={langFor(selected)} onChange={(v) => setDraft(v)} basicSetup={{ lineNumbers: true, highlightActiveLine: true, foldGutter: true, highlightActiveLineGutter: true }} style={{ fontSize: 12.5 }} /></div>
                            : <pre className="h-full overflow-auto bg-[#0f1117] text-gray-200 p-4 text-xs font-mono leading-relaxed whitespace-pre">{file?.content || ''}</pre>}
                  </div>
                </>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
