import Anthropic from "npm:@anthropic-ai/sdk@0.27.3";
import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin=Deno.env.get("APP_ORIGIN")||"https://sandbox-ai-app-eight.vercel.app";
const corsHeaders={"Access-Control-Allow-Origin":allowedOrigin,"Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization, X-Client-Info, Apikey","Vary":"Origin"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
const SYSTEM=`You are LytHouse AI, an enterprise release-readiness assistant. Answer only from verified workspace evidence supplied by the server. Never invent findings, files, scores, approvals, deployments, infrastructure, or fixes. Explain the release decision in plain language, prioritize critical/high blockers, cite file paths and line numbers when present, and give concrete recommended fixes from the evidence. Deterministic LytHouse checks own the release verdict; you explain but never override it. If evidence is missing, say exactly what is missing.`;

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:corsHeaders});
 if(req.method!=="POST")return json({error:"Method not allowed",code:"method_not_allowed"},405);
 try{
  const auth=req.headers.get("Authorization")||""; if(!auth.startsWith("Bearer "))return json({error:"Authentication required",code:"authentication_required"},401);
  const supabaseUrl=Deno.env.get("SUPABASE_URL")!,anonKey=Deno.env.get("SUPABASE_ANON_KEY")!,serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:auth}}});
  const{data:{user},error:userError}=await userClient.auth.getUser(); if(userError||!user)return json({error:"Your session is no longer valid. Sign in again.",code:"invalid_session"},401);
  const{workspaceId,messages}=await req.json(); if(!workspaceId||!Array.isArray(messages)||messages.length===0)return json({error:"Workspace and message are required",code:"invalid_request"},400); if(messages.length>24)return json({error:"Conversation is too long",code:"conversation_too_long"},413);
  const safeMessages=messages.map((m:any)=>({role:m.role==="assistant"?"assistant":"user",content:String(m.content||"").slice(0,6000)}));
  const admin=createClient(supabaseUrl,serviceKey);
  const{data:membership}=await admin.from("workspace_members").select("workspace_id,role").eq("workspace_id",workspaceId).eq("user_id",user.id).maybeSingle(); if(!membership)return json({error:"You do not have access to this workspace.",code:"workspace_access_denied"},403);
  const{data:validation,error:validationError}=await admin.from("validations").select("id,release_id,project_id,status,commit_sha,risk_score,severity,summary,total_findings,critical_count,high_count,medium_count,low_count,duration_ms,created_at,completed_at").eq("workspace_id",workspaceId).eq("status","completed").order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(validationError)throw validationError;
  let evidence:any={workspace_id:workspaceId,membership_role:membership.role,validation:null,findings:[],release:null,approvals:[],deployments:[]};
  if(validation){
   const[{data:findings,error:findingsError},{data:release},{data:approvals},{data:deployments}]=await Promise.all([
    admin.from("findings").select("id,severity,category,title,description,file_path,line,recommendation,confidence,status,resolution_note,resolved_at").eq("validation_id",validation.id).neq("status","resolved").order("created_at",{ascending:true}).limit(40),
    validation.release_id?admin.from("releases").select("id,status,decision,risk_score,readiness_score,blocker_count,warning_count,commit_sha,branch,approved_at,deployed_at").eq("id",validation.release_id).maybeSingle():Promise.resolve({data:null}),
    validation.release_id?admin.from("approvals").select("id,status,decision,created_at,decided_at").eq("release_id",validation.release_id).order("created_at",{ascending:false}).limit(10):Promise.resolve({data:[]}),
    validation.release_id?admin.from("deployments").select("id,status,provider,created_at,started_at,completed_at").eq("release_id",validation.release_id).order("created_at",{ascending:false}).limit(10):Promise.resolve({data:[]})
   ]);
   if(findingsError)throw findingsError;
   evidence={...evidence,validation,findings:findings||[],release:release||null,approvals:approvals||[],deployments:deployments||[]};
  }
  const anthropicKey=Deno.env.get("ANTHROPIC_API_KEY"); if(!anthropicKey)return json({error:"LytHouse AI is not configured on this environment.",code:"ai_not_configured"},503);
  const client=new Anthropic({apiKey:anthropicKey});
  const response=await client.messages.create({model:"claude-sonnet-4-6",max_tokens:1600,system:`${SYSTEM}\n\n<verified_workspace_evidence>\n${JSON.stringify(evidence)}\n</verified_workspace_evidence>`,messages:safeMessages});
  const content=response.content.filter((b:any)=>b.type==="text").map((b:any)=>b.text).join("\n"); return json({content,evidenceAvailable:!!validation,validationId:validation?.id||null,releaseId:validation?.release_id||null});
 }catch(error:any){console.error("AI chat error",error);return json({error:"LytHouse could not load verified release evidence.",code:"evidence_query_failed"},500);}
});
