import{serve}from'https://deno.land/std@0.168.0/http/server.ts';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};

serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  try{
    const{source,config}=await req.json();
    let data:unknown;

    switch(source){

      case'netlify':{
        const h={'Authorization':`Bearer ${config.token}`,'Content-Type':'application/json'};
        const[sitesRes,userRes]=await Promise.all([
          fetch('https://api.netlify.com/api/v1/sites?per_page=20',{headers:h}),
          fetch('https://api.netlify.com/api/v1/user',{headers:h}),
        ]);
        if(!sitesRes.ok)return err(sitesRes.status===401?'Invalid Netlify token':'Netlify API error '+sitesRes.status);
        const sites=await sitesRes.json();
        const user=userRes.ok?await userRes.json():null;
        const sitesWithDeploys=await Promise.all(sites.slice(0,10).map(async(s:any)=>{
          const dr=await fetch(`https://api.netlify.com/api/v1/sites/${s.id}/deploys?per_page=3`,{headers:h});
          const deploys=dr.ok?await dr.json():[];
          return{id:s.id,name:s.name,url:s.ssl_url||s.url,state:s.published_deploy?.state||'unknown',
            lastDeploy:deploys[0]?{state:deploys[0].state,branch:deploys[0].branch,
              title:deploys[0].title||deploys[0].commit_ref?.slice(0,7)||'Manual deploy',
              createdAt:deploys[0].created_at,deployTime:deploys[0].deploy_time,
              errorMessage:deploys[0].error_message||null}:null,
            recentDeploys:deploys.slice(0,3).map((d:any)=>({state:d.state,branch:d.branch,
              title:d.title||d.commit_ref?.slice(0,7)||'Deploy',createdAt:d.created_at,deployTime:d.deploy_time}))};
        }));
        data={type:'netlify',
          user:{name:user?.full_name||user?.slug,email:user?.email,avatar:user?.avatar_url},
          totalSites:sites.length,sites:sitesWithDeploys,
          summary:{healthy:sitesWithDeploys.filter((s:any)=>s.state==='ready').length,
            building:sitesWithDeploys.filter((s:any)=>s.state==='building'||s.state==='enqueued').length,
            failed:sitesWithDeploys.filter((s:any)=>s.state==='error').length},
          fetchedAt:new Date().toISOString()};
        break;
      }

      case'github':case'github-actions':{
        const url=config.url||config.repo_url||'';
        const match=url.match(/github\.com\/([^/]+)\/([^/\s]+)/);
        if(!match)return err('Invalid GitHub repository URL');
        const[,owner,repo]=match;
        const repoName=repo.replace(/\.git$/,'');
        const h={'Authorization':`Bearer ${config.token}`,'Accept':'application/vnd.github+json','User-Agent':'lythouse-app'};
        const[repoRes,commitsRes,workflowsRes,prsRes]=await Promise.all([
          fetch(`https://api.github.com/repos/${owner}/${repoName}`,{headers:h}),
          fetch(`https://api.github.com/repos/${owner}/${repoName}/commits?per_page=5`,{headers:h}),
          fetch(`https://api.github.com/repos/${owner}/${repoName}/actions/runs?per_page=5`,{headers:h}),
          fetch(`https://api.github.com/repos/${owner}/${repoName}/pulls?state=open&per_page=5`,{headers:h}),
        ]);
        if(!repoRes.ok)return err(repoRes.status===401?'Invalid token':repoRes.status===404?'Repository not found':'GitHub error '+repoRes.status);
        const r=await repoRes.json();
        const commits=commitsRes.ok?await commitsRes.json():[];
        const wf=workflowsRes.ok?await workflowsRes.json():{workflow_runs:[]};
        const prs=prsRes.ok?await prsRes.json():[];
        data={type:'github',
          repo:{name:r.full_name,description:r.description,stars:r.stargazers_count,forks:r.forks_count,
            defaultBranch:r.default_branch,visibility:r.visibility,language:r.language,
            openIssues:r.open_issues_count,url:r.html_url,lastPush:r.pushed_at},
          recentCommits:commits.slice(0,5).map((c:any)=>({sha:c.sha?.slice(0,7),
            message:c.commit?.message?.split('\n')[0],author:c.commit?.author?.name,date:c.commit?.author?.date,url:c.html_url})),
          recentRuns:(wf.workflow_runs||[]).slice(0,5).map((r:any)=>({name:r.name,status:r.status,
            conclusion:r.conclusion,branch:r.head_branch,createdAt:r.created_at,url:r.html_url})),
          openPRs:prs.slice(0,5).map((p:any)=>({number:p.number,title:p.title,author:p.user?.login,
            branch:p.head?.ref,draft:p.draft,url:p.html_url})),
          fetchedAt:new Date().toISOString()};
        break;
      }

      case'vercel':{
        const h={'Authorization':`Bearer ${config.token}`};
        const teamParam=config.team_id?`?teamId=${config.team_id}`:'';
        const[userRes,projectsRes,deploysRes]=await Promise.all([
          fetch('https://api.vercel.com/v2/user',{headers:h}),
          fetch(`https://api.vercel.com/v9/projects${teamParam}`,{headers:h}),
          fetch(`https://api.vercel.com/v6/deployments${teamParam}&limit=10`,{headers:h}),
        ]);
        if(!userRes.ok)return err('Invalid Vercel token');
        const user=await userRes.json();
        const projects=projectsRes.ok?await projectsRes.json():{projects:[]};
        const deploys=deploysRes.ok?await deploysRes.json():{deployments:[]};
        data={type:'vercel',user:{name:user.user?.name||user.user?.username,email:user.user?.email},
          totalProjects:projects.projects?.length||0,
          projects:(projects.projects||[]).slice(0,10).map((p:any)=>({id:p.id,name:p.name,
            framework:p.framework,latestDeploy:p.latestDeployments?.[0]?.readyState,
            url:p.alias?.[0]?.domain?`https://${p.alias[0].domain}`:null,updatedAt:p.updatedAt})),
          recentDeploys:(deploys.deployments||[]).slice(0,8).map((d:any)=>({uid:d.uid,name:d.name,
            url:d.url?`https://${d.url}`:null,state:d.state,target:d.target,createdAt:d.createdAt,
            commit:d.meta?.githubCommitMessage||d.meta?.gitlabCommitMessage,
            branch:d.meta?.githubCommitRef||d.meta?.gitlabCommitRef})),
          fetchedAt:new Date().toISOString()};
        break;
      }

      case'gitlab':{
        const base=config.url?.includes('gitlab.com')?'https://gitlab.com':`https://${new URL(config.url||'https://gitlab.com').host}`;
        const h={'PRIVATE-TOKEN':config.token};
        const userRes=await fetch(`${base}/api/v4/user`,{headers:h});
        if(!userRes.ok)return err('Invalid GitLab token');
        const user=await userRes.json();
        const projectsRes=await fetch(`${base}/api/v4/projects?membership=true&per_page=10&order_by=last_activity_at`,{headers:h});
        const projects=projectsRes.ok?await projectsRes.json():[];
        const pipelines=projects[0]?(await fetch(`${base}/api/v4/projects/${projects[0].id}/pipelines?per_page=5`,{headers:h}).then(r=>r.ok?r.json():[])):[];
        data={type:'gitlab',user:{name:user.name,username:user.username,email:user.email},
          totalProjects:projects.length,
          projects:projects.slice(0,8).map((p:any)=>({id:p.id,name:p.name,url:p.web_url,visibility:p.visibility,lastActivity:p.last_activity_at})),
          recentPipelines:pipelines.slice(0,5).map((p:any)=>({id:p.id,status:p.status,ref:p.ref,createdAt:p.created_at,webUrl:p.web_url})),
          fetchedAt:new Date().toISOString()};
        break;
      }

      case'jira':{
        const creds=btoa(`${config.email}:${config.token}`);
        const base=config.url?.endsWith('/')?config.url.slice(0,-1):config.url;
        const h={'Authorization':`Basic ${creds}`,'Accept':'application/json'};
        const[userRes,projectsRes,issuesRes]=await Promise.all([
          fetch(`${base}/rest/api/3/myself`,{headers:h}),
          fetch(`${base}/rest/api/3/project/recent?maxResults=10`,{headers:h}),
          fetch(`${base}/rest/api/3/search?jql=assignee=currentUser() AND statusCategory!=Done&maxResults=5`,{headers:h}),
        ]);
        if(!userRes.ok)return err('Invalid Jira credentials');
        const user=await userRes.json();
        const projects=projectsRes.ok?await projectsRes.json():[];
        const issues=issuesRes.ok?await issuesRes.json():{issues:[]};
        data={type:'jira',user:{name:user.displayName,email:user.emailAddress},
          recentProjects:(Array.isArray(projects)?projects:projects.values||[]).slice(0,8).map((p:any)=>({key:p.key,name:p.name,type:p.projectTypeKey})),
          myOpenIssues:(issues.issues||[]).slice(0,5).map((i:any)=>({key:i.key,summary:i.fields?.summary,status:i.fields?.status?.name,priority:i.fields?.priority?.name})),
          fetchedAt:new Date().toISOString()};
        break;
      }

      case'datadog':{
        const h={'DD-API-KEY':config.api_key,'DD-APPLICATION-KEY':config.app_key};
        const site=config.site||'datadoghq.com';
        const[monitorsRes,incidentsRes]=await Promise.all([
          fetch(`https://api.${site}/api/v1/monitor?count=20`,{headers:h}),
          fetch(`https://api.${site}/api/v2/incidents?page[size]=5`,{headers:h}),
        ]);
        if(!monitorsRes.ok)return err('Invalid Datadog credentials');
        const monitors=await monitorsRes.json();
        const incidents=incidentsRes.ok?await incidentsRes.json():{data:[]};
        const mon=Array.isArray(monitors)?monitors:[];
        const alerting=mon.filter((m:any)=>m.overall_state==='Alert');
        data={type:'datadog',
          monitors:{total:mon.length,alerting:alerting.length,ok:mon.filter((m:any)=>m.overall_state==='OK').length,
            alertingMonitors:alerting.slice(0,5).map((m:any)=>({name:m.name,state:m.overall_state,type:m.type}))},
          incidents:{total:incidents.data?.length||0,
            active:(incidents.data||[]).slice(0,3).map((i:any)=>({title:i.attributes?.title,severity:i.attributes?.severity,status:i.attributes?.status}))},
          fetchedAt:new Date().toISOString()};
        break;
      }

      case'snyk':{
        const h={'Authorization':`token ${config.token}`};
        const[userRes,orgsRes]=await Promise.all([
          fetch('https://api.snyk.io/v1/user/me',{headers:h}),
          fetch('https://api.snyk.io/v1/orgs',{headers:h}),
        ]);
        if(!userRes.ok)return err('Invalid Snyk token');
        const user=await userRes.json();
        const orgs=orgsRes.ok?await orgsRes.json():{orgs:[]};
        const targetOrg=config.org_id||(orgs.orgs?.[0]?.id);
        let projects:any[]=[],vulnCount={critical:0,high:0};
        if(targetOrg){
          const projRes=await fetch(`https://api.snyk.io/v1/org/${targetOrg}/projects`,{headers:h});
          if(projRes.ok){const d=await projRes.json();projects=d.projects||[];}
          vulnCount.critical=projects.filter((p:any)=>p.issueCountsBySeverity?.critical>0).length;
          vulnCount.high=projects.filter((p:any)=>p.issueCountsBySeverity?.high>0).length;
        }
        data={type:'snyk',user:{name:user.name,email:user.email},
          orgs:(orgs.orgs||[]).slice(0,5).map((o:any)=>({id:o.id,name:o.name})),
          projects:{total:projects.length,withCritical:vulnCount.critical,withHigh:vulnCount.high,
            items:projects.slice(0,8).map((p:any)=>({name:p.name,type:p.type,
              critical:p.issueCountsBySeverity?.critical||0,high:p.issueCountsBySeverity?.high||0,
              medium:p.issueCountsBySeverity?.medium||0}))},
          fetchedAt:new Date().toISOString()};
        break;
      }

      case'pagerduty':{
        const h={'Authorization':`Token token=${config.token}`,'Accept':'application/vnd.pagerduty+json;version=2'};
        const[incRes,svcRes]=await Promise.all([
          fetch('https://api.pagerduty.com/incidents?statuses[]=triggered&statuses[]=acknowledged&limit=10',{headers:h}),
          fetch('https://api.pagerduty.com/services?limit=10',{headers:h}),
        ]);
        if(!incRes.ok)return err('Invalid PagerDuty token');
        const incidents=await incRes.json();
        const services=svcRes.ok?await svcRes.json():{services:[]};
        data={type:'pagerduty',
          incidents:{total:incidents.total||0,
            active:(incidents.incidents||[]).slice(0,5).map((i:any)=>({title:i.title,status:i.status,urgency:i.urgency,service:i.service?.summary,createdAt:i.created_at}))},
          services:{total:services.services?.length||0,
            items:(services.services||[]).slice(0,8).map((s:any)=>({name:s.name,status:s.status}))},
          fetchedAt:new Date().toISOString()};
        break;
      }

      default:return new Response(JSON.stringify({success:false,error:`Live data not yet available for ${source}`}),{status:404,headers:{...cors,'Content-Type':'application/json'}});
    }
    return new Response(JSON.stringify({success:true,data}),{headers:{...cors,'Content-Type':'application/json'}});
  }catch(e:any){
    return new Response(JSON.stringify({success:false,error:e.message}),{status:500,headers:{...cors,'Content-Type':'application/json'}});
  }
});
function err(msg:string){return new Response(JSON.stringify({success:false,error:msg}),{status:400,headers:{...cors,'Content-Type':'application/json'}});}
