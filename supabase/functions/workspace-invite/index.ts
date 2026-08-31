import { createClient } from "npm:@supabase/supabase-js@2";

const appOrigin = Deno.env.get("APP_ORIGIN") || "https://lythouse.ai";
const corsHeaders = {
  "Access-Control-Allow-Origin": appOrigin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  "Vary": "Origin",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const assignableRoles = new Set(["admin", "developer", "approver", "viewer"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Invalid session" }, 401);

    const body = await req.json();
    const workspaceId = String(body.workspaceId || "");
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "viewer").toLowerCase();
    if (!workspaceId || !email || !email.includes("@")) return json({ error: "A valid workspace and email are required" }, 400);
    if (!assignableRoles.has(role)) return json({ error: "Invalid role" }, 400);

    const { data: actor } = await admin.from("workspace_members").select("role").eq("workspace_id", workspaceId).eq("user_id", user.id).maybeSingle();
    if (!actor || !["owner", "admin"].includes(actor.role)) return json({ error: "Only workspace owners and admins can invite members" }, 403);

    const { data: existingProfile } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
    if (existingProfile) {
      const { data: existingMember } = await admin.from("workspace_members").select("id").eq("workspace_id", workspaceId).eq("user_id", existingProfile.id).maybeSingle();
      if (existingMember) return json({ error: "This person is already a workspace member" }, 409);
    }

    const { data: pending } = await admin.from("workspace_invitations").select("id").eq("workspace_id", workspaceId).eq("email", email).eq("status", "pending").maybeSingle();
    if (pending) return json({ error: "A pending invitation already exists for this email" }, 409);

    const { data: invitation, error: inviteError } = await admin.from("workspace_invitations")
      .insert({ workspace_id: workspaceId, email, role, invited_by: user.id })
      .select("id,token,email,role,workspace_id,status,created_at")
      .single();
    if (inviteError || !invitation) return json({ error: inviteError?.message || "Could not create invitation" }, 400);

    const redirectTo = `${appOrigin}/invite/${encodeURIComponent(invitation.token)}`;
    const { error: emailError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { lythouse_workspace_id: workspaceId, lythouse_invitation_id: invitation.id },
    });

    if (emailError) {
      await admin.from("workspace_invitations").update({ status: "revoked" }).eq("id", invitation.id);
      console.error("Workspace invitation email failed", emailError);
      return json({ error: "Invitation email could not be sent" }, 502);
    }

    await admin.from("audit_events").insert({
      workspace_id: workspaceId,
      actor_id: user.id,
      action: "workspace.member_invited",
      entity_type: "workspace_invitation",
      entity_id: invitation.id,
      metadata: { email, role },
    }).then(() => undefined).catch(() => undefined);

    return json({ invitation: { id: invitation.id, email, role, status: invitation.status }, emailSent: true }, 201);
  } catch (error) {
    console.error("workspace-invite error", error);
    return json({ error: "Unable to create workspace invitation" }, 500);
  }
});
