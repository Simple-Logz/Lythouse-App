const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});

Deno.serve(async req=>{
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  const configured=Deno.env.get('LYTHOUSE_WORKER_SECRET')||'';
  const provided=req.headers.get('x-lythouse-worker-secret')||'';
  if(!configured||provided!==configured)return json({error:'Forbidden'},403);

  let validationId:string|undefined;
  try{({validationId}=await req.json())}catch{}
  if(!validationId)return json({error:'validationId required'},400);

  const url=Deno.env.get('SUPABASE_URL')!;
  const serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if(!url||!serviceRole)return json({error:'Worker backend is not configured'},503);

  // Internal bridge is deliberately the only place a service-role bearer is emitted.
  // ai-validation-review still performs validation lookup and plan entitlement checks.
  const response=await fetch(`${url}/functions/v1/ai-validation-review`,{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${serviceRole}`},
    body:JSON.stringify({validationId})
  });
  const text=await response.text();
  return new Response(text,{status:response.status,headers:{'Content-Type':response.headers.get('Content-Type')||'application/json'}});
});
