import{useState,useRef,useEffect,useCallback}from'react';
import{supabase}from'../lib/supabase';
import type{Finding,Validation,AiInsight}from'../lib/supabase';
import{Sparkles,Send,AlertTriangle,TrendingUp,Shield,Zap,Brain,Lightbulb,Activity,ChevronRight,RefreshCw}from'lucide-react';

type Message={role:'user'|'assistant';content:string;timestamp:string;};
type ProjectData={findings:Finding[];validations:Validation[];insights:AiInsight[];projectName:string;gitUrl:string;};

const SUPABASE_URL=import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY=import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const QUICK_PROMPTS=[
  {icon:Shield,text:'What are the top security risks in this project?',color:'text-danger-600'},
  {icon:TrendingUp,text:'How has deployment risk changed over time?',color:'text-brand-600'},
  {icon:Zap,text:'What will likely fail in my next deployment?',color:'text-navy-600'},
  {icon:Lightbulb,text:'What should I fix first to improve readiness?',color:'text-amber-600'},
  {icon:Activity,text:'Are there any unusual patterns or anomalies?',color:'text-blue-600'},
  {icon:Brain,text:'Give me a deployment risk summary for production',color:'text-purple-600'},
];

function buildSystemPrompt(data:ProjectData):string{
  const openFindings=data.findings.filter(f=>f.status==='open');
  const critical=openFindings.filter(f=>f.severity==='critical');
  const high=openFindings.filter(f=>f.severity==='high');
  const medium=openFindings.filter(f=>f.severity==='medium');
  const low=openFindings.filter(f=>f.severity==='low');
  const completedVals=data.validations.filter(v=>v.status==='completed');
  const avgRisk=completedVals.length>0?Math.round(completedVals.reduce((s,v)=>s+(v.risk_score??0),0)/completedVals.length):null;
  const latestVal=completedVals[0]??null;
  const secretFindings=openFindings.filter(f=>f.category==='secret_scan');
  const depFindings=openFindings.filter(f=>f.category==='dependency_audit');
  const staticFindings=openFindings.filter(f=>f.category==='static_analysis');

  return`You are Sandbox AI's enterprise deployment intelligence engine. You have deep expertise in DevSecOps, software supply chain security, Kubernetes, CI/CD pipelines, and production reliability engineering.

You are analyzing the project: "${data.projectName}"${data.gitUrl?` (${data.gitUrl})`:''}

LIVE PROJECT DATA:
=================
Total findings: ${data.findings.length}
Open findings: ${openFindings.length}
  - Critical: ${critical.length}
  - High: ${high.length}
  - Medium: ${medium.length}
  - Low: ${low.length}

Finding categories:
  - Secrets/credentials exposed: ${secretFindings.length}
  - Static analysis issues: ${staticFindings.length}
  - Vulnerable dependencies: ${depFindings.length}

Validation history: ${data.validations.length} total, ${completedVals.length} completed
Latest risk score: ${latestVal?.risk_score??'No data'}${latestVal?` (${latestVal.severity} severity)`:''}
Average risk score: ${avgRisk??'No data'}

${critical.length>0?`CRITICAL FINDINGS (require immediate attention):
${critical.slice(0,5).map(f=>`- [${f.category}] ${f.title}${f.file_path?` in ${f.file_path}${f.line?`:${f.line}`:''}`:''} — ${f.recommendation??'Review immediately'}`).join('\n')}
`:''}
${high.length>0?`HIGH SEVERITY FINDINGS:
${high.slice(0,5).map(f=>`- [${f.category}] ${f.title}${f.file_path?` in ${f.file_path}`:''} — ${f.recommendation??'Address before deployment'}`).join('\n')}
`:''}
${depFindings.length>0?`VULNERABLE DEPENDENCIES:
${depFindings.slice(0,5).map(f=>`- ${f.title}: ${f.description??''}`).join('\n')}
`:''}
${completedVals.length>0?`RECENT VALIDATION RUNS:
${completedVals.slice(0,5).map(v=>`- ${new Date(v.created_at).toLocaleDateString()} | Risk: ${v.risk_score??'?'}/100 | Severity: ${v.severity??'none'} | Findings: ${v.total_findings} (Crit:${v.critical_count} High:${v.high_count} Med:${v.medium_count} Low:${v.low_count})`).join('\n')}
`:''}

INSTRUCTIONS:
- Be direct, specific, and technical. This is an enterprise engineering tool.
- Always reference actual findings, file paths, and line numbers from the data above.
- Give concrete, actionable recommendations with specific fix commands or code patterns where relevant.
- Use engineering terminology. Users are senior developers and DevOps engineers.
- If the data shows no issues, say so clearly and explain what that means for deployment readiness.
- Never make up findings or metrics not present in the data above.
- Format responses clearly with headers and bullet points where appropriate.
- When risk score or findings are high, be appropriately urgent without being alarmist.
- Provide deployment verdicts when asked: Go / Conditional Go / No-Go.`;
}

function MarkdownRenderer({content}:{content:string}){
  const lines=content.split('\n');
  return<div className="space-y-1">
    {lines.map((line,i)=>{
      if(line.startsWith('### '))return<h3 key={i} className="text-sm font-bold text-navy-900 mt-3 mb-1">{line.slice(4)}</h3>;
      if(line.startsWith('## '))return<h2 key={i} className="text-base font-bold text-navy-900 mt-4 mb-2">{line.slice(3)}</h2>;
      if(line.startsWith('# '))return<h1 key={i} className="text-lg font-bold text-navy-900 mt-4 mb-2">{line.slice(2)}</h1>;
      if(line.startsWith('- '))return<div key={i} className="flex items-start gap-2 text-sm text-navy-700"><span className="text-brand-500 mt-1 shrink-0">•</span><span>{line.slice(2)}</span></div>;
      if(line.startsWith('**')&&line.endsWith('**'))return<p key={i} className="text-sm font-bold text-navy-900">{line.slice(2,-2)}</p>;
      if(line.match(/^\d+\. /))return<div key={i} className="flex items-start gap-2 text-sm text-navy-700"><span className="text-brand-600 font-bold shrink-0">{line.match(/^\d+/)?.[0]}.</span><span>{line.replace(/^\d+\. /,'')}</span></div>;
      if(line.startsWith('```'))return<div key={i}/>;
      if(line.includes('|')&&line.trim().startsWith('|')){
        const cells=line.split('|').filter(c=>c.trim());
        const isHeader=lines[i+1]?.includes('---');
        const isSep=line.includes('---');
        if(isSep)return<div key={i}/>;
        return<div key={i} className={`grid text-xs gap-2 ${isHeader?'font-bold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1':'text-navy-700 py-0.5'}`} style={{gridTemplateColumns:`repeat(${cells.length},1fr)`}}>
          {cells.map((c,j)=><span key={j}>{c.trim()}</span>)}
        </div>;
      }
      if(line.trim()==='')return<div key={i} className="h-1"/>;
      return<p key={i} className="text-sm text-navy-700 leading-relaxed">{line}</p>;
    })}
  </div>;
}

export default function AIAssistantTab({projectId,workspaceId}:{projectId:string;workspaceId:string}){
  const[messages,setMessages]=useState<Message[]>([]);
  const[input,setInput]=useState('');
  const[loading,setLoading]=useState(false);
  const[projectData,setProjectData]=useState<ProjectData>({findings:[],validations:[],insights:[],projectName:'',gitUrl:''});
  const[dataLoaded,setDataLoaded]=useState(false);
  const[error,setError]=useState('');
  const scrollRef=useRef<HTMLDivElement>(null);

  const loadData=useCallback(async()=>{
    if(dataLoaded)return;
    try{
      const[findingsRes,valRes,insightsRes,projRes]=await Promise.all([
        supabase.from('findings').select('*').eq('project_id',projectId).order('created_at',{ascending:false}).limit(200),
        supabase.from('validations').select('*').eq('project_id',projectId).order('created_at',{ascending:false}).limit(50),
        supabase.from('ai_insights').select('*').eq('project_id',projectId).order('created_at',{ascending:false}).limit(20),
        supabase.from('projects').select('name,git_url').eq('id',projectId).maybeSingle(),
      ]);
      setProjectData({
        findings:findingsRes.data||[],
        validations:valRes.data||[],
        insights:insightsRes.data||[],
        projectName:projRes.data?.name||'this project',
        gitUrl:projRes.data?.git_url||'',
      });
      setDataLoaded(true);
    }catch{setDataLoaded(true);}
  },[projectId,dataLoaded]);

  useEffect(()=>{loadData();},[loadData]);
  useEffect(()=>{if(scrollRef.current)scrollRef.current.scrollTop=scrollRef.current.scrollHeight;},[messages]);

  const callClaudeAPI=async(userMessage:string,history:Message[]):Promise<string>=>{
    const systemPrompt=buildSystemPrompt(projectData);
    const apiMessages=history.map(m=>({role:m.role,content:m.content}));
    apiMessages.push({role:'user',content:userMessage});

    const res=await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`Bearer ${SUPABASE_ANON_KEY}`,
        'apikey':SUPABASE_ANON_KEY,
      },
      body:JSON.stringify({systemPrompt,messages:apiMessages}),
    });

    if(!res.ok){
      const err=await res.text();
      throw new Error(`AI service error: ${err}`);
    }
    const data=await res.json();
    return data.content||'No response received.';
  };

  const handleSend=async(text?:string)=>{
    const msg=(text||input).trim();
    if(!msg||loading)return;
    setInput('');setLoading(true);setError('');
    if(!dataLoaded)await loadData();
    const userMsg:Message={role:'user',content:msg,timestamp:new Date().toISOString()};
    setMessages(prev=>[...prev,userMsg]);
    try{
      const response=await callClaudeAPI(msg,messages);
      setMessages(prev=>[...prev,{role:'assistant',content:response,timestamp:new Date().toISOString()}]);
    }catch(e:any){
      setError(e.message||'Failed to get AI response. Check that the ai-chat edge function is deployed.');
    }
    setLoading(false);
  };

  return(
    <div className="flex flex-col" style={{height:"calc(100vh - 300px)",minHeight:480}}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center">
          <Sparkles size={20} className="text-white"/>
        </div>
        <div>
          <h2 className="text-base font-semibold text-navy-900">AI Deployment Intelligence</h2>
          <p className="text-xs text-gray-500">Powered by Claude · Analyzing {projectData.findings.length} findings · {projectData.validations.length} validations</p>
        </div>
        <button onClick={()=>{setDataLoaded(false);loadData();}} className="ml-auto btn-ghost p-1.5" title="Refresh data"><RefreshCw size={14}/></button>
      </div>

      {error&&<div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-danger-600"><AlertTriangle size={14} className="shrink-0 mt-0.5"/><span>{error}</span></div>}

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.length===0&&(
          <div className="py-6">
            <div className="mb-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Project Intelligence Summary</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['Open Findings',projectData.findings.filter(f=>f.status==='open').length],
                  ['Critical',projectData.findings.filter(f=>f.severity==='critical'&&f.status==='open').length],
                  ['Validations',projectData.validations.length],
                  ['Avg Risk',projectData.validations.filter(v=>v.risk_score!==null).length>0?Math.round(projectData.validations.filter(v=>v.risk_score!==null).reduce((s,v)=>s+(v.risk_score??0),0)/projectData.validations.filter(v=>v.risk_score!==null).length)+'%':'—'],
                ].map(([l,v])=>(
                  <div key={l as string} className="text-center">
                    <p className="text-lg font-bold text-navy-900">{v}</p>
                    <p className="text-xs text-gray-500">{l}</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">Quick Analysis</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {QUICK_PROMPTS.map((p,i)=>(
                <button key={i} onClick={()=>handleSend(p.text)} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-all text-left group">
                  <p.icon size={16} className={p.color}/>
                  <span className="text-sm text-navy-700 flex-1">{p.text}</span>
                  <ChevronRight size={14} className="text-gray-300 group-hover:text-brand-500 transition-colors"/>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m,i)=>(
          <div key={i} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}>
            <div className={`max-w-[88%] ${m.role==='user'?'bg-navy-900 text-white rounded-2xl rounded-br-sm':'bg-white border border-gray-200 rounded-2xl rounded-bl-sm'} p-4 shadow-sm`}>
              {m.role==='assistant'&&(
                <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b border-gray-100">
                  <Sparkles size={12} className="text-brand-500"/>
                  <span className="text-xs font-semibold text-brand-600">Sandbox AI</span>
                </div>
              )}
              {m.role==='user'
                ?<p className="text-sm text-white">{m.content}</p>
                :<MarkdownRenderer content={m.content}/>
              }
              <p className={`text-xs mt-2 ${m.role==='user'?'text-navy-400':'text-gray-400'}`}>
                {new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
              </p>
            </div>
          </div>
        ))}

        {loading&&(
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm p-4 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="flex gap-1">
                  {[0,150,300].map(d=><span key={d} className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{animationDelay:`${d}ms`}}/>)}
                </div>
                <span className="text-xs text-gray-500">Analyzing {projectData.findings.length} findings…</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <input type="text" value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend();}}}
          placeholder="Ask about deployment risk, security posture, readiness…"
          className="input flex-1 text-sm" disabled={loading}/>
        <button onClick={()=>handleSend()} disabled={loading||!input.trim()} className="btn-primary px-4 disabled:opacity-50">
          <Send size={15}/>
        </button>
      </div>
    </div>
  );
}
