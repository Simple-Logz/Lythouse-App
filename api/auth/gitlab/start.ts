import crypto from 'node:crypto';
const APP='https://sandbox-ai-app-eight.vercel.app';
function cookie(name:string,value:string,maxAge=600){return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`}
export default async function handler(req:any,res:any){
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const clientId=process.env.GITLAB_CLIENT_ID;
  const redirectUri=process.env.GITLAB_REDIRECT_URI||`${APP}/api/auth/gitlab/callback`;
  if(!clientId)return res.status(503).json({error:'GitLab OAuth is not configured. Add GITLAB_CLIENT_ID to the server environment.'});
  const state=crypto.randomBytes(32).toString('hex');
  res.setHeader('Set-Cookie',cookie('lythouse_gitlab_oauth_state',state));
  const p=new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:'code',state,scope:'read_user read_api read_repository'});
  res.redirect(302,`https://gitlab.com/oauth/authorize?${p.toString()}`);
}
