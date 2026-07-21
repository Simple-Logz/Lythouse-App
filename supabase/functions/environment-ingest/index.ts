// LytHouse environment-ingest
//
// Receives read-only inventory pushed by the collector (POST) and serves the
// latest inventory back to the app (GET). The connection TOKEN is the
// capability: the collector presents it to push, the app presents it to read.
// This function uses the service role internally and NEVER returns anything
// outside the row matching the presented token, so one workspace can't read
// another's inventory.
//
// The function stores only infrastructure inventory (policy JSON, firewall
// rules, manifests) — never cloud credentials. The collector does not transmit
// credentials; it authenticates to the cloud locally and sends only results.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, apikey",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const MAX_COMPONENTS = 500;
const MAX_BYTES = 2_000_000; // cap a single push at ~2MB of inventory

// A collector token looks like lhc_xxxxxxxxxxxxxxxx — reject anything else.
const validToken = (t: unknown): t is string => typeof t === "string" && /^lhc_[a-z0-9]{8,64}$/i.test(t);

function admin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// Keep only the fields we need; clamp sizes so a bad push can't blow up storage.
function sanitize(components: unknown): { type: string; name: string; content: string; resourceId: string | null }[] {
  if (!Array.isArray(components)) return [];
  const ALLOWED = new Set(["kubernetes", "terraform", "container", "iam", "network", "api", "cicd", "server"]);
  const out: { type: string; name: string; content: string; resourceId: string | null }[] = [];
  let bytes = 0;
  for (const c of components) {
    if (!c || typeof c !== "object") continue;
    const type = ALLOWED.has((c as any).type) ? (c as any).type : "server";
    const name = String((c as any).name ?? "resource").slice(0, 200);
    const content = String((c as any).content ?? "");
    const resourceId = (c as any).resourceId ? String((c as any).resourceId).slice(0, 400) : null;
    bytes += content.length;
    if (bytes > MAX_BYTES) break;
    out.push({ type, name, content, resourceId });
    if (out.length >= MAX_COMPONENTS) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const db = admin();

    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      const token = body?.token;
      if (!validToken(token)) return json({ error: "invalid token" }, 400);
      const components = sanitize(body?.components);
      const provider = typeof body?.provider === "string" ? body.provider : "unknown";

      const { error } = await db.from("env_ingest").upsert({
        token,
        provider,
        components,
        synced_at: new Date().toISOString(),
      }, { onConflict: "token" });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, received: components.length });
    }

    if (req.method === "GET") {
      const token = new URL(req.url).searchParams.get("token");
      if (!validToken(token)) return json({ error: "invalid token" }, 400);
      const { data, error } = await db.from("env_ingest").select("components, synced_at").eq("token", token).maybeSingle();
      if (error) return json({ error: error.message }, 500);
      // No push yet → empty, honest response (app keeps the connection "awaiting").
      return json({ components: data?.components ?? [], syncedAt: data?.synced_at ? new Date(data.synced_at).getTime() : null });
    }

    return json({ error: "method not allowed" }, 405);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
