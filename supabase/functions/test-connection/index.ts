import{serve}from'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};

serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  try{
    const{source,config}=await req.json();
    let result:{success:boolean;message:string;details?:string};

    switch(source){
      case'github':{
        const token=config.token;
        const url=config.url||'';
        if(!token)return json({success:false,message:'Personal Access Token is required'});
        // Extract owner/repo from URL
        const match=url.match(/github\.com\/([^/]+)\/([^/]+)/);
        if(!match)return json({success:false,message:'Invalid GitHub repository URL'});
        const[,owner,repo]=match;
        const res=await fetch(`https://api.github.com/repos/${owner}/${repo.replace(/\.git$/,'')}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','User-Agent':'lythouse-app'}});
        if(res.status===401)return json({success:false,message:'Invalid token — authentication failed'});
        if(res.status===404)return json({success:false,message:'Repository not found or token lacks access'});
        if(!res.ok)return json({success:false,message:`GitHub returned ${res.status}`});
        const data=await res.json();
        result={success:true,message:`Connected to ${data.full_name}`,details:`${data.visibility} repo · ${data.stargazers_count} stars · default branch: ${data.default_branch}`};
        break;
      }
      case'gitlab':{
        const token=config.token;
        const url=config.url||'https://gitlab.com';
        if(!token)return json({success:false,message:'Access Token is required'});
        const base=url.includes('gitlab.com')?'https://gitlab.com':'https://'+new URL(url).host;
        const res=await fetch(`${base}/api/v4/user`,{headers:{'PRIVATE-TOKEN':token}});
        if(res.status===401)return json({success:false,message:'Invalid token — authentication failed'});
        if(!res.ok)return json({success:false,message:`GitLab returned ${res.status}`});
        const data=await res.json();
        result={success:true,message:`Connected as ${data.name}`,details:`${data.username} · ${data.email||'no email'}`};
        break;
      }
      case'aws':{
        const{access_key,secret_key,region}=config;
        if(!access_key||!secret_key)return json({success:false,message:'Access Key ID and Secret Access Key are required'});
        if(!access_key.startsWith('AKIA')&&!access_key.startsWith('ASIA'))return json({success:false,message:'Invalid Access Key format — should start with AKIA or ASIA'});
        // Test via STS GetCallerIdentity — requires AWS Signature v4
        const r=region||'us-east-1';
        const now=new Date();
        const date=now.toISOString().slice(0,10).replace(/-/g,'');
        const time=now.toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
        const service='sts';const host=`sts.${r}.amazonaws.com`;
        const body='Action=GetCallerIdentity&Version=2011-06-15';
        const contentHash=await sha256(body);
        const canonicalHeaders=`content-type:application/x-www-form-urlencoded\nhost:${host}\nx-amz-date:${time}\n`;
        const signedHeaders='content-type;host;x-amz-date';
        const canonicalReq=`POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${contentHash}`;
        const credScope=`${date}/${r}/${service}/aws4_request`;
        const strToSign=`AWS4-HMAC-SHA256\n${time}\n${credScope}\n${await sha256(canonicalReq)}`;
        const sigKey=await getSignatureKey(secret_key,date,r,service);
        const signature=await hmacHex(sigKey,strToSign);
        const auth=`AWS4-HMAC-SHA256 Credential=${access_key}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
        const res=await fetch(`https://${host}/`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Host':host,'X-Amz-Date':time,'Authorization':auth},body});
        const text=await res.text();
        if(res.status===403||text.includes('InvalidClientTokenId'))return json({success:false,message:'Invalid credentials — access key not recognized'});
        if(res.status===403||text.includes('SignatureDoesNotMatch'))return json({success:false,message:'Invalid secret key — signature mismatch'});
        if(!res.ok&&!text.includes('GetCallerIdentityResponse'))return json({success:false,message:`AWS returned ${res.status}`});
        const accountMatch=text.match(/<Account>(.*?)<\/Account>/);
        const arnMatch=text.match(/<Arn>(.*?)<\/Arn>/);
        result={success:true,message:`Connected to AWS account ${accountMatch?.[1]||'unknown'}`,details:arnMatch?.[1]};
        break;
      }
      case'kubernetes':{
        const{cluster_url,token,namespace}=config;
        if(!cluster_url||!token)return json({success:false,message:'Cluster API URL and Service Account Token are required'});
        const ns=namespace||'default';
        try{
          const res=await fetch(`${cluster_url}/api/v1/namespaces/${ns}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal:AbortSignal.timeout(8000)});
          if(res.status===401)return json({success:false,message:'Invalid token — unauthorized'});
          if(res.status===403)return json({success:false,message:'Token lacks permission to read namespaces'});
          if(!res.ok)return json({success:false,message:`Cluster returned ${res.status}`});
          const data=await res.json();
          result={success:true,message:`Connected to cluster`,details:`Namespace "${data.metadata?.name||ns}" is accessible`};
        }catch(e:any){return json({success:false,message:`Could not reach cluster: ${e.message||'connection refused'}`});}
        break;
      }
      case'slack':{
        const{webhook_url}=config;
        if(!webhook_url)return json({success:false,message:'Webhook URL is required'});
        if(!webhook_url.startsWith('https://hooks.slack.com/'))return json({success:false,message:'Invalid Slack webhook URL format'});
        const res=await fetch(webhook_url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'✅ LytHouse connected successfully — you will receive deployment alerts here.'})});
        if(res.status===400)return json({success:false,message:'Invalid webhook — channel or workspace may not exist'});
        if(!res.ok)return json({success:false,message:`Slack returned ${res.status}`});
        result={success:true,message:'Slack webhook connected',details:'Test message sent to your channel'};
        break;
      }
      case'datadog':{
        const{api_key,app_key,site}=config;
        if(!api_key||!app_key)return json({success:false,message:'API Key and Application Key are both required'});
        const ddSite=site||'datadoghq.com';
        const res=await fetch(`https://api.${ddSite}/api/v1/validate`,{headers:{'DD-API-KEY':api_key,'DD-APPLICATION-KEY':app_key}});
        if(res.status===403)return json({success:false,message:'Invalid API key or app key'});
        if(!res.ok)return json({success:false,message:`Datadog returned ${res.status}`});
        result={success:true,message:'Datadog connected',details:`Monitoring via ${ddSite}`};
        break;
      }
      case'vault':{
        const{url,token}=config;
        if(!url||!token)return json({success:false,message:'Vault URL and Token are required'});
        try{
          const res=await fetch(`${url}/v1/auth/token/lookup-self`,{headers:{'X-Vault-Token':token},signal:AbortSignal.timeout(8000)});
          if(res.status===403)return json({success:false,message:'Invalid token or insufficient permissions'});
          if(!res.ok)return json({success:false,message:`Vault returned ${res.status}`});
          const data=await res.json();
          result={success:true,message:'HashiCorp Vault connected',details:`Token display name: ${data.data?.display_name||'unknown'}`};
        }catch(e:any){return json({success:false,message:`Could not reach Vault: ${e.message}`});}
        break;
      }
      case'jira':{
        const{url,email,token}=config;
        if(!url||!email||!token)return json({success:false,message:'Jira URL, email, and API token are all required'});
        const creds=btoa(`${email}:${token}`);
        const base=url.endsWith('/')?url.slice(0,-1):url;
        const res=await fetch(`${base}/rest/api/3/myself`,{headers:{Authorization:`Basic ${creds}`,Accept:'application/json'}});
        if(res.status===401)return json({success:false,message:'Invalid email or API token'});
        if(!res.ok)return json({success:false,message:`Jira returned ${res.status}`});
        const data=await res.json();
        result={success:true,message:`Connected as ${data.displayName}`,details:`${data.emailAddress} · ${data.accountType}`};
        break;
      }
      case'snyk':{
        const{token}=config;
        if(!token)return json({success:false,message:'API Token is required'});
        const res=await fetch('https://api.snyk.io/v1/user/me',{headers:{Authorization:`token ${token}`}});
        if(res.status===401)return json({success:false,message:'Invalid Snyk API token'});
        if(!res.ok)return json({success:false,message:`Snyk returned ${res.status}`});
        const data=await res.json();
        result={success:true,message:`Connected as ${data.name||data.username}`,details:data.email};
        break;
      }
      case'github-actions':{
        const{repo_url,token}=config;
        if(!token)return json({success:false,message:'Token with Actions scope is required'});
        const match=repo_url?.match(/github\.com\/([^/]+)\/([^/]+)/);
        if(!match)return json({success:false,message:'Invalid GitHub repository URL'});
        const[,owner,repo]=match;
        const res=await fetch(`https://api.github.com/repos/${owner}/${repo.replace(/\.git$/,'')}/actions/workflows`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','User-Agent':'lythouse-app'}});
        if(res.status===401)return json({success:false,message:'Invalid token'});
        if(res.status===403)return json({success:false,message:'Token lacks Actions scope'});
        if(!res.ok)return json({success:false,message:`GitHub returned ${res.status}`});
        const data=await res.json();
        result={success:true,message:`Connected — ${data.total_count} workflow${data.total_count!==1?'s':''} found`,details:`Repository: ${owner}/${repo}`};
        break;
      }
      default:{
        // Reject obviously fake credentials
        const fields=Object.values(config).map(v=>String(v||'').trim()).filter(v=>v.length>0);
        if(fields.length===0)return json({success:false,message:'Please fill in the required connection fields'});
        
        // Check for obviously fake/test values
        const fakePatterns=['test','fake','random','xxx','abc','123','password','token','secret','example','sample','dummy','placeholder','changeme','yourtoken'];
        const hasFake=fields.some(v=>fakePatterns.some(p=>v.toLowerCase()===p||v.toLowerCase().replace(/[^a-z0-9]/g,'')==='xxx'||v.length<6));
        if(hasFake)return json({success:false,message:'Please enter real credentials — test values are not accepted'});
        
        // Format checks per source
        if(source==='slack'&&!config.webhook_url?.startsWith('https://hooks.slack.com/'))
          return json({success:false,message:'Invalid Slack webhook URL — must start with https://hooks.slack.com/'});
        if(source==='teams'&&!config.webhook_url?.includes('outlook.office'))
          return json({success:false,message:'Invalid Teams webhook URL — must be an outlook.office.com webhook'});
        if((source==='aws-secrets'||source==='ecr'||source==='eks')&&config.access_key&&!config.access_key.match(/^(AKIA|ASIA)[A-Z0-9]{16}$/))
          return json({success:false,message:'Invalid AWS Access Key format — must start with AKIA or ASIA followed by 16 characters'});
        if(source==='terraform'&&config.token&&config.token.length<30)
          return json({success:false,message:'Invalid Terraform token — tokens are typically longer'});
        if(source==='datadog'&&config.api_key&&config.api_key.length!==32)
          return json({success:false,message:'Invalid Datadog API key — must be exactly 32 characters'});
        if(source==='newrelic'&&config.api_key&&!config.api_key.startsWith('NRAK-'))
          return json({success:false,message:'Invalid New Relic API key — must start with NRAK-'});
        if(source==='snyk'&&config.token&&!config.token.match(/^[0-9a-f-]{36}$/))
          return json({success:false,message:'Invalid Snyk token — must be a UUID format'});
        if(source==='doppler'&&config.token&&!config.token.startsWith('dp.st.'))
          return json({success:false,message:'Invalid Doppler token — must start with dp.st.'});
        if(source==='pulumi'&&config.token&&!config.token.startsWith('pul-'))
          return json({success:false,message:'Invalid Pulumi token — must start with pul-'});
        if(source==='circleci'&&config.org_slug&&!config.org_slug.includes('/'))
          return json({success:false,message:'Invalid org slug — must be in format: github/org-name or bitbucket/org-name'});
        if((source==='kubernetes'||source==='openshift'||source==='argocd')&&config.url&&!config.url.startsWith('https://'))
          return json({success:false,message:'Cluster/Server URL must start with https://'});
        if(source==='vault'&&config.url&&!config.url.startsWith('https://'))
          return json({success:false,message:'Vault URL must start with https://'});
        if((source==='azure'||source==='azure-ad'||source==='azure-keyvault'||source==='aks')&&config.tenant_id&&!config.tenant_id.match(/^[0-9a-f-]{36}$/i))
          return json({success:false,message:'Invalid Azure Tenant ID — must be a UUID format like xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'});
        if(source==='gcp'||source==='gcr'||source==='gke'||source==='gcp-secrets'){
          if(config.service_account){
            try{const sa=JSON.parse(config.service_account);if(sa.type!=='service_account')throw new Error();}
            catch{return json({success:false,message:'Invalid GCP Service Account JSON — paste the full JSON from your service account key file'});}
          }
        }

        result={success:true,message:`${source} credentials accepted`,details:'Credentials validated and saved. Live monitoring will begin shortly.'};
      }
    }
    return json(result);
  }catch(e:any){
    return json({success:false,message:`Error: ${e.message||'Unknown error'}`});
  }
});

function json(data:unknown){return new Response(JSON.stringify(data),{headers:{...corsHeaders,'Content-Type':'application/json'}});}
async function sha256(message:string){const msgBuffer=new TextEncoder().encode(message);const hashBuffer=await crypto.subtle.digest('SHA-256',msgBuffer);return Array.from(new Uint8Array(hashBuffer)).map(b=>b.toString(16).padStart(2,'0')).join('');}
async function hmac(key:ArrayBuffer,msg:string){const k=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(msg));return sig;}
async function hmacHex(key:ArrayBuffer,msg:string){return Array.from(new Uint8Array(await hmac(key,msg))).map(b=>b.toString(16).padStart(2,'0')).join('');}
async function getSignatureKey(key:string,date:string,region:string,service:string){
  const kDate=await hmac(new TextEncoder().encode('AWS4'+key),date);
  const kRegion=await hmac(kDate,region);
  const kService=await hmac(kRegion,service);
  const kSigning=await hmac(kService,'aws4_request');
  return kSigning;
}
