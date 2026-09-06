import { createClient } from "jsr:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":Deno.env.get("APP_ORIGIN")||"https://sandbox-ai-app-eight.vercel.app","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization, X-Client-Info, Apikey, apikey"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const auth=req.headers.get('Authorization')||'',token=auth.replace(/^Bearer\s+/i,'');
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const {data:{user}}=await db.auth.getUser(token); if(!user)return json({error:'Invalid or expired session'},401);
  const {findingId,action}=await req.json();
  if(!findingId||!['guided_fix','create_incident','fix_in_lythouse'].includes(action))return json({error:'findingId and a valid action are required'},400);
  const {data:f,error}=await db.from('intelligence_findings').select('*').eq('id',findingId).single(); if(error||!f)return json({error:'Finding not found'},404);
  const {data:m}=await db.from('workspace_members').select('id').eq('workspace_id',f.workspace_id).eq('user_id',user.id).maybeSingle(); if(!m)return json({error:'Forbidden'},403);
  if(action==='create_incident'){
   const description=[f.observation,f.why_it_matters&&`Why it matters: ${f.why_it_matters}`,f.production_impact&&`Production impact: ${f.production_impact}`,f.business_impact&&`Business impact: ${f.business_impact}`,f.recommendation&&`Recommended fix: ${f.recommendation}`,f.verification&&`Verify: ${f.verification}`].filter(Boolean).join('\n\n');
   const {data:incident,error:ie}=await db.from('incidents').insert({workspace_id:f.workspace_id,project_id:f.project_id,title:`[Lythouse] ${f.title}`,description,severity:f.severity||'medium',status:'open'}).select('id').single(); if(ie)throw ie;
   return json({success:true,action,incidentId:incident.id});
  }
  if(action==='fix_in_lythouse')return json({success:true,action,status:'requires_verified_remediation',message:'Automated code changes require an isolated remediation worker and verification before a PR can be proposed.'},202);
  return json({success:true,action,guide:{problem:f.observation,whyItMatters:f.why_it_matters||f.production_impact||'Repository evidence indicates this finding can affect deployment safety.',recommendedFix:f.recommendation||'Review the cited evidence and apply the smallest safe correction.',verify:f.verification||'Re-run Lythouse analysis and the affected tests after the change.',evidence:f.evidence||[]}});
 }catch(e){return json({error:e instanceof Error?e.message:'Resolution action failed'},500)}
});