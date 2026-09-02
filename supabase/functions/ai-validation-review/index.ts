import Anthropic from "npm:@anthropic-ai/sdk@0.27.3";
import { createClient } from "npm:@supabase/supabase-js@2";
import jwt from 'npm:jsonwebtoken@9.0.2';
const origin=Deno.env.get('APP_ORIGIN')||'https://sandbox-ai-app-eight.vercel.app';
const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-Client-Info, Apikey'};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'Content-Type':'application/json'}});
const SYSTEM=`You are LytHouse Intelligence, a pre-deployment engineering investigator. Your job is not to decorate scanner output. Your job is to reason across VERIFIED repository evidence, dependency/vendor intelligence and deterministic findings to expose consequential things an engineering team may miss before production.

ACCURACY CONTRACT:
- Never invent a file, line, dependency, version, CVE, vendor statement, EOL date, metric, cost number, capacity limit, exploit, architecture component or compatibility claim.
- Treat deterministic findings, repository manifests and fetched external records as VERIFIED EVIDENCE. Treat your cross-evidence reasoning as INFERENCE.
- Every inference must identify its evidence basis and confidence 0-100.
- External claims must cite one of the supplied source URLs. Never fabricate a URL.
- If runtime telemetry or cloud billing is absent, do NOT pretend to know memory sizing, traffic capacity or savings. Explain exactly what telemetry is required to calculate it.
- Distinguish PASS, RISK, OPPORTUNITY, NEEDS_INVESTIGATION and NOT_EVALUATED.
- Prefer application-specific consequences over generic best-practice prose.
- Look for cross-domain interactions: code↔database, auth↔data, dependency↔runtime, CI/CD↔permissions, network↔service, retry↔failure amplification, version↔vendor lifecycle, architecture↔scalability.
- The deterministic release verdict remains authoritative unless a separately verified blocker exists.
Return strict JSON only.`;
function appJwt(){const appId=Deno.env.get('GITHUB_APP_ID'),key=(Deno.env.get('GITHUB_APP_PRIVATE_KEY')||'').replace(/\\n/g,'\n');if(!appId||!key)return null;const now=Math.floor(Date.now()/1000);return jwt.sign({iat:now-60,exp:now+540,iss:appId},key,{algorithm:'RS256'})}
async function installationToken(id:any){if(!id)return null;const aj=appJwt();if(!aj)return null;try{const r=await fetch(`https://api.github.com/app/installations/${id}/access_tokens`,{method:'POST',headers:{Authorization:`Bearer ${aj}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'LytHouse-Intelligence'}});const b=await r.json();return r.ok?b.token:null}catch{return null}}
function repoParts(u:string){const m=(u||'').match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?$/);return m?{owner:m[1],repo:m[2]}:null}
async function ghText(owner:string,repo:string,path:string,branch:string,token:string|null){try{const r=await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`,{headers:{Accept:'application/vnd.github.raw+json','User-Agent':'LytHouse-Intelligence',...(token?{Authorization:`Bearer ${token}`}:{})}});return r.ok?await r.text():null}catch{return null}}
async function npmFact(name:string,current:string){try{const r=await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`,{headers:{Accept:'application/json'}});if(!r.ok)return null;const b=await r.json(),latest=b?.['dist-tags']?.latest,cur=b?.versions?.[current];return{name,current_version:current,latest_version:latest||null,deprecated:cur?.deprecated||null,engines:cur?.engines||null,license:cur?.license||b?.license||null,source_url:`https://www.npmjs.com/package/${name}`}}catch{return null}}
async function osvFact(name:string,version:string){try{const r=await fetch('https://api.osv.dev/v1/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({package:{name,ecosystem:'npm'},version})});if(!r.ok)return null;const b=await r.json();return(b.vulns||[]).slice(0,10).map((v:any)=>({id:v.id,summary:v.summary||null,modified:v.modified||null,aliases:v.aliases||[],source_url:`https://osv.dev/vulnerability/${v.id}`}))}catch{return null}}
async function nodeLifecycle(){try{const r=await fetch('https://raw.githubusercontent.com/nodejs/Release/main/schedule.json');if(!r.ok)return null;return{schedule:await r.json(),source_url:'https://github.com/nodejs/Release#release-schedule'}}catch{return null}}
function cleanVersion(v:any){if(typeof v!=='string')return null;const m=v.match(/(\d+\.\d+\.\d+)/);return m?m[1]:null}
async function researchRepository(p:any){const rp=repoParts(p?.git_url||'');if(!rp)return{manifests:[],dependencies:[],vendor_intelligence:[],vulnerabilities:[],runtime_lifecycle:[],evidence_gaps:['Repository provider is not currently supported by the research agent.']};const token=await installationToken(p.github_installation_id)||p.github_token||null,branch=p.git_branch||'main';const pkgText=await ghText(rp.owner,rp.repo,'package.json',branch,token);const manifests:any[]=[],dependencies:any[]=[],vendor:any[]=[],vulns:any[]=[],runtime:any[]=[];if(pkgText){try{const pkg=JSON.parse(pkgText);manifests.push({path:'package.json',name:pkg.name||null,engines:pkg.engines||null,scripts:Object.keys(pkg.scripts||{}),source_url:`https://github.com/${rp.owner}/${rp.repo}/blob/${branch}/package.json`});const deps={...(pkg.dependencies||{}),...(pkg.devDependencies||{})};for(const[name,raw]of Object.entries(deps).slice(0,80)){const version=cleanVersion(raw);dependencies.push({name,declared:String(raw),resolved_for_research:version});if(version){const[n,o]=await Promise.all([npmFact(name,version),osvFact(name,version)]);if(n&&(n.deprecated||n.latest_version!==version))vendor.push(n);if(o?.length)vulns.push({package:name,version,vulnerabilities:o})}}if(pkg.engines?.node){const lc=await nodeLifecycle();if(lc)runtime.push({runtime:'node',declared:String(pkg.engines.node),...lc})}}catch{manifests.push({path:'package.json',parse_error:true})}}
 const docker=await ghText(rp.owner,rp.repo,'Dockerfile',branch,token);if(docker){const from=[...docker.matchAll(/^FROM\s+([^\s]+)/gmi)].map(x=>x[1]);manifests.push({path:'Dockerfile',base_images:from,source_url:`https://github.com/${rp.owner}/${rp.repo}/blob/${branch}/Dockerfile`})}
 return{repository:`${rp.owner}/${rp.repo}`,branch,manifests,dependencies,vendor_intelligence:vendor.slice(0,40),vulnerabilities:vulns.slice(0,30),runtime_lifecycle:runtime,evidence_gaps:[...(pkgText?[]:['Root package.json was not available; dependency research may be incomplete.']),'Runtime/cloud telemetry and billing are not part of repository evidence unless separately connected.']}}
Deno.serve(async(req:Request)=>{if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});if(req.method!=='POST')return json({error:'Method not allowed'},405);try{
 const auth=req.headers.get('Authorization')||'',token=auth.replace(/^Bearer\s+/i,'');if(!token)return json({error:'Authentication required'},401);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);const{data:{user}}=await db.auth.getUser(token);if(!user)return json({error:'Invalid session'},401);
 const{validationId}=await req.json();if(!validationId)return json({error:'validationId required'},400);
 const{data:v}=await db.from('validations').select('id,workspace_id,project_id,risk_score,severity,summary,status,total_findings,critical_count,high_count,medium_count,low_count').eq('id',validationId).maybeSingle();if(!v)return json({error:'Validation not found'},404);
 const{data:m}=await db.from('workspace_members').select('id').eq('workspace_id',v.workspace_id).eq('user_id',user.id).maybeSingle();if(!m)return json({error:'Forbidden'},403);
 const{data:entitled}=await db.rpc('workspace_has_feature',{p_workspace:v.workspace_id,p_feature:'ai_analysis'});if(entitled===false)return json({error:'AI analysis is not included in this plan'},403);
 const{data:p}=await db.from('projects').select('id,name,description,git_url,git_branch,language,framework,github_installation_id,github_token').eq('id',v.project_id).single();
 const{data:f}=await db.from('findings').select('id,severity,category,title,description,file_path,line,recommendation,confidence,status').eq('validation_id',validationId).limit(200);
 const{data:steps}=await db.from('validation_steps').select('key,name,status,detail').eq('validation_id',validationId).order('step_index');
 const research=await researchRepository(p);
 const key=Deno.env.get('ANTHROPIC_API_KEY');if(!key)return json({error:'AI service is not configured'},503);
 const evidence={project:{id:p.id,name:p.name,description:p.description,git_url:p.git_url,git_branch:p.git_branch,language:p.language,framework:p.framework},validation:v,analysis_steps:steps||[],verified_findings:f||[],repository_research:research};
 const prompt=`Investigate this application's pre-deployment evidence. Think like a principal engineer, security architect, SRE, FinOps engineer and CTO reviewing the same release. Find the highest-value conclusions supported by the evidence, especially conclusions created by COMBINING evidence that a single-purpose scanner might miss.

Return JSON with exactly these top-level keys:
executive_summary: specific assessment in plain English;
release_assessment: {decision,reason,confidence};
application_understanding: {observed_stack:[],observed_delivery:[],observed_dependencies:[],evidence_gaps:[]};
priorities: [{finding_ids:[],title,why_it_matters,production_impact,business_impact,recommended_action,verification,confidence,evidence_urls:[]}];
cross_domain_insights: [{title,domains:[],observation,evidence_basis:[],what_humans_may_miss,action,confidence,evidence_urls:[]}];
vendor_intelligence: [{technology,current_version,status,advisory,impact,action,confidence,evidence_urls:[]}];
security_intelligence: [{title,risk,evidence_basis:[],action,confidence,evidence_urls:[]}];
reliability_scalability: [{title,observation,production_scenario,required_telemetry:[],action,confidence}];
cost_intelligence: [{title,observation,what_can_be_proven,required_telemetry:[],action,confidence}];
future_risks: [{title,time_horizon,trigger,impact,action,confidence,evidence_urls:[]}];
needs_investigation: [{question,why_it_matters,required_evidence:[]}];
confidence_notes: [];

Do not fill sections just to fill them. Empty arrays are better than generic advice. Vendor/EOL/security claims require supplied external evidence URLs. Cost/capacity claims without telemetry must be framed as what to measure, not fabricated savings. Evidence:\n${JSON.stringify(evidence)}`;
 const client=new Anthropic({apiKey:key});const r=await client.messages.create({model:'claude-sonnet-4-6',max_tokens:6500,temperature:0,system:SYSTEM,messages:[{role:'user',content:prompt}]});
 const text=r.content.filter(x=>x.type==='text').map((x:any)=>x.text).join('');let review:any;try{review=JSON.parse(text.replace(/^```json\s*|\s*```$/g,''))}catch{return json({error:'AI returned invalid structured output'},502)}
 review._intelligence_metadata={research_mode:'active_repository_and_vendor_research',repository_dependencies_examined:research.dependencies.length,vendor_records:research.vendor_intelligence.length,vulnerability_packages:research.vulnerabilities.length,generated_at:new Date().toISOString()};
 await db.from('ai_insights').insert({workspace_id:v.workspace_id,project_id:v.project_id,validation_id:v.id,type:'validation_review',title:'LytHouse application intelligence investigation',content:review,confidence:review?.release_assessment?.confidence??null,created_by:user.id});
 await db.from('usage_events').insert({workspace_id:v.workspace_id,user_id:user.id,project_id:v.project_id,event_type:'ai.validation_review',quantity:1,metadata:{validation_id:v.id,mode:'active_intelligence_research',dependencies_examined:research.dependencies.length,vendor_records:research.vendor_intelligence.length,vulnerability_packages:research.vulnerabilities.length}});
 return json({success:true,review,research_summary:{dependencies_examined:research.dependencies.length,vendor_records:research.vendor_intelligence.length,vulnerability_packages:research.vulnerabilities.length}});
}catch(e){console.error(e);return json({error:e instanceof Error?e.message:'AI review failed'},500)}});
