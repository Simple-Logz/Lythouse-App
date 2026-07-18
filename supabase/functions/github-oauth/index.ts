import{serve}from'https://deno.land/std@0.168.0/http/server.ts';

// Exchanges a GitHub OAuth "code" (from the Login-with-GitHub redirect) for a
// user access token. The client secret stays here on the server and is never
// exposed to the browser.
//
// Required Supabase function secrets:
//   GITHUB_CLIENT_ID      — from your GitHub OAuth App
//   GITHUB_CLIENT_SECRET  — from your GitHub OAuth App
//
// Set them with:  supabase secrets set GITHUB_CLIENT_ID=... GITHUB_CLIENT_SECRET=...

const corsHeaders={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};

function json(body:unknown,status=200){
  return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
}

serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  try{
    const client_id=Deno.env.get('GITHUB_CLIENT_ID');
    const client_secret=Deno.env.get('GITHUB_CLIENT_SECRET');
    if(!client_id||!client_secret){
      return json({error:'GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.'},500);
    }
    const{code,redirect_uri}=await req.json();
    if(!code)return json({error:'Missing authorization code.'},400);

    const res=await fetch('https://github.com/login/oauth/access_token',{
      method:'POST',
      headers:{Accept:'application/json','Content-Type':'application/json'},
      body:JSON.stringify({client_id,client_secret,code,redirect_uri}),
    });
    const data=await res.json();
    if(data.error)return json({error:data.error_description||data.error},400);
    if(!data.access_token)return json({error:'GitHub did not return an access token.'},400);

    return json({access_token:data.access_token,scope:data.scope,token_type:data.token_type});
  }catch(e){
    return json({error:e instanceof Error?e.message:'Token exchange failed.'},500);
  }
});
