// @ts-nocheck
import{useEffect,useState,useCallback}from'react';
import{supabase}from'../lib/supabase';
import{PageHeader,Spinner,EmptyState,SeverityBadge,FindingStatusBadge}from'../lib/ui';
import{Link}from'../lib/router';
import{PinButton}from'../lib/pins';
import{Search,ShieldAlert,Wrench}from'lucide-react';

// A workspace-wide view of every finding across all projects — the "AI
// Remediation" surface. Reads the real `findings` table; no invented data.
export function FindingsPage(){
  const[loading,setLoading]=useState(true);
  const[findings,setFindings]=useState<any[]>([]);
  const[projects,setProjects]=useState<Record<string,string>>({});
  const[sev,setSev]=useState('all');
  const[status,setStatus]=useState('all');
  const[q,setQ]=useState('');
  const wsId=()=>localStorage.getItem('sandbox.activeWs');

  const load=useCallback(async()=>{
    setLoading(true);
    const wid=wsId();if(!wid){setLoading(false);return;}
    const[fRes,pRes]=await Promise.all([
      supabase.from('findings').select('*').eq('workspace_id',wid).order('created_at',{ascending:false}),
      supabase.from('projects').select('id,name').eq('workspace_id',wid),
    ]);
    setFindings(fRes.data??[]);
    setProjects(Object.fromEntries((pRes.data??[]).map((p:any)=>[p.id,p.name])));
    setLoading(false);
  },[]);
  useEffect(()=>{load();},[load]);

  if(loading)return<div className="flex justify-center py-24"><Spinner size={28}/></div>;

  const counts:Record<string,number>={critical:0,high:0,medium:0,low:0};
  findings.forEach((f:any)=>{if(counts[f.severity]!=null)counts[f.severity]++;});
  const open=findings.filter((f:any)=>f.status==='open');
  const filtered=findings.filter((f:any)=>
    (sev==='all'||f.severity===sev)&&
    (status==='all'||f.status===status)&&
    (!q||(f.title||'').toLowerCase().includes(q.toLowerCase())||(f.category||'').toLowerCase().includes(q.toLowerCase()))
  );

  return<div>
    <PageHeader title="Findings" description="Every issue LytHouse found across your repositories and environments."
      actions={<div className="flex items-center gap-1.5">
        {counts.critical>0&&<span className="chip bg-red-50 text-danger-600 border border-red-200">{counts.critical} Critical</span>}
        {counts.high>0&&<span className="chip bg-amber-50 text-amber-600 border border-amber-200">{counts.high} High</span>}
        {counts.medium>0&&<span className="chip bg-blue-50 text-blue-600 border border-blue-200">{counts.medium} Medium</span>}
        <span className="chip bg-gray-100 text-gray-600 border border-[#d4d4d8]">{open.length} open</span>
      </div>}
    />

    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 max-w-xs">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search findings…" className="input pl-9"/>
      </div>
      <select value={sev} onChange={e=>setSev(e.target.value)} className="input h-auto w-auto py-2 text-sm">
        <option value="all">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
      </select>
      <select value={status} onChange={e=>setStatus(e.target.value)} className="input h-auto w-auto py-2 text-sm">
        <option value="all">All status</option><option value="open">Open</option><option value="resolved">Resolved</option><option value="ignored">Ignored</option>
      </select>
    </div>

    {filtered.length===0?(
      <EmptyState icon={<ShieldAlert size={22}/>} title={findings.length===0?'No findings yet':'Nothing matches'} description={findings.length===0?'Run a validation on a project to surface security, dependency and configuration findings here.':'Try clearing the filters or search.'} action={findings.length===0?<Link to="/projects" className="btn-primary">Go to projects</Link>:undefined}/>
    ):(
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-[#d4d4d8]">
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">Severity</th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">Finding</th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">Category</th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">Location</th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">Status</th>
            <th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>
            {filtered.map((f:any)=>(
              <tr key={f.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                <td className="px-4 py-3"><SeverityBadge severity={f.severity}/></td>
                <td className="px-4 py-3"><p className="text-sm font-semibold text-navy-900">{f.title}</p></td>
                <td className="px-4 py-3 text-sm text-gray-600">{(f.category||'').replace(/_/g,' ')}</td>
                <td className="px-4 py-3"><span className="font-mono text-xs text-gray-400">{projects[f.project_id]||'—'}{f.file_path?` · ${f.file_path.split('/').pop()}`:''}</span></td>
                <td className="px-4 py-3"><FindingStatusBadge status={f.status}/></td>
                <td className="px-4 py-3"><div className="flex items-center justify-end gap-1"><PinButton item={{type:'finding',id:f.id,label:f.title,to:`/projects/${f.project_id}`}}/><Link to={`/projects/${f.project_id}`} className="btn-ghost text-xs"><Wrench size={13}/>{f.status==='open'?'Fix':'View'}</Link></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>;
}
