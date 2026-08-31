import Anthropic from "npm:@anthropic-ai/sdk@0.27.3";
import { createClient } from "npm:@supabase/supabase-js@2";
const origin=Deno.env.get('APP_ORIGIN')||'https://lythouse.ai';
const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-Client-Info, Apikey'};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'Content-Type':'application/json'}});
const SYSTEM=`You are the LytHouse evidence-review model. You receive verified deterministic findings from a real repository scan. Never create a finding, CVE, file, line number, secret, dependency, metric or fact that is absent from the evidence. Your job is to explain impact, prioritize verified findings, improve remediation guidance, identify relationships among verified findings, and provide a release assessment. Deterministic findings and the deterministic verdict are authoritative. Return strict JSON only.`;
Deno.serve(async(req:Request)=>{if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});if(req.method!=='POST')return json({error:'Method not allowed'},405);try{
 const auth=req.headers.get('Authorization')||'';const token=auth.replace(/^Bearer\s+/i,'');if(!token)return json({error:'Authentication required'},401);
 const url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;const db=createClient(url,service);const{data:{user}}=await db.auth.getUser(token);if(!user)return json({error:'Invalid session'},401);
 const{validationId}=await req.json();if(!validationId)return json({error:'validationId required'},400);
 const{data:v}=await db.from('validations').select('id,workspace_id,project_id,risk_score,severity,summary,status').eq('id',validationId).maybeSingle();if(!v)return json({error:'Validation not found'},404);
 const{data:m}=await db.from('workspace_members').select('id').eq('workspace_id',v.workspace_id).eq('user_id',user.id).maybeSingle();if(!m)return json({error:'Forbidden'},403);
 const{data:entitled}=await db.rpc('workspace_has_feature',{p_workspace:v.workspace_id,p_feature:'ai_analysis'});if(entitled===false)return json({error:'AI analysis is not included in this plan'},403);
 const{data:p}=await db.from('projects').select('id,name,git_url,git_branch').eq('id',v.project_id).single();const{data:f}=await db.from('findings').select('id,severity,category,title,description,file_path,line,recommendation,confidence').eq('validation_id',validationId).order('severity').limit(100);
 const key=Deno.env.get('ANTHROPIC_API_KEY');if(!key)return json({error:'AI service is not configured'},503);
 const evidence={project:p,validation:v,findings:f||[]};const client=new Anthropic({apiKey:key});const r=await client.messages.create({model:'claude-sonnet-4-6',max_tokens:2200,system:SYSTEM,messages:[{role:'user',content:`Review this verified evidence and return JSON with keys executive_summary, release_assessment, priorities (array of {finding_id,reason,remediation}), confidence_notes. Do not add findings. Evidence:\n${JSON.stringify(evidence)}`}]});
 const text=r.content.filter(x=>x.type==='text').map((x:any)=>x.text).join('');let review:any;try{review=JSON.parse(text.replace(/^```json\s*|\s*```$/g,''))}catch{return json({error:'AI returned invalid structured output'},502)}
 await db.from('ai_insights').insert({workspace_id:v.workspace_id,project_id:v.project_id,validation_id:v.id,type:'validation_review',title:'AI validation review',content:review,confidence:100,created_by:user.id});
 await db.from('usage_events').insert({workspace_id:v.workspace_id,user_id:user.id,project_id:v.project_id,event_type:'ai.validation_review',quantity:1,metadata:{validation_id:v.id}});
 return json({success:true,review});
}catch(e){console.error(e);return json({error:e instanceof Error?e.message:'AI review failed'},500)}});
