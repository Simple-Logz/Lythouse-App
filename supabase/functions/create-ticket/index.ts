import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Real ticket creation against each tool's API (server-side, no browser CORS).
// Body: { provider, config, ticket:{ title, body, assignee? } }
// Returns { url } on success.

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { provider, config = {}, ticket = {} } = await req.json();
    if (!ticket.title) return json({ error: 'Ticket title is required.' }, 400);

    if (provider === 'jira') {
      const { site, email, token, projectKey, issueType = 'Task', assigneeAccountId } = config;
      if (!site || !email || !token || !projectKey) return json({ error: 'Jira needs site, email, API token and project key.' }, 400);
      const auth = btoa(`${email}:${token}`);
      const res = await fetch(`${site.replace(/\/$/, '')}/rest/api/3/issue`, {
        method: 'POST', headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ fields: { project: { key: projectKey }, summary: ticket.title, issuetype: { name: issueType }, description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: ticket.body || '' }] }] }, ...(assigneeAccountId ? { assignee: { id: assigneeAccountId } } : {}) } }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return json({ error: d.errorMessages?.join(', ') || JSON.stringify(d.errors || d) }, 400);
      return json({ url: `${site.replace(/\/$/, '')}/browse/${d.key}`, id: d.key });
    }

    if (provider === 'linear') {
      const { apiKey, teamId } = config;
      if (!apiKey || !teamId) return json({ error: 'Linear needs an API key and team ID.' }, 400);
      const q = `mutation($t:String!,$d:String,$team:String!){issueCreate(input:{title:$t,description:$d,teamId:$team}){issue{url identifier}}}`;
      const res = await fetch('https://api.linear.app/graphql', { method: 'POST', headers: { Authorization: apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, variables: { t: ticket.title, d: ticket.body || '', team: teamId } }) });
      const d = await res.json().catch(() => ({}));
      if (d.errors) return json({ error: d.errors[0]?.message || 'Linear error' }, 400);
      return json({ url: d.data?.issueCreate?.issue?.url, id: d.data?.issueCreate?.issue?.identifier });
    }

    if (provider === 'servicenow') {
      const { instance, user, password } = config;
      if (!instance || !user || !password) return json({ error: 'ServiceNow needs an instance URL, user and password.' }, 400);
      const auth = btoa(`${user}:${password}`);
      const res = await fetch(`${instance.replace(/\/$/, '')}/api/now/table/incident`, { method: 'POST', headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ short_description: ticket.title, description: ticket.body || '' }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return json({ error: JSON.stringify(d) }, 400);
      return json({ url: `${instance.replace(/\/$/, '')}/nav_to.do?uri=incident.do?sys_id=${d.result?.sys_id}`, id: d.result?.number });
    }

    if (provider === 'slack') {
      const { webhook } = config;
      if (!webhook) return json({ error: 'Slack needs an incoming webhook URL.' }, 400);
      const res = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: `:rotating_light: *${ticket.title}*\n${ticket.body || ''}` }) });
      if (!res.ok) return json({ error: 'Slack webhook rejected the message.' }, 400);
      return json({ url: null, id: 'posted' });
    }

    if (provider === 'msteams') {
      const { webhook } = config;
      if (!webhook) return json({ error: 'Teams needs an incoming webhook URL.' }, 400);
      const res = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: ticket.title, text: (ticket.body || '').replace(/\n/g, '<br/>') }) });
      if (!res.ok) return json({ error: 'Teams webhook rejected the message.' }, 400);
      return json({ url: null, id: 'posted' });
    }

    if (provider === 'azureboards') {
      const { orgUrl, project: proj, pat } = config;
      if (!orgUrl || !proj || !pat) return json({ error: 'Azure Boards needs org URL, project and PAT.' }, 400);
      const auth = btoa(':' + pat);
      const res = await fetch(`${orgUrl.replace(/\/$/, '')}/${encodeURIComponent(proj)}/_apis/wit/workitems/$Issue?api-version=7.0`, {
        method: 'POST', headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/json-patch+json' },
        body: JSON.stringify([{ op: 'add', path: '/fields/System.Title', value: ticket.title }, { op: 'add', path: '/fields/System.Description', value: (ticket.body || '').replace(/\n/g, '<br/>') }]),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return json({ error: d.message || `Azure returned ${res.status}` }, 400);
      return json({ url: d._links?.html?.href || `${orgUrl}/${proj}/_workitems/edit/${d.id}`, id: d.id });
    }

    if (provider === 'github') {
      const { token, owner, repo } = config;
      if (!token || !owner || !repo) return json({ error: 'GitHub Issues needs a token (repo scope); owner/repo come from the project.' }, 400);
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, { method: 'POST', headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'lythouse' }, body: JSON.stringify({ title: ticket.title, body: ticket.body || '' }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return json({ error: d.message || `GitHub returned ${res.status}` }, 400);
      return json({ url: d.html_url, id: `#${d.number}` });
    }

    return json({ error: 'Unknown provider.' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Ticket creation failed.' }, 500);
  }
});
