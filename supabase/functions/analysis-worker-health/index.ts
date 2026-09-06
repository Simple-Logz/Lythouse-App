import { createClient } from "jsr:@supabase/supabase-js@2";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});

Deno.serve(async req=>{
  if(req.method!=='GET'&&req.method!=='POST')return json({error:'Method not allowed'},405);
  const configured=Deno.env.get('LYTHOUSE_WORKER_SECRET')||'';
  const provided=req.headers.get('x-lythouse-worker-secret')||'';
  if(!configured||provided!==configured)return json({error:'Forbidden'},403);

  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const now=new Date();
  const staleBefore=new Date(now.getTime()-20*60*1000).toISOString();
  const [{count:queued},{count:running},{count:failed},{count:stale}] = await Promise.all([
    db.from('analysis_jobs').select('id',{count:'exact',head:true}).eq('status','queued'),
    db.from('analysis_jobs').select('id',{count:'exact',head:true}).eq('status','running'),
    db.from('analysis_jobs').select('id',{count:'exact',head:true}).eq('status','failed'),
    db.from('analysis_jobs').select('id',{count:'exact',head:true}).eq('status','running').lt('leased_at',staleBefore)
  ]);
  const healthy=(stale||0)===0;
  return json({healthy,queue:{queued:queued||0,running:running||0,failed:failed||0,stale_leases:stale||0},checked_at:now.toISOString()},healthy?200:503);
});
