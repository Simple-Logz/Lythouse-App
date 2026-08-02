// @ts-nocheck
import{useEffect,useState,useCallback}from'react';
import{supabase}from'../lib/supabase';
import{PageHeader,Spinner,EmptyState,timeAgo}from'../lib/ui';
import{Link}from'../lib/router';
import{CheckCircle2,XCircle,Clock,ShieldCheck}from'lucide-react';

// Governance surface — the workspace-wide release approval queue. Reads the
// real `release_approvals` table.
export function ApprovalsPage(){
  const[loading,setLoading]=useState(true);
  const[rows,setRows]=useState<any[]>([]);
  const[projects,setProjects]=useState<Record<string,string>>({});
  const wsId=()=>localStorage.getItem('sandbox.activeWs');

  const load=useCallback(async()=>{
    setLoading(true);
    const wid=wsId();if(!wid){setLoading(false);return;}
    const[aRes,pRes]=await Promise.all([
      supabase.from('release_approvals').select('*').eq('workspace_id',wid).order('created_at',{ascending:false}).limit(50),
      supabase.from('projects').select('id,name').eq('workspace_id',wid),
    ]);
    setRows(aRes.data??[]);
    setProjects(Object.fromEntries((pRes.data??[]).map((p:any)=>[p.id,p.name])));
    setLoading(false);
  },[]);
  useEffect(()=>{load();},[load]);

  if(loading)return<div className="flex justify-center py-24"><Spinner size={28}/></div>;

  const pending=rows.filter((r:any)=>r.status==='pending');
  const decided=rows.filter((r:any)=>r.status!=='pending');
  const name=(r:any)=>r.release_name||projects[r.project_id]||'Release';

  return<div>
    <PageHeader title="Approvals" description="Releases awaiting sign-off. Every decision is logged for audit."
      actions={pending.length>0?<span className="chip bg-amber-50 text-amber-600 border border-amber-200">{pending.length} pending</span>:<span className="chip bg-green-50 text-green-700 border border-green-200">All clear</span>}
    />

    {rows.length===0?(
      <EmptyState icon={<ShieldCheck size={22}/>} title="No approvals yet" description="When a release requires sign-off, it appears here for the required approvers to review." action={<Link to="/projects" className="btn-primary">Go to projects</Link>}/>
    ):(
      <div className="space-y-5">
        <div className="card p-0">
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3"><Clock size={15} className="text-amber-500"/><h2 className="text-sm font-semibold text-navy-900">Awaiting approval</h2></div>
          {pending.length===0?(
            <div className="px-4 py-8 text-center text-sm text-gray-400">Nothing waiting on you.</div>
          ):(
            <div className="divide-y divide-gray-100">
              {pending.map((r:any)=>(
                <div key={r.id} className="flex items-center gap-3 px-4 py-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Clock size={16}/></span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-navy-900">{name(r)}</p><p className="text-xs text-gray-500">{projects[r.project_id]||'—'} · requested {r.created_at?timeAgo(r.created_at):''}</p></div>
                  <Link to={`/projects/${r.project_id}`} className="btn-secondary text-xs">Review</Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-0">
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3"><ShieldCheck size={15} className="text-brand-600"/><h2 className="text-sm font-semibold text-navy-900">Recent decisions</h2></div>
          {decided.length===0?(
            <div className="px-4 py-8 text-center text-sm text-gray-400">No decisions recorded yet.</div>
          ):(
            <div className="divide-y divide-gray-100">
              {decided.slice(0,15).map((r:any)=>{
                const approved=r.status==='approved';
                return<div key={r.id} className="flex items-center gap-3 px-4 py-3.5">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${approved?'bg-green-50 text-green-600':'bg-red-50 text-danger-600'}`}>{approved?<CheckCircle2 size={16}/>:<XCircle size={16}/>}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-navy-900">{name(r)}</p><p className="text-xs text-gray-500">{projects[r.project_id]||'—'} · {r.created_at?timeAgo(r.created_at):''}</p></div>
                  <span className={`chip ${approved?'bg-green-50 text-green-700 border border-green-200':'bg-red-50 text-danger-600 border border-red-200'}`}>{approved?'Approved':'Rejected'}</span>
                </div>;
              })}
            </div>
          )}
        </div>
      </div>
    )}
  </div>;
}
