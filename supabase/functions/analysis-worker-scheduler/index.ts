import { createClient } from "jsr:@supabase/supabase-js@2";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});

Deno.serve(async req=>{
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  const configured=Deno.env.get('LYTHOUSE_WORKER_SECRET')||'';
  const provided=req.headers.get('x-lythouse-worker-secret')||'';
  if(!configured||provided!==configured)return json({error:'Forbidden'},403);

  const url=Deno.env.get('SUPABASE_URL')!;
  const db=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const {data:reconciled,error:reconcileError}=await db.rpc('reconcile_stale_analysis_jobs');
  if(reconcileError)return json({error:`Queue reconciliation failed: ${reconcileError.message}`},500);

  const now=new Date().toISOString();
  const {data:ready,error}=await db.from('analysis_jobs')
    .select('id')
    .eq('status','queued')
    .lte('available_at',now)
    .limit(25);
  if(error)return json({error:error.message},500);
  if(!ready?.length)return json({success:true,reconciled:reconciled||0,ready:0,dispatched:0});

  const dispatches=ready.slice(0,10).map(()=>fetch(`${url}/functions/v1/analysis-worker`,{
    method:'POST',
    headers:{'Content-Type':'application/json','x-lythouse-worker-secret':configured},
    body:'{}'
  }).then(r=>r.ok).catch(()=>false));
  const results=await Promise.all(dispatches);
  return json({success:true,reconciled:reconciled||0,ready:ready.length,dispatched:results.filter(Boolean).length});
});
