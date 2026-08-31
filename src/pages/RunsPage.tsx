// @ts-nocheck
import { useEffect, useMemo, useState } from 'react'
import { supabase, resolveActiveWorkspace, type Validation } from '../lib/supabase'
import { PageHeader, Spinner, fmtDuration } from '../lib/ui'
import { Link } from '../lib/router'
import { RefreshCw, ShieldCheck } from 'lucide-react'

type Row = Validation & { project_name?: string; project_branch?: string }

const CSS = `
.runs{max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:14px}.runs-toolbar{display:flex;gap:9px;align-items:center;flex-wrap:wrap;background:var(--lh-surface);border:1px solid var(--lh-border);border-radius:14px;padding:10px 12px}.runs-toolbar select,.runs-toolbar button{font:inherit;font-size:12px;border:1px solid var(--lh-border);border-radius:9px;background:var(--lh-surface);color:var(--lh-text);padding:7px 10px}.runs-toolbar button{display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:700}.runs-spacer{flex:1}.runs-count{font-size:11px;color:var(--lh-text2)}.runs-error{border:1px solid #f1a7a7;background:#fff3f3;color:#b42318;border-radius:12px;padding:12px 14px;font-size:13px;font-weight:600}.runs-card{background:var(--lh-surface);border:1px solid var(--lh-border);border-radius:14px;overflow:hidden}.runs-row{display:grid;grid-template-columns:1.55fr .78fr .78fr .78fr .78fr 1fr;gap:12px;align-items:center;min-height:64px;padding:10px 16px;border-top:1px solid var(--lh-border);text-decoration:none;color:var(--lh-text);font-size:13px}.runs-row:first-child{border-top:0}.runs-row.h{min-height:38px;padding-top:8px;padding-bottom:8px;font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--lh-text3);background:var(--lh-surface2)}.runs-row:not(.h):hover{background:var(--lh-surface2)}.runs-project{font-size:14px;line-height:1.25;font-weight:700}.runs-sub{font-size:10px;line-height:1.3;color:var(--lh-text3);margin-top:3px}.runs-status{display:inline-flex;width:max-content;align-items:center;border-radius:999px;padding:4px 9px;font-size:10px;line-height:1;font-weight:700;text-transform:capitalize;background:var(--lh-surface2);border:1px solid var(--lh-border)}.runs-empty{text-align:center;padding:48px 20px;color:var(--lh-text3);font-size:12px}.runs-empty svg{margin:0 auto 10px}.runs-empty h3{color:var(--lh-text);margin:0 0 5px;font-size:14px}@media(max-width:850px){.runs-row{grid-template-columns:1.5fr 1fr 1fr;min-height:58px;padding:9px 12px}.runs-row>*:nth-child(4),.runs-row>*:nth-child(5),.runs-row>*:nth-child(6){display:none}}
`

export function RunsPage(){
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [rows,setRows]=useState<Row[]>([])
  const [projects,setProjects]=useState<{id:string;name:string}[]>([])
  const [status,setStatus]=useState('all')
  const [projectId,setProjectId]=useState('all')
  const [reload,setReload]=useState(0)

  useEffect(()=>{
    let cancelled=false
    const load=async()=>{
      setLoading(true);setError('')
      try{
        // Supabase membership is authoritative. localStorage is only a remembered
        // workspace preference, so stale browser state cannot hide persisted runs.
        const workspace=await resolveActiveWorkspace()
        const wid=workspace.id
        const [vr,pr]=await Promise.all([
          supabase.from('validations')
            .select('id,project_id,workspace_id,status,trigger,commit_sha,risk_score,severity,summary,total_findings,critical_count,high_count,medium_count,low_count,duration_ms,created_by,created_at,completed_at,projects(name,git_branch)')
            .eq('workspace_id',wid).order('created_at',{ascending:false}),
          supabase.from('projects').select('id,name').eq('workspace_id',wid).order('name')
        ])
        if(vr.error)throw vr.error
        if(pr.error)throw pr.error
        if(cancelled)return
        setRows((vr.data||[]).map((r:any)=>({...r,project_name:r.projects?.name||'Unknown project',project_branch:r.projects?.git_branch||'main'})))
        setProjects(pr.data||[])
      }catch(e:any){if(!cancelled){setRows([]);setProjects([]);setError(e?.message||'Unable to load validation run history.')}}
      finally{if(!cancelled)setLoading(false)}
    }
    load()
    const changed=()=>setReload(x=>x+1)
    window.addEventListener('lythouse:workspace-changed',changed)
    return()=>{cancelled=true;window.removeEventListener('lythouse:workspace-changed',changed)}
  },[reload])

  const filtered=useMemo(()=>rows.filter(r=>(status==='all'||r.status===status)&&(projectId==='all'||r.project_id===projectId)),[rows,status,projectId])

  if(loading)return <div className="flex justify-center py-24"><Spinner size={28}/></div>
  return <div className="runs"><style>{CSS}</style>
    <PageHeader title="Runs" description="Persistent validation history for the authenticated workspace. Every run is loaded from Supabase and remains available after refresh or sign-in."/>
    {error&&<div className="runs-error" role="alert">{error}</div>}
    <div className="runs-toolbar">
      <select value={status} onChange={e=>setStatus(e.target.value)} aria-label="Filter by status"><option value="all">All statuses</option><option value="pending">Pending</option><option value="running">Running</option><option value="completed">Completed</option><option value="failed">Failed</option></select>
      <select value={projectId} onChange={e=>setProjectId(e.target.value)} aria-label="Filter by project"><option value="all">All projects</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <span className="runs-spacer"/><span className="runs-count">{filtered.length} run{filtered.length===1?'':'s'}</span>
      <button type="button" onClick={()=>setReload(x=>x+1)}><RefreshCw size={13}/>Refresh</button>
    </div>
    <div className="runs-card">
      <div className="runs-row h"><span>Project</span><span>Status</span><span>Risk</span><span>Findings</span><span>Duration</span><span>Started</span></div>
      {filtered.length?filtered.map(r=><Link key={r.id} to={`/projects/${r.project_id}?tab=validations&validation=${r.id}`} className="runs-row">
        <span><div className="runs-project">{r.project_name}</div><div className="runs-sub">{r.project_branch}{r.commit_sha?` · ${r.commit_sha.slice(0,7)}`:''}</div></span>
        <span><span className="runs-status">{r.status}</span></span><span>{r.risk_score==null?'—':r.risk_score}</span><span>{r.total_findings??0}</span><span>{r.duration_ms?fmtDuration(r.duration_ms):'—'}</span><span>{new Date(r.created_at).toLocaleString()}</span>
      </Link>):<div className="runs-empty"><ShieldCheck size={28}/><h3>No validation runs yet</h3><div>Run a validation on a connected project. Each run will be stored separately and appear here.</div></div>}
    </div>
  </div>
}
