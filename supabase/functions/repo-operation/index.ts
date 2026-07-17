import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function parseGitUrl(url: string): { owner: string; repo: string } | null {
  const sshMatch = url.match(/git@(?:github\.com|gitlab\.com):([^/]+)\/(.+?)(?:\.git)?$/);
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };
  const httpsMatch = url.match(/(?:github\.com|gitlab\.com)[/:]([^/]+)\/(.+?)(?:\.git)?$/);
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] };
  return null;
}

function getApiBase(url: string): string {
  if (url.includes("gitlab.com")) return "https://gitlab.com/api/v4";
  return "https://api.github.com";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { operation, projectId, path: filePath, content, message, branch } = body;

    if (!operation || !projectId) {
      return new Response(JSON.stringify({ error: "operation and projectId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const { data: project } = await sb.from("projects").select("*").eq("id", projectId).single();
    if (!project) {
      return new Response(JSON.stringify({ error: "project not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = parseGitUrl(project.git_url);
    if (!parsed) {
      return new Response(JSON.stringify({ error: "Invalid git URL" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { owner, repo } = parsed;
    const token = project.github_token; // optional for public repos
    const ref = branch || project.git_branch;
    const apiBase = getApiBase(project.git_url);
    const isGitLab = apiBase.includes("gitlab");
    // Build headers — token is optional, public repos work without it
    const headers: Record<string, string> = isGitLab
      ? (token ? { "PRIVATE-TOKEN": token, "Content-Type": "application/json" } : { "Content-Type": "application/json" })
      : (token
          ? { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "User-Agent": "lythouse-app" }
          : { Accept: "application/vnd.github+json", "User-Agent": "lythouse-app" });

    if (operation === "list") {
      if (isGitLab) {
        const res = await fetch(apiBase + "/projects/" + encodeURIComponent(owner + "/" + repo) + "/repository/tree?recursive=true&ref=" + ref + "&per_page=100", { headers });
        if (!res.ok) return new Response(JSON.stringify({ error: "Failed to fetch tree" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const data = await res.json();
        const files = data.map((item: any) => ({ path: item.path, type: item.type === "tree" ? "dir" : "file", size: null }));
        return new Response(JSON.stringify({ files }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        const res = await fetch(apiBase + "/repos/" + owner + "/" + repo + "/git/trees/" + ref + "?recursive=1", { headers });
        if (!res.ok) return new Response(JSON.stringify({ error: "Failed to fetch tree" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const data = await res.json();
        const files = (data.tree || []).map((item: any) => ({ path: item.path, type: item.type === "tree" ? "dir" : "file", size: item.size ?? null }));
        return new Response(JSON.stringify({ files }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (operation === "read") {
      if (!filePath) return new Response(JSON.stringify({ error: "path required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (isGitLab) {
        const encodedPath = encodeURIComponent(filePath);
        const res = await fetch(apiBase + "/projects/" + encodeURIComponent(owner + "/" + repo) + "/repository/files/" + encodedPath + "/raw?ref=" + ref, { headers });
        if (!res.ok) return new Response(JSON.stringify({ error: "File not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const text = await res.text();
        return new Response(JSON.stringify({ content: text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        const res = await fetch(apiBase + "/repos/" + owner + "/" + repo + "/contents/" + filePath + "?ref=" + ref, { headers });
        if (!res.ok) return new Response(JSON.stringify({ error: "File not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const data = await res.json();
        let text = "";
        if (data.content) { text = atob(data.content.replace(/\n/g, "")); }
        return new Response(JSON.stringify({ content: text, sha: data.sha }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (operation === "write") {
      if (!filePath || content === undefined) return new Response(JSON.stringify({ error: "path and content required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const commitMessage = message || "Sandbox.ai: Update " + filePath;
      if (isGitLab) {
        const encodedPath = encodeURIComponent(filePath);
        const body = { branch: ref, content: btoa(content), commit_message: commitMessage, encoding: "base64" };
        const res = await fetch(apiBase + "/projects/" + encodeURIComponent(owner + "/" + repo) + "/repository/files/" + encodedPath, { method: "PUT", headers, body: JSON.stringify(body) });
        if (!res.ok) { const errText = await res.text(); return new Response(JSON.stringify({ error: "Failed to write file: " + errText }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        const res = await fetch(apiBase + "/repos/" + owner + "/" + repo + "/contents/" + filePath + "?ref=" + ref, { headers });
        let sha: string | undefined;
        if (res.ok) { const existing = await res.json(); sha = existing.sha; }
        const writeBody: Record<string, unknown> = { message: commitMessage, content: btoa(content), branch: ref };
        if (sha) writeBody.sha = sha;
        const writeRes = await fetch(apiBase + "/repos/" + owner + "/" + repo + "/contents/" + filePath, { method: "PUT", headers, body: JSON.stringify(writeBody) });
        if (!writeRes.ok) { const errText = await writeRes.text(); return new Response(JSON.stringify({ error: "Failed to write file: " + errText }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (operation === "delete") {
      if (!filePath) return new Response(JSON.stringify({ error: "path required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const commitMessage = message || "Sandbox.ai: Delete " + filePath;
      if (isGitLab) {
        const encodedPath = encodeURIComponent(filePath);
        const res = await fetch(apiBase + "/projects/" + encodeURIComponent(owner + "/" + repo) + "/repository/files/" + encodedPath, { method: "DELETE", headers, body: JSON.stringify({ branch: ref, commit_message: commitMessage }) });
        if (!res.ok) { const errText = await res.text(); return new Response(JSON.stringify({ error: "Failed to delete: " + errText }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        const res = await fetch(apiBase + "/repos/" + owner + "/" + repo + "/contents/" + filePath + "?ref=" + ref, { headers });
        if (!res.ok) return new Response(JSON.stringify({ error: "File not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const data = await res.json();
        const deleteRes = await fetch(apiBase + "/repos/" + owner + "/" + repo + "/contents/" + filePath, { method: "DELETE", headers, body: JSON.stringify({ message: commitMessage, sha: data.sha, branch: ref }) });
        if (!deleteRes.ok) { const errText = await deleteRes.text(); return new Response(JSON.stringify({ error: "Failed to delete: " + errText }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (operation === "mkdir") {
      if (!filePath) return new Response(JSON.stringify({ error: "path required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const keepPath = filePath.endsWith("/") ? filePath + ".gitkeep" : filePath + "/.gitkeep";
      const commitMessage = message || "Sandbox.ai: Create directory " + filePath;
      if (isGitLab) {
        const encodedPath = encodeURIComponent(keepPath);
        const body = { branch: ref, content: "", commit_message: commitMessage, encoding: "base64" };
        const res = await fetch(apiBase + "/projects/" + encodeURIComponent(owner + "/" + repo) + "/repository/files/" + encodedPath, { method: "POST", headers, body: JSON.stringify(body) });
        if (!res.ok) { const errText = await res.text(); return new Response(JSON.stringify({ error: "Failed to create directory: " + errText }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        const writeBody = { message: commitMessage, content: btoa(""), branch: ref };
        const writeRes = await fetch(apiBase + "/repos/" + owner + "/" + repo + "/contents/" + keepPath, { method: "PUT", headers, body: JSON.stringify(writeBody) });
        if (!writeRes.ok) { const errText = await writeRes.text(); return new Response(JSON.stringify({ error: "Failed to create directory: " + errText }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ error: "Unknown operation: " + operation }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("repo-operation error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
