import { createClient } from "jsr:@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":Deno.env.get("APP_ORIGIN")||"https://sandbox-ai-app-eight.vercel.app","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization, X-Client-Info, Apikey, apikey"};
const DOMAINS=['Code','Infrastructure','DevOps','QA','Cost','Dependencies','Vendor Intelligence'];
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  const auth=req.headers.get('Authorization')||'';
  const token=auth.replace(/^Bearer\s+/i,'');
  try{
    const url=Deno.env.get('SUPABASE_URL')!;
    const db=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const {data:{user}}=await db.auth.getUser(token);
    if(!user)return json({error:'Invalid or expired session'},401);
    const {projectId}=await req.json();
    if(!projectId)return json({error:'Project is required'},400);
    const {data:p}=await db.from('projects').select('id,workspace_id,git_url,git_branch').eq('id',projectId).single();
    if(!p?.git_url)return json({error:'Connected repository required'},400);
    const {data:member}=await db.from('workspace_members').select('id').eq('workspace_id',p.workspace_id).eq('user_id',user.id).maybeSingle();
    if(!member)return json({error:'Forbidden'},403);

    const {data:existing}=await db.from('analysis_runs').select('id,status,created_at').eq('project_id',projectId).in('status',['queued','running']).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(existing)return json({success:true,reused:true,analysisRunId:existing.id,status:existing.status},202);

    const {data:v,error:ve}=await db.from('validations').insert({project_id:projectId,workspace_id:p.workspace_id,status:'pending',trigger:'intelligence',created_by:user.id}).select('id').single();
    if(ve)throw ve;
    const snapshot={repository:p.git_url,branch:p.git_branch||'main',requested_at:new Date().toISOString()};
    const {data:run,error:re}=await db.from('analysis_runs').insert({workspace_id:p.workspace_id,project_id:projectId,validation_id:v.id,mode:'smart',depth:'deep',domains:DOMAINS,status:'queued',config:{source:'analysis_orchestrator',architecture:'control-plane-worker',snapshot,stages:{understand:'queued',investigate:'blocked',resolve:'blocked'}},created_by:user.id}).select('id').single();
    if(re)throw re;
    const {error:je}=await db.from('analysis_jobs').insert({workspace_id:p.workspace_id,project_id:projectId,analysis_run_id:run.id,validation_id:v.id,stage:'understand',status:'queued',priority:80,input:{snapshot,domains:DOMAINS}});
    if(je)throw je;
    return json({success:true,analysisRunId:run.id,validationId:v.id,status:'queued',stage:'understand'},202);
  }catch(e){return json({error:e instanceof Error?e.message:'Could not queue analysis'},500)}
});
