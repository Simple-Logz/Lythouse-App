import { useCallback, useEffect, useRef, useState } from 'react';
import { edgeFunctionUrl, anonKey, type Project, type RepoFile } from '../lib/supabase';
import { Spinner, EmptyState } from '../lib/ui';
import { Folder, File as FileIcon, ChevronRight, ChevronDown, FilePlus, FolderPlus, Trash2, Save, X, RefreshCw, TriangleAlert as AlertTriangle } from 'lucide-react';

type TreeNode = { name: string; path: string; type: 'file' | 'dir'; children: Map<string, TreeNode>; size?: number | null };

type Props = { projectId: string; project: Project; openFilePath: string | null; highlightLine: number | null; onHighlightConsumed: () => void };

const headers = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + anonKey, apikey: anonKey });
const call = async (body: Record<string, unknown>) => {
  const r = await fetch(edgeFunctionUrl + '/repo-operation', { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
  return r.json();
};

function buildTree(files: RepoFile[]): TreeNode {
  const root: TreeNode = { name: '', path: '', type: 'dir', children: new Map() };
  for (const f of files) {
    const parts = f.path.split('/');
    let cur = root;
    parts.forEach((part, i) => {
      const isLast = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join('/');
      let node = cur.children.get(part);
      if (!node) {
        node = { name: part, path, type: isLast ? f.type : 'dir', children: new Map(), size: isLast ? f.size : null };
        cur.children.set(part, node);
      } else if (isLast) {
        node.type = f.type;
        node.size = f.size;
      }
      cur = node;
    });
  }
  return root;
}

function parentDirs(path: string): string[] {
  const parts = path.split('/');
  const out: string[] = [];
  for (let i = 1; i < parts.length; i++) out.push(parts.slice(0, i).join('/'));
  return out;
}

export function FileExplorer({ projectId, openFilePath, highlightLine, onHighlightConsumed }: Props) {
  const [files, setFiles] = useState<RepoFile[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<null | 'file' | 'folder'>(null);
  const [deletePath, setDeletePath] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true); setError(null);
    try { setFiles((await call({ operation: 'list', projectId })).files ?? []); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const toggle = (p: string) => setExpanded(s => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n; });

  // Auto-select file + expand parents when openFilePath changes
  useEffect(() => {
    if (!openFilePath) return;
    setSelected(openFilePath);
    setExpanded(s => { const n = new Set(s); parentDirs(openFilePath).forEach(d => n.add(d)); return n; });
  }, [openFilePath]);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
      {/* File tree */}
      <div className="card lg:col-span-1 flex flex-col" style={{ minHeight: 400, maxHeight: '58vh' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Files</span>
          <div className="flex items-center gap-1">
            <button onClick={fetchFiles} title="Refresh" className="btn-ghost !px-2 !py-1.5"><RefreshCw size={15} /></button>
            <button onClick={() => setModal('file')} title="New File" className="btn-ghost !px-2 !py-1.5"><FilePlus size={15} /></button>
            <button onClick={() => setModal('folder')} title="New Folder" className="btn-ghost !px-2 !py-1.5"><FolderPlus size={15} /></button>
          </div>
        </div>
        {error && <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-danger-600"><AlertTriangle size={13} />{error}</div>}
        <div className="flex-1 overflow-auto -mx-1.5 px-1.5">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Spinner size={18} className="text-gray-400" /></div>
          ) : files.length === 0 ? (
            <EmptyState icon={<Folder size={22} />} title="No files" description="This repository is empty." />
          ) : (
            <TreeList node={buildTree(files)} depth={0} expanded={expanded} selected={selected}
              onToggle={toggle} onSelect={setSelected} onDelete={setDeletePath} />
          )}
        </div>
      </div>

      {/* Viewer / editor */}
      <div className="min-w-0">
        {selected ? (
          <FileViewer projectId={projectId} path={selected} highlightLine={highlightLine} onHighlightConsumed={onHighlightConsumed} onDelete={setDeletePath} onSaved={fetchFiles} />
        ) : (
          <div className="card flex h-full min-h-[400px] items-center justify-center">
            <EmptyState icon={<FileIcon size={22} />} title="Select a file" description="Choose a file from the tree to view or edit its contents." />
          </div>
        )}
      </div>

      {modal === 'file' && <NewFileModal projectId={projectId} onClose={() => setModal(null)} onDone={() => { setModal(null); fetchFiles(); }} />}
      {modal === 'folder' && <NewFolderModal projectId={projectId} onClose={() => setModal(null)} onDone={() => { setModal(null); fetchFiles(); }} />}
      {deletePath && <DeleteConfirmModal projectId={projectId} path={deletePath} onClose={() => setDeletePath(null)} onDone={() => { setDeletePath(null); fetchFiles(); }} />}
    </div>
  );
}

function TreeList({ node, depth, expanded, selected, onToggle, onSelect, onDelete }: {
  node: TreeNode; depth: number; expanded: Set<string>; selected: string | null;
  onToggle: (p: string) => void; onSelect: (p: string) => void; onDelete: (p: string) => void;
}) {
  const entries = [...node.children.values()].sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1);
  return (
    <ul className="space-y-1">
      {entries.map(n => {
        const isOpen = expanded.has(n.path);
        const isSel = selected === n.path;
        const pad = { paddingLeft: depth * 16 + 8 };
        return (
          <li key={n.path}>
            <div className={`group flex items-center gap-1.5 rounded-lg py-1.5 pr-1.5 text-sm transition-colors ${isSel ? 'bg-brand-50 text-brand-700 font-medium' : 'hover:bg-gray-50 text-navy-700'}`} style={pad}>
              {n.type === 'dir' ? (
                <button onClick={() => onToggle(n.path)} className="flex flex-1 items-center gap-1.5 min-w-0">
                  {isOpen ? <ChevronDown size={14} className="shrink-0 text-gray-400" /> : <ChevronRight size={14} className="shrink-0 text-gray-400" />}
                  <Folder size={14} className="shrink-0 text-amber-500" />
                  <span className="truncate">{n.name}</span>
                </button>
              ) : (
                <button onClick={() => onSelect(n.path)} className="flex flex-1 items-center gap-1.5 min-w-0 pl-[18px]">
                  <FileIcon size={14} className="shrink-0 text-gray-400" />
                  <span className="truncate">{n.name}</span>
                </button>
              )}
              <button onClick={() => onDelete(n.path)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-danger-500 transition-all p-1" title="Delete">
                <Trash2 size={13} />
              </button>
            </div>
            {n.type === 'dir' && isOpen && <TreeList node={n} depth={depth + 1} expanded={expanded} selected={selected} onToggle={onToggle} onSelect={onSelect} onDelete={onDelete} />}
          </li>
        );
      })}
    </ul>
  );
}

function FileViewer({ projectId, path, highlightLine, onHighlightConsumed, onDelete, onSaved }: {
  projectId: string; path: string; highlightLine: number | null; onHighlightConsumed: () => void; onDelete: (p: string) => void; onSaved: () => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [binary, setBinary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await call({ operation: 'read', projectId, path });
      if (res.binary) { setBinary(true); setContent(null); }
      else { setBinary(false); setContent(res.content ?? ''); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to read'); }
    finally { setLoading(false); }
  }, [projectId, path]);

  useEffect(() => { load(); setEditing(false); }, [load]);

  useEffect(() => {
    if (highlightLine == null || content == null) return;
    const t = setTimeout(() => {
      const el = lineRefs.current[highlightLine - 1];
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      onHighlightConsumed();
    }, 80);
    return () => clearTimeout(t);
  }, [highlightLine, content, onHighlightConsumed]);

  const save = async () => {
    setSaving(true);
    try { await call({ operation: 'write', projectId, path, content: draft, message: 'Update ' + path }); setContent(draft); setEditing(false); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  const lines = content == null ? [] : content.split('\n');
  const Gutter = () => (
    <div className="select-none py-3 pr-3 pl-3 text-right text-xs leading-6 text-gray-400 font-mono shrink-0 border-r border-gray-100 bg-gray-50/50">
      {lines.map((_, i) => <div key={i} ref={el => { lineRefs.current[i] = el; }} className={highlightLine === i + 1 ? 'bg-amber-100 -mx-3 px-3 rounded' : ''}>{i + 1}</div>)}
    </div>
  );

  return (
    <div className="card flex flex-col" style={{ maxHeight: '70vh' }}>
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileIcon size={15} className="shrink-0 text-gray-400" />
          <span className="truncate text-sm font-medium text-navy-900" title={path}>{path}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!binary && content != null && !editing && <button onClick={() => { setDraft(content); setEditing(true); }} className="btn-secondary !py-1.5 !px-3 text-xs">Edit</button>}
          {editing && <button onClick={save} disabled={saving} className="btn-primary !py-1.5 !px-3 text-xs">{saving ? <Spinner size={12} /> : <Save size={13} />}Save</button>}
          {editing && <button onClick={() => setEditing(false)} className="btn-secondary !py-1.5 !px-3 text-xs"><X size={13} />Cancel</button>}
          <button onClick={() => onDelete(path)} className="btn-ghost !py-1.5 !px-2 text-danger-600 hover:bg-red-50" title="Delete"><Trash2 size={14} /></button>
        </div>
      </div>

      {error && <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-danger-600"><AlertTriangle size={13} />{error}</div>}

      <div className="flex-1 overflow-auto rounded-xl border border-[#a1a1aa] bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner size={18} className="text-gray-400" /></div>
        ) : binary ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileIcon size={26} className="mb-2 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">Binary file</p>
            <p className="text-xs text-gray-400">This file cannot be displayed.</p>
          </div>
        ) : editing ? (
          <div className="flex">
            <div className="select-none py-3 pr-3 pl-3 text-right text-xs leading-6 text-gray-400 font-mono shrink-0 border-r border-gray-100 bg-gray-50/50">
              {draft.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
            </div>
            <textarea value={draft} onChange={e => setDraft(e.target.value)} spellCheck={false}
              className="flex-1 resize-none bg-white px-3 py-3 font-mono text-xs leading-6 text-navy-900 focus:outline-none" style={{ minHeight: '50vh' }} />
          </div>
        ) : (
          <div className="flex">
            <Gutter />
            <pre className="flex-1 overflow-visible px-3 py-3 font-mono text-xs leading-6 text-navy-900 whitespace-pre"><code>{content}</code></pre>
          </div>
        )}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md card animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-navy-900">{title}</h3>
          <button onClick={onClose} className="btn-ghost !p-1.5"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function NewFileModal({ projectId, onClose, onDone }: { projectId: string; onClose: () => void; onDone: () => void }) {
  const [path, setPath] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    if (!path.trim()) return;
    setBusy(true); setErr(null);
    try { await call({ operation: 'write', projectId, path: path.trim(), content, message: 'Create ' + path.trim() }); onDone(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  };
  return (
    <Modal title="New File" onClose={onClose}>
      {err && <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-danger-600"><AlertTriangle size={13} />{err}</div>}
      <label className="label">Path</label>
      <input className="input mb-3" value={path} onChange={e => setPath(e.target.value)} placeholder="src/new-file.ts" autoFocus />
      <label className="label">Content</label>
      <textarea className="input mb-4 font-mono text-xs" rows={6} value={content} onChange={e => setContent(e.target.value)} placeholder="File contents..." />
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={submit} disabled={busy || !path.trim()} className="btn-primary">{busy ? <Spinner size={14} /> : <FilePlus size={14} />}Create</button>
      </div>
    </Modal>
  );
}

function NewFolderModal({ projectId, onClose, onDone }: { projectId: string; onClose: () => void; onDone: () => void }) {
  const [path, setPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    if (!path.trim()) return;
    setBusy(true); setErr(null);
    try { await call({ operation: 'mkdir', projectId, path: path.trim() }); onDone(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  };
  return (
    <Modal title="New Folder" onClose={onClose}>
      {err && <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-danger-600"><AlertTriangle size={13} />{err}</div>}
      <label className="label">Folder path</label>
      <input className="input mb-4" value={path} onChange={e => setPath(e.target.value)} placeholder="src/new-folder" autoFocus />
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={submit} disabled={busy || !path.trim()} className="btn-primary">{busy ? <Spinner size={14} /> : <FolderPlus size={14} />}Create</button>
      </div>
    </Modal>
  );
}

function DeleteConfirmModal({ projectId, path, onClose, onDone }: { projectId: string; path: string; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true); setErr(null);
    try { await call({ operation: 'delete', projectId, path }); onDone(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  };
  return (
    <Modal title="Delete" onClose={onClose}>
      {err && <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-danger-600"><AlertTriangle size={13} />{err}</div>}
      <div className="mb-5 flex items-start gap-3 rounded-xl bg-red-50 p-4">
        <AlertTriangle size={20} className="mt-0.5 shrink-0 text-danger-500" />
        <div>
          <p className="text-sm font-medium text-navy-900">Delete <span className="font-mono text-danger-600">{path}</span>?</p>
          <p className="mt-1 text-xs text-gray-500">This action cannot be undone.</p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={submit} disabled={busy} className="btn-primary !bg-danger-600 hover:!bg-danger-700">{busy ? <Spinner size={14} /> : <Trash2 size={14} />}Delete</button>
      </div>
    </Modal>
  );
}
