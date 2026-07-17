import { useCallback, useEffect, useState } from 'react';
import { edgeFunctionUrl, anonKey, type Project, type RepoFile } from '../lib/supabase';
import { Spinner, EmptyState } from '../lib/ui';
import { Network, FileCode, Database, Cloud, Server, Box, Globe, Layers, Shield, Zap, ChevronRight, TriangleAlert as AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = { projectId: string; project: Project; onOpenFile: (path: string) => void };

type TopoNode = {
  id: string;
  label: string;
  detail: string;
  icon: ReactNode;
  x: number;
  y: number;
  w?: number;
  match: (p: string) => boolean;
};

const headers = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + anonKey, apikey: anonKey });

const NODE_W = 150;
const NODE_H = 56;

// Vertical-flow node positions across an 850x580 canvas.
const NODES: TopoNode[] = [
  { id: 'client', label: 'Client / Browser', detail: 'Frontend entry point — pages, components, and the SPA shell served to end users.', icon: <Globe size={18} />, x: 350, y: 20, match: (p) => /(^|\/)src\/App\.(t|j)sx?$/.test(p) || /(^|\/)(pages|components|app)\//.test(p) },
  { id: 'lb', label: 'Load Balancer / Ingress', detail: 'Traffic routing and TLS termination — nginx, traefik, or Kubernetes ingress controllers.', icon: <Network size={18} />, x: 350, y: 110, match: (p) => /nginx|traefik|ingress/i.test(p) && /\.(conf|yaml|yml|toml)$/.test(p) },
  { id: 'server', label: 'App Server', detail: 'Containerized runtime — Dockerfile and process configuration for the main service.', icon: <Server size={18} />, x: 350, y: 200, match: (p) => /(^|\/)Dockerfile/.test(p) || /(^|\/)docker-compose\.(yml|yaml)$/.test(p) },
  { id: 'api', label: 'API / Routes', detail: 'Backend handlers — controllers, route definitions, and request/response logic.', icon: <FileCode size={18} />, x: 200, y: 300, match: (p) => /(^|\/)(api|routes|controllers?)\//.test(p) || /(^|\/)server\.(t|j)s$/.test(p) },
  { id: 'frontend', label: 'Frontend Build', detail: 'Client bundle and dependency manifest — package.json and frontend build configuration.', icon: <Layers size={18} />, x: 500, y: 300, match: (p) => /(^|\/)package\.json$/.test(p) || /(^|\/)(vite|webpack|next\.config)\./.test(p) },
  { id: 'db', label: 'Database', detail: 'Persistence layer — schema, migrations, Prisma models, and ORM definitions.', icon: <Database size={18} />, x: 110, y: 400, match: (p) => /(^|\/)(prisma|migrations?|models?|schema)\//.test(p) || /(^|\/)schema\.(sql|prisma)$/.test(p) },
  { id: 'cache', label: 'Cache / Redis', detail: 'In-memory store and session cache — redis configuration and cache layer wiring.', icon: <Box size={18} />, x: 350, y: 400, match: (p) => /redis|cache/i.test(p) && /\.(t|j)s$/.test(p) },
  { id: 'auth', label: 'Auth / Session', detail: 'Identity and access — login flows, session management, and auth middleware.', icon: <Shield size={18} />, x: 590, y: 400, match: (p) => /(^|\/)(auth|login|session)s?\/?/.test(p) && /\.(t|j)s$/.test(p) },
  { id: 'cicd', label: 'CI / CD Pipelines', detail: 'Automated build, test, and deploy workflows — GitHub Actions and GitLab CI definitions.', icon: <Zap size={18} />, x: 200, y: 500, match: (p) => /(^|\/)\.github\/workflows\//.test(p) || /(^|\/)\.gitlab-ci\.yml$/.test(p) },
  { id: 'deploy', label: 'Deployment Config', detail: 'Infrastructure as code — Kubernetes manifests and Terraform provisioning.', icon: <Cloud size={18} />, x: 500, y: 500, match: (p) => /(^|\/)(deploy|k8s)\//.test(p) && /\.(yaml|yml)$/.test(p) || /(^|\/).+\.tf$/.test(p) },
];

// Directed edges (parent -> child) rendered as dashed connectors.
const EDGES: [string, string][] = [
  ['client', 'lb'], ['lb', 'server'],
  ['server', 'api'], ['server', 'frontend'],
  ['api', 'db'], ['api', 'cache'], ['api', 'auth'],
  ['server', 'cicd'], ['server', 'deploy'],
];

// Language / framework hints surfaced from manifest files.
function detectStack(files: RepoFile[]): string[] {
  const stack: string[] = [];
  const has = (re: RegExp) => files.some((f) => re.test(f.path));
  if (has(/(^|\/)package\.json$/)) stack.push('Node.js');
  if (has(/(^|\/)go\.mod$/)) stack.push('Go');
  if (has(/(^|\/)requirements\.txt$/)) stack.push('Python');
  if (has(/(^|\/)Cargo\.toml$/)) stack.push('Rust');
  if (has(/(^|\/)Dockerfile/)) stack.push('Docker');
  if (has(/\.tf$/)) stack.push('Terraform');
  return stack;
}

export function TopologyView({ projectId, project, onOpenFile }: Props) {
  const [files, setFiles] = useState<RepoFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(edgeFunctionUrl + '/repo-operation', {
        method: 'POST', headers: headers(), body: JSON.stringify({ operation: 'list', projectId }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
      setFiles((await r.json()).files ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { void fetchFiles(); }, [fetchFiles]);

  const relatedFiles = (n: TopoNode): RepoFile[] => files.filter((f) => f.type === 'file' && n.match(f.path));
  const sel = NODES.find((n) => n.id === selected) ?? null;
  const stack = detectStack(files);

  if (loading) return <div className="flex items-center justify-center py-20"><Spinner size={24} /></div>;
  if (error) return <EmptyState icon={<AlertTriangle size={28} />} title="Unable to load topology" description={error} action={<button className="btn-ghost" onClick={fetchFiles}>Retry</button>} />;
  if (!files.length) return <EmptyState icon={<Network size={28} />} title="No files to analyze" description="Once this repository has files, an inferred topology diagram will appear here." />;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-navy-900">Inferred Topology</h3>
            <p className="text-xs text-gray-500">Auto-generated from the repository file structure of <span className="font-medium text-gray-700">{project.name}</span>.</p>
          </div>
          {stack.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {stack.map((s) => <span key={s} className="chip bg-gray-100 text-gray-600 border border-gray-200">{s}</span>)}
            </div>
          )}
        </div>
        <svg width="850" height="580" className="w-full" style={{ maxHeight: 580 }}>
          {EDGES.map(([a, b]) => {
            const pa = NODES.find((n) => n.id === a)!; const pb = NODES.find((n) => n.id === b)!;
            const x1 = pa.x + NODE_W / 2, y1 = pa.y + NODE_H;
            const x2 = pb.x + NODE_W / 2, y2 = pb.y;
            return <line key={a + '-' + b} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="5 4" />;
          })}
          {NODES.map((n) => {
            const active = n.id === selected;
            const count = relatedFiles(n).length;
            return (
              <foreignObject key={n.id} x={n.x} y={n.y} width={NODE_W} height={NODE_H}>
                <button
                  onClick={() => setSelected(active ? null : n.id)}
                  className={`flex h-full w-full items-center gap-2 rounded-xl border px-3 text-left transition ${active ? 'border-brand-500 bg-brand-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'}`}>{n.icon}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-navy-900">{n.label}</span>
                    <span className="block text-[10px] text-gray-500">{count} file{count === 1 ? '' : 's'}</span>
                  </span>
                </button>
              </foreignObject>
            );
          })}
        </svg>
      </div>

      <div className="card p-4">
        {sel ? (
          <>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-700">{sel.icon}</span>
              <h3 className="text-sm font-semibold text-navy-900">{sel.label}</h3>
            </div>
            <p className="mb-3 text-xs leading-relaxed text-gray-600">{sel.detail}</p>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Related files</div>
            <ul className="space-y-1">
              {relatedFiles(sel).slice(0, 30).map((f) => (
                <li key={f.path}>
                  <button onClick={() => onOpenFile(f.path)} className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left rounded-lg hover:bg-brand-50 hover:text-brand-700 transition-colors group">
                    <ChevronRight size={12} className="shrink-0 text-gray-400" />
                    <span className="truncate font-mono text-[11px] text-gray-700">{f.path}</span>
                  </button>
                </li>
              ))}
              {relatedFiles(sel).length === 0 && <li className="px-2 py-1.5 text-xs text-gray-400">No matching files detected.</li>}
            </ul>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 border border-gray-200 text-gray-400"><Network size={22} /></div>
            <h3 className="text-sm font-semibold text-navy-900">Select a node</h3>
            <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-gray-500">Click any node in the diagram to inspect its role and the repository files that back it.</p>
          </div>
        )}
      </div>
    </div>
  );
}
