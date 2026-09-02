import { Sandbox } from '@vercel/sandbox';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL=process.env.VITE_SUPABASE_URL||'https://kqjyubxrbjyvakpvcymc.supabase.co';
const SUPABASE_ANON_KEY=process.env.VITE_SUPABASE_ANON_KEY||'';
const MAX_SCRIPT=50000;
const MAX_OUTPUT=120000;

function send(res:any,status:number,body:any){res.status(status).json(body)}
function commandFor(runtime:string,script:string){
 if(runtime==='python')return{cmd:'python3',args:['-c',script]};
 if(runtime==='shell')return{cmd:'bash',args:['-lc',script]};
 return{cmd:'node',args:['-e',script]};
}
function clip(v:string){return String(v||'').slice(0,MAX_OUTPUT)}

export default async function handler(req:any,res:any){
 if(req.method!=='POST')return send(res,405,{error:'Method not allowed'});
 const bearer=String(req.headers.authorization||'');
 if(!bearer.startsWith('Bearer ')||!SUPABASE_ANON_KEY)return send(res,401,{error:'Authentication required'});
 const {projectId,script,runtime='node',name='Test Lab run',allowedDomains=[]}=req.body||{};
 if(!projectId||!script)return send(res,400,{error:'Project and script are required'});
 if(typeof script!=='string'||script.length>MAX_SCRIPT)return send(res,400,{error:'Script exceeds the 50 KB execution limit'});
 if(!['node','python','shell'].includes(runtime))return send(res,400,{error:'Unsupported runtime'});
 const token=bearer.slice(7);
 const db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false}});
 const {data:{user},error:userError}=await db.auth.getUser(token);
 if(userError||!user)return send(res,401,{error:'Session expired'});
 const {data:project,error:projectError}=await db.from('projects').select('id,workspace_id,name').eq('id',projectId).single();
 if(projectError||!project)return send(res,404,{error:'Project not found or access denied'});
 const {data:testCase,error:testError}=await db.from('qa_test_cases').insert({workspace_id:project.workspace_id,project_id:project.id,name:String(name).slice(0,160),framework:runtime,test_type:'sandbox',source:'test_lab',script,status:'active',metadata:{allowed_domains:allowedDomains},created_by:user.id}).select('id').single();
 if(testError)return send(res,500,{error:'Could not persist test case',detail:testError.message});
 const started=new Date();
 const {data:run,error:runError}=await db.from('qa_test_runs').insert({workspace_id:project.workspace_id,project_id:project.id,test_case_id:testCase.id,status:'running',assertions_passed:0,assertions_failed:0,result:{runtime,phase:'provisioning'},started_at:started.toISOString(),created_by:user.id}).select('id').single();
 if(runError)return send(res,500,{error:'Could not create test run',detail:runError.message});
 let sandbox:any=null;
 try{
   const domains=Array.isArray(allowedDomains)?allowedDomains.map(String).filter(Boolean).slice(0,20):[];
   sandbox=await Sandbox.create({timeout:120000,resources:{vcpus:1},networkPolicy:{mode:'custom',allowedDomains:domains}} as any);
   const spec=commandFor(runtime,script);
   const execution=await sandbox.runCommand({cmd:spec.cmd,args:spec.args} as any);
   const stdout=clip(await execution.stdout());
   const stderr=clip(await execution.stderr());
   const exitCode=Number(execution.exitCode??1);
   const completed=new Date();
   const durationMs=completed.getTime()-started.getTime();
   const status=exitCode===0?'passed':'failed';
   const result={runtime,exit_code:exitCode,duration_ms:durationMs,sandbox_id:sandbox.sandboxId||sandbox.id||null,network_policy:domains.length?'restricted':'deny_all',allowed_domains:domains,evidence:{stdout_present:!!stdout,stderr_present:!!stderr}};
   await db.from('qa_test_runs').update({status,assertions_passed:exitCode===0?1:0,assertions_failed:exitCode===0?0:1,stdout,stderr,result,completed_at:completed.toISOString()}).eq('id',run.id);
   return send(res,200,{runId:run.id,testCaseId:testCase.id,status,exitCode,durationMs,stdout,stderr,result});
 }catch(e:any){
   const completed=new Date();const message=clip(e?.message||String(e));
   await db.from('qa_test_runs').update({status:'error',assertions_failed:1,stderr:message,result:{runtime,phase:'execution',error:message},completed_at:completed.toISOString()}).eq('id',run.id);
   return send(res,500,{runId:run.id,status:'error',error:'Sandbox execution failed',detail:message});
 }finally{if(sandbox)try{await sandbox.stop()}catch{}}
}
