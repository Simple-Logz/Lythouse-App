import{useCallback,useEffect,useRef,useState}from'react';
import{supabase,type Finding,type Validation,anonKey,edgeFunctionUrl}from'../lib/supabase';
import{Spinner}from'../lib/ui';
import{Activity,Shield,CheckCircle2,AlertTriangle,XCircle,Clock,Zap,RefreshCw,Play,Sparkles,GitPullRequest,Users,BarChart3,Loader as Loader2,ChevronRight,MessageSquare,X}from'lucide-react';

export function ReleaseWarRoom({projectId,project,onRunValidation,running}:{projectId:string;project:any;onRunValidation:()=>void;running:boolean;}){
  const[findings,setFindings]=useState<Finding[]>([]);
  const[validations,setValidations]=useState<Validation[]>([]);
  const[loading,setLoading]=useState(true);
  const[aiRec,setAiRec]=useState<string>('');
  const[loadingRec,setLoadingRec]=useState(false);
  const[chatMsg,setChatMsg]=useState('');
  const[chatHistory,setChatHistory]=useState<{role:'user'|'ai';text:string;time:string}[]>([]);
  const[chatLoading,setChatLoading]=useState(false);
  const chatEndRef=useRef<HTMLDivElement>(null);
  const pollRef=useRef<ReturnType<typeof setInterval>|null>(null);

  const load=useCallback(async()=>{
    setLoading(true);
    const[fr,vr]=await Promise.all([
      supabase.from('findings').select('*').eq('project_id',projectId).order('created_at',{ascending:false}),
      supabase.from('validations').select('*').eq('project_id',projectId).order('created_at',{ascending:false}).limit(10),
    ]);
    setFindings((fr.data??[]) as Finding[]);
    setValidations((vr.data??[]) as Validation[]);
    setLoading(false);
  },[projectId]);

  useEffect(()=>{
    load();
    // Auto-refresh every 30 seconds
    pollRef.current=setInterval(load,30000);
    return()=>{if(pollRef.current)clearInterval(pollRef.current);};
  },[load]);

  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:'smooth'});},[chatHistory]);

  const getAIRecommendation=async()=>{
    setLoadingRec(true);
    const open=findings.filter(f=>f.status==='open');
    const latest=validations.find(v=>v.status==='completed');
    try{
      const res=await fetch(`${edgeFunctionUrl}/ai-chat`,{method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${anonKey}`,'apikey':anonKey},
        body:JSON.stringify({
          systemPrompt:'You are an AI Release Manager in a live war room. Be direct, decisive, and brief. Use bullet points.',
          messages:[{role:'user',content:`LIVE RELEASE STATUS for "${project?.name}":
- Risk Score: ${latest?.risk_score??'Unknown'}/100
- Open Findings: ${open.length} (${open.filter(f=>f.severity==='critical').length} critical, ${open.filter(f=>f.severity==='high').length} high)
- Total Validations Run: ${validations.length}
- Last Scan: ${latest?new Date(latest.created_at).toLocaleString():'Never'}

Give me:
1. DECISION: Deploy Now / Delay / Block (bold)
2. TOP 3 RISKS right now
3. IMMEDIATE ACTIONS (what to do in the next 30 minutes)
4. ESTIMATED TIME TO READY`}]
        })
      });
      if(res.ok){const d=await res.json();setAiRec(d.content||'No recommendation available.');}
    }catch{setAiRec('Failed to get AI recommendation.');}
    setLoadingRec(false);
  };

  const sendChat=async()=>{
    if(!chatMsg.trim())return;
    const msg=chatMsg.trim();
    setChatMsg('');
    setChatHistory(prev=>[...prev,{role:'user',text:msg,time:new Date().toLocaleTimeString()}]);
    setChatLoading(true);
    const open=findings.filter(f=>f.status==='open');
    const latest=validations.find(v=>v.status==='completed');
    try{
      const res=await fetch(`${edgeFunctionUrl}/ai-chat`,{method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${anonKey}`,'apikey':anonKey},
        body:JSON.stringify({
          systemPrompt:`You are an AI Release Manager in a live war room for project "${project?.name}". Current state: Risk Score ${latest?.risk_score??'unknown'}/100, ${open.length} open findings (${open.filter(f=>f.severity==='critical').length} critical). Be concise and actionable.`,
          messages:[...chatHistory.map(m=>({role:m.role==='user'?'user':'assistant',content:m.text})),{role:'user',content:msg}]
        })
      });
      if(res.ok){const d=await res.json();setChatHistory(prev=>[...prev,{role:'ai',text:d.content||'No response.',time:new Date().toLocaleTimeString()}]);}
    }catch{setChatHistory(prev=>[...prev,{role:'ai',text:'Failed to connect.',time:new Date().toLocaleTimeString()}]);}
    setChatLoading(false);
  };

  if(loading)return<div className="flex justify-center py-16"><Spinner size={22}/></div>;

  const open=findings.filter(f=>f.status==='open');
  const latest=validations.find(v=>v.status==='completed');
  const blockers=open.filter(f=>f.severity==='critical');
  const readiness=latest?Math.max(0,100-(latest.risk_score??50)):0;
  const statusColor=blockers.length>0?'text-red-600 bg-red-50 border-red-300':readiness>=75?'text-green-600 bg-green-50 border-green-300':'text-amber-600 bg-amber-50 border-amber-300';

  return(
    <div className="space-y-4">
      {/* War Room Header */}
      <div className={`rounded-2xl border-2 px-6 py-4 ${statusColor}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3"><span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${blockers.length>0?'bg-red-400':readiness>=75?'bg-green-400':'bg-amber-400'}`}/><span className={`relative inline-flex rounded-full h-3 w-3 ${blockers.length>0?'bg-red-500':readiness>=75?'bg-green-500':'bg-amber-500'}`}/></span>
              <span className="text-xs font-bold uppercase tracking-widest">LIVE</span>
            </div>
            <h2 className="text-xl font-black">{project?.name} — Release War Room</h2>
          </div>
          <div className="flex items-center gap-2 text-xs opacity-70">
            <RefreshCw size={11}/>Auto-refreshing every 30s
          </div>
        </div>
      </div>

      {/* Live metrics grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {label:'Release Readiness',value:`${readiness}%`,color:readiness>=75?'text-green-600':readiness>=50?'text-amber-600':'text-red-600',bg:readiness>=75?'bg-green-50':'bg-red-50',border:readiness>=75?'border-green-200':'border-red-200'},
          {label:'Risk Score',value:`${latest?.risk_score??'—'}/100`,color:(latest?.risk_score??0)>70?'text-red-600':(latest?.risk_score??0)>40?'text-amber-600':'text-green-600',bg:'bg-gray-50',border:'border-gray-200'},
          {label:'Blockers',value:blockers.length,color:blockers.length>0?'text-red-600':'text-green-600',bg:blockers.length>0?'bg-red-50':'bg-green-50',border:blockers.length>0?'border-red-200':'border-green-200'},
          {label:'Validations Run',value:validations.length,color:'text-brand-600',bg:'bg-brand-50',border:'border-brand-200'},
        ].map(s=>(
          <div key={s.label} className={`card border-2 ${s.border} ${s.bg} py-3`}>
            <div className={`text-3xl font-black tabular-nums ${s.color}`}>{s.value}</div>
            <div className="text-xs font-medium text-gray-600 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* AI Release Manager */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-navy-900 flex items-center gap-2"><Sparkles size={14} className="text-purple-600"/>AI Release Manager</h3>
            <button onClick={getAIRecommendation} disabled={loadingRec} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50">
              {loadingRec?<Loader2 size={12} className="animate-spin"/>:<Sparkles size={12}/>}{aiRec?'Refresh':'Get Recommendation'}
            </button>
          </div>
          {aiRec?(
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-purple-50 rounded-xl p-4 border border-purple-200">{aiRec}</div>
          ):(
            <div className="flex items-center justify-center h-24 text-sm text-gray-400 bg-gray-50 rounded-xl border border-gray-200">
              Click "Get Recommendation" for AI analysis
            </div>
          )}
        </div>

        {/* Live Chat with AI */}
        <div className="card flex flex-col" style={{height:320}}>
          <h3 className="text-sm font-semibold text-navy-900 mb-3 flex items-center gap-2 shrink-0"><MessageSquare size={14} className="text-brand-600"/>Ask AI — War Room Chat</h3>
          <div className="flex-1 overflow-y-auto space-y-2 mb-3 min-h-0">
            {chatHistory.length===0&&(
              <div className="text-xs text-gray-400 text-center py-4">
                Ask anything about this release:<br/>
                "Can we deploy tonight?" • "What's the biggest risk?" • "How long to fix the blockers?"
              </div>
            )}
            {chatHistory.map((m,i)=>(
              <div key={i} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${m.role==='user'?'bg-brand-600 text-white':'bg-gray-100 text-gray-800'}`}>
                  <div className="leading-relaxed whitespace-pre-wrap">{m.text}</div>
                  <div className={`text-[10px] mt-1 ${m.role==='user'?'text-brand-200':'text-gray-400'}`}>{m.time}</div>
                </div>
              </div>
            ))}
            {chatLoading&&<div className="flex justify-start"><div className="bg-gray-100 rounded-xl px-3 py-2 text-xs text-gray-500 flex items-center gap-1.5"><Loader2 size={11} className="animate-spin"/>Thinking…</div></div>}
            <div ref={chatEndRef}/>
          </div>
          <div className="flex gap-2 shrink-0">
            <input value={chatMsg} onChange={e=>setChatMsg(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&sendChat()} placeholder="Ask about this release…" className="input text-sm flex-1 py-2"/>
            <button onClick={sendChat} disabled={chatLoading||!chatMsg.trim()} className="btn-primary text-sm px-3 disabled:opacity-50"><ChevronRight size={15}/></button>
          </div>
        </div>
      </div>

      {/* Active findings */}
      {open.length>0&&(
        <div className="card">
          <h3 className="text-sm font-semibold text-navy-900 mb-3 flex items-center gap-2"><AlertTriangle size={14} className="text-amber-600"/>Active Release Blockers & Issues</h3>
          <div className="space-y-2">
            {open.slice(0,8).map(f=>(
              <div key={f.id} className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${f.severity==='critical'?'border-red-200 bg-red-50':f.severity==='high'?'border-amber-200 bg-amber-50':'border-gray-200 bg-white'}`}>
                <div className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${f.severity==='critical'?'bg-red-500':f.severity==='high'?'bg-amber-500':f.severity==='medium'?'bg-blue-500':'bg-gray-400'}`}/>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy-900">{f.title}</p>
                  {f.file_path&&<p className="text-xs text-gray-500 font-mono mt-0.5">{f.file_path}</p>}
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${f.severity==='critical'?'bg-red-100 text-red-700':f.severity==='high'?'bg-amber-100 text-amber-700':'bg-gray-100 text-gray-600'} capitalize shrink-0`}>{f.severity}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="card">
        <h3 className="text-sm font-semibold text-navy-900 mb-3 flex items-center gap-2"><Zap size={14} className="text-brand-600"/>War Room Actions</h3>
        <div className="flex flex-wrap gap-2">
          <button onClick={onRunValidation} disabled={running} className="btn-primary text-sm">
            {running?<><Loader2 size={13} className="animate-spin"/>Scanning…</>:<><Play size={13}/>Trigger Revalidation</>}
          </button>
          <button className="btn-secondary text-sm"><GitPullRequest size={13}/>Create PR for All Fixes</button>
          <button className="btn-secondary text-sm"><Users size={13}/>Notify Team</button>
          <button onClick={load} className="btn-secondary text-sm"><RefreshCw size={13}/>Refresh Status</button>
        </div>
      </div>
    </div>
  );
}
