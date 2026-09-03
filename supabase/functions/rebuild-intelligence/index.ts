import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const DOMAINS = ["Code", "Infrastructure", "DevOps", "QA", "Cost", "Dependencies", "Vendor Intelligence"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await db.auth.getUser(token);
    if (!user) return json({ error: "Invalid or expired session" }, 401);
    const { projectId } = await req.json();
    if (!projectId) return json({ error: "Project is required" }, 400);
    const { data: p } = await db.from("projects").select("id,workspace_id,git_url").eq("id", projectId).single();
    if (!p?.git_url) return json({ error: "Connected repository required" }, 400);
    const { data: member } = await db.from("workspace_members").select("id").eq("workspace_id", p.workspace_id).eq("user_id", user.id).maybeSingle();
    if (!member) return json({ error: "Forbidden" }, 403);

    const { data: active } = await db.from("validations").select("id,status,created_at").eq("project_id", projectId).eq("trigger", "intelligence").in("status", ["pending", "running"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    let validation = active;
    if (!validation) {
      const { data: v, error } = await db.from("validations").insert({ project_id: projectId, workspace_id: p.workspace_id, status: "pending", trigger: "intelligence", created_by: user.id }).select("id,status,created_at").single();
      if (error) return json({ error: error.message }, 409);
      validation = v;
    }

    let { data: run } = await db.from("analysis_runs").select("id").eq("validation_id", validation.id).maybeSingle();
    if (!run) {
      const { data: r, error } = await db.from("analysis_runs").insert({ workspace_id: p.workspace_id, project_id: projectId, validation_id: validation.id, mode: "smart", depth: "deep", domains: DOMAINS, status: "running", config: { source: "rebuild_intelligence", purpose: "application_intelligence" }, created_by: user.id }).select("id").single();
      if (error) return json({ error: error.message }, 400);
      run = r;
    } else {
      await db.from("analysis_runs").update({ status: "running", completed_at: null }).eq("id", run.id);
    }

    const response = await fetch(`${url}/functions/v1/process-validation`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: auth, apikey: Deno.env.get("SUPABASE_ANON_KEY") || "" }, body: JSON.stringify({ validationId: validation.id }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return json({ error: body.error || `Intelligence processor returned ${response.status}`, validationId: validation.id }, response.status);
    return json({ ...body, validationId: validation.id, reused: !!active });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Intelligence rebuild failed" }, 500);
  }
});
