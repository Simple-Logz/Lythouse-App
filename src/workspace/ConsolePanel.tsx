import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, edgeFunctionUrl, type Project, type RepoFile } from '../lib/supabase';
import { Spinner } from '../lib/ui';
import { Terminal as TerminalIcon, ChevronRight } from 'lucide-react';

type Line = { type: 'input' | 'output' | 'error' | 'info'; text: string };

const SKIP_DIRS = ["node_modules", ".git", "dist", "build", ".next", "__pycache__", ".cache", "vendor", ".venv", "venv", "coverage"];

export function ConsolePanel({ projectId, project }: { projectId: string; project: Project }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [files, setFiles] = useState<RepoFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const res = await fetch(`${edgeFunctionUrl}/repo-operation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
        body: JSON.stringify({ operation: 'list', projectId }),
      });
      const data = await res.json();
      if (data.files) setFiles(data.files as RepoFile[]);
    } catch (e) { console.error('Console load error:', e); }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    setLines([{ type: 'info', text: `Sandbox.ai Console — connected to ${project.git_url} (branch: ${project.git_branch})` }, { type: 'info', text: 'Type "help" to see available commands.' }]);
    loadFiles();
  }, [projectId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [lines]);

  function getFilesInDir(dir: string): RepoFile[] {
    if (dir === '/' || dir === '') return files.filter(f => !f.path.includes('/'));
    const prefix = dir.endsWith('/') ? dir : dir + '/';
    return files.filter(f => f.path.startsWith(prefix) && !f.path.slice(prefix.length).includes('/'));
  }

  function getFilePath(name: string, cwd: string): string {
    if (name.startsWith('/')) return name.slice(1);
    if (cwd === '/' || cwd === '') return name;
    return `${cwd.replace(/^\//, '')}/${name}`;
  }

  async function readFile(path: string): Promise<string | null> {
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const res = await fetch(`${edgeFunctionUrl}/repo-operation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
        body: JSON.stringify({ operation: 'read', projectId, path }),
      });
      const data = await res.json();
      return data.content ?? null;
    } catch { return null; }
  }

  async function execute(cmd: string) {
    const parts = cmd.trim().split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    if (!command) return;

    switch (command) {
      case 'help':
        addOutput('Available commands:');
        addOutput('  ls [path]          List files in directory');
        addOutput('  cat <file>         Display file contents');
        addOutput('  find <pattern>     Find files matching pattern');
        addOutput('  grep <pattern>     Search file contents for pattern');
        addOutput('  tree               Show full file tree');
        addOutput('  wc <file>          Count lines in file');
        addOutput('  head <file> [n]    Show first n lines (default 10)');
        addOutput('  tail <file> [n]    Show last n lines (default 10)');
        addOutput('  clear              Clear console');
        addOutput('  help               Show this help');
        break;

      case 'ls': {
        const dir = args[0] ?? '/';
        const dirFiles = getFilesInDir(dir);
        if (dirFiles.length === 0) { addOutput(`(empty)`, 'info'); break; }
        const dirs = dirFiles.filter(f => f.type === 'dir').map(f => f.path.split('/').pop() + '/');
        const fileNames = dirFiles.filter(f => f.type === 'file').map(f => f.path.split('/').pop());
        [...dirs, ...fileNames].forEach(name => addOutput(name));
        break;
      }

      case 'cat': {
        if (!args[0]) { addOutput('Usage: cat <file>', 'error'); break; }
        setBusy(true);
        const content = await readFile(args[0]);
        setBusy(false);
        if (content === null) { addOutput(`File not found: ${args[0]}`, 'error'); break; }
        content.split('\n').forEach((line, i) => addOutput(`${String(i + 1).padStart(4)}  ${line}`));
        break;
      }

      case 'find': {
        if (!args[0]) { addOutput('Usage: find <pattern>', 'error'); break; }
        const pattern = args[0].toLowerCase();
        const matches = files.filter(f => f.path.toLowerCase().includes(pattern));
        if (matches.length === 0) { addOutput('No files found.', 'info'); break; }
        matches.forEach(f => addOutput(`${f.type === 'dir' ? 'd' : 'f'}  ${f.path}`));
        break;
      }

      case 'grep': {
        if (!args[0]) { addOutput('Usage: grep <pattern>', 'error'); break; }
        const pattern = args[0];
        const regex = new RegExp(pattern, 'i');
        setBusy(true);
        const scanFiles = files.filter(f => f.type === 'file' && !SKIP_DIRS.some(d => f.path.includes(d + '/')));
        let found = 0;
        for (const file of scanFiles.slice(0, 50)) {
          const content = await readFile(file.path);
          if (!content) continue;
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              addOutput(`${file.path}:${i + 1}: ${lines[i].trim().substring(0, 200)}`);
              found++;
              if (found >= 30) { addOutput('... (truncated, 30+ matches)', 'info'); break; }
            }
          }
          if (found >= 30) break;
        }
        setBusy(false);
        if (found === 0) addOutput('No matches found.', 'info');
        break;
      }

      case 'tree': {
        if (files.length === 0) { addOutput('No files loaded.', 'info'); break; }
        const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
        sorted.forEach(f => addOutput(`${f.type === 'dir' ? '📁' : '📄'} ${f.path}`));
        break;
      }

      case 'wc': {
        if (!args[0]) { addOutput('Usage: wc <file>', 'error'); break; }
        setBusy(true);
        const content = await readFile(args[0]);
        setBusy(false);
        if (content === null) { addOutput(`File not found: ${args[0]}`, 'error'); break; }
        const lineCount = content.split('\n').length;
        const wordCount = content.split(/\s+/).filter(Boolean).length;
        const charCount = content.length;
        addOutput(`  ${lineCount} lines  ${wordCount} words  ${charCount} chars  ${args[0]}`);
        break;
      }

      case 'head': {
        if (!args[0]) { addOutput('Usage: head <file> [n]', 'error'); break; }
        const n = parseInt(args[1] ?? '10');
        setBusy(true);
        const content = await readFile(args[0]);
        setBusy(false);
        if (content === null) { addOutput(`File not found: ${args[0]}`, 'error'); break; }
        content.split('\n').slice(0, n).forEach((line, i) => addOutput(`${String(i + 1).padStart(4)}  ${line}`));
        break;
      }

      case 'tail': {
        if (!args[0]) { addOutput('Usage: tail <file> [n]', 'error'); break; }
        const n = parseInt(args[1] ?? '10');
        setBusy(true);
        const content = await readFile(args[0]);
        setBusy(false);
        if (content === null) { addOutput(`File not found: ${args[0]}`, 'error'); break; }
        const allLines = content.split('\n');
        const start = Math.max(0, allLines.length - n);
        allLines.slice(start).forEach((line, i) => addOutput(`${String(start + i + 1).padStart(4)}  ${line}`));
        break;
      }

      case 'clear':
        setLines([]);
        break;

      default:
        addOutput(`Command not found: ${command}. Type "help" for available commands.`, 'error');
    }
  }

  function addOutput(text: string, type: 'output' | 'error' | 'info' = 'output') {
    setLines(prev => [...prev, { type, text }]);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    setLines(prev => [...prev, { type: 'input', text: input }]);
    setHistory(prev => [...prev, input]);
    setHistoryIdx(-1);
    const cmd = input;
    setInput('');
    execute(cmd);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const idx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(idx);
      setInput(history[idx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx === -1) return;
      const idx = historyIdx + 1;
      if (idx >= history.length) { setHistoryIdx(-1); setInput(''); }
      else { setHistoryIdx(idx); setInput(history[idx]); }
    }
  }

  if (loading) return <div className="flex items-center justify-center py-12 text-gray-400"><Spinner size={20} /></div>;

  return (
    <div className="card p-0 overflow-hidden" style={{ height: 500 }} onClick={() => inputRef.current?.focus()}>
      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
        <TerminalIcon size={15} className="text-gray-500" />
        <span className="text-sm font-medium text-navy-700">Console</span>
        <span className="ml-auto text-xs text-gray-400">{files.length} files indexed</span>
      </div>
      <div className="flex flex-col p-4 font-mono text-xs" style={{ height: 'calc(500px - 45px)', overflowY: 'auto' }}>
        {lines.map((line, i) => (
          <div key={i} className={`whitespace-pre-wrap break-all ${line.type === 'input' ? 'text-brand-700' : line.type === 'error' ? 'text-danger-600' : line.type === 'info' ? 'text-gray-400' : 'text-navy-700'}`}>
            {line.type === 'input' ? <span className="text-gray-400">$ </span> : null}
            {line.text}
          </div>
        ))}
        {busy && <div className="text-gray-400">...</div>}
        <div ref={endRef} />
      </div>
      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-gray-100 px-4 py-2.5">
        <ChevronRight size={14} className="text-gray-400" />
        <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown} className="flex-1 border-0 bg-transparent font-mono text-xs text-navy-900 focus:outline-none" placeholder="Type a command... (try 'help')" autoFocus disabled={busy} />
      </form>
    </div>
  );
}
