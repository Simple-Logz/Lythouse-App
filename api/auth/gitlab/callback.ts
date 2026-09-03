const APP='https://sandbox-ai-app-eight.vercel.app';
function cookies(req:any){return Object.fromEntries(String(req.headers.cookie||'').split(';').map((x:string)=>x.trim().split('=').map(decodeURIComponent)).filter((x:any[])=>x.length===2))}
export default async function handler(req:any,res:any){
 if(req.method!=='GET')return res.status(405).send('Method not allowed');
 const code=String(req.query.code||''),state=String(req.query.state||''),err=String(req.query.error||'');
 if(err)return res.redirect(302,`${APP}/integrations?gitlab=error&reason=${encodeURIComponent(err)}`);
 const expected=cookies(req).lythouse_gitlab_oauth_state;
 if(!code||!state||!expected||state!==expected)return res.redirect(302,`${APP}/integrations?gitlab=error&reason=invalid_state`);
 const clientId=process.env.GITLAB_CLIENT_ID,clientSecret=process.env.GITLAB_CLIENT_SECRET,redirectUri=process.env.GITLAB_REDIRECT_URI||`${APP}/api/auth/gitlab/callback`;
 if(!clientId||!clientSecret)return res.redirect(302,`${APP}/integrations?gitlab=error&reason=server_not_configured`);
 try{
  const body=new URLSearchParams({client_id:clientId,client_secret:clientSecret,code,grant_type:'authorization_code',redirect_uri:redirectUri});
  const tokenRes=await fetch('https://gitlab.com/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  const token:any=await tokenRes.json();if(!tokenRes.ok||!token.access_token)throw new Error(token.error_description||token.error||'token_exchange_failed');
  const userRes=await fetch('https://gitlab.com/api/v4/user',{headers:{Authorization:`Bearer ${token.access_token}`}});const user:any=await userRes.json();if(!userRes.ok)throw new Error('gitlab_user_lookup_failed');
  const payload=Buffer.from(JSON.stringify({access_token:token.access_token,refresh_token:token.refresh_token,expires_in:token.expires_in,created_at:token.created_at,user:{id:user.id,username:user.username,name:user.name,avatar_url:user.avatar_url}})).toString('base64url');
  res.setHeader('Set-Cookie',[`lythouse_gitlab_oauth=${payload}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,`lythouse_gitlab_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`]);
  return res.redirect(302,`${APP}/integrations?gitlab=connected`);
 }catch(e:any){return res.redirect(302,`${APP}/integrations?gitlab=error&reason=${encodeURIComponent(e?.message||'oauth_failed')}`)}
}
