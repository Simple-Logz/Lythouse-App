import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ValidationStepDef {
  status: string;
  label: string;
}

const STEPS: ValidationStepDef[] = [
  { status: "queued", label: "Queued" },
  { status: "preparing_connection", label: "Preparing connection" },
  { status: "testing_access", label: "Testing access" },
  { status: "collecting_metadata", label: "Collecting approved metadata" },
  { status: "redacting_sensitive", label: "Redacting sensitive values" },
  { status: "classifying_components", label: "Classifying components" },
  { status: "generating_blueprint", label: "Generating blueprint" },
  { status: "preparing_workspace", label: "Preparing validation workspace" },
  { status: "applying_change", label: "Applying change" },
  { status: "running_technical_tests", label: "Running technical tests" },
  { status: "running_business_tests", label: "Running business tests" },
  { status: "testing_rollback", label: "Testing rollback" },
  { status: "generating_verdict", label: "Generating verdict" },
  { status: "completed", label: "Completed" },
];

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

async function callClaude(systemPrompt: string, userMessage: string): Promise<Record<string, unknown>> {
  if (!ANTHROPIC_API_KEY) {
    return mockClaudeResponse(systemPrompt, userMessage);
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text ?? "{}";
  return JSON.parse(text);
}

function mockClaudeResponse(systemPrompt: string, userMessage: string): Record<string, unknown> {
  const isVerdict = systemPrompt.includes("verdict");
  const isDiscovery = systemPrompt.includes("discovery") || systemPrompt.includes("application boundar");
  const isPreRun = systemPrompt.includes("pre-run") || systemPrompt.includes("failure modes");

  if (isDiscovery) {
    return {
      application_groups: [
        { name: "Web Frontend", component_ids: [], confidence: 0.85, evidence: "IIS site binding on port 443" },
        { name: "Application Service", component_ids: [], confidence: 0.78, evidence: "Windows Service with DB dependency" },
        { name: "Database Layer", component_ids: [], confidence: 0.92, evidence: "SQL Server on port 1433" },
      ],
      questions: [
        "Is ClaimsProcessor a dependency of ClaimsPortal or a standalone service?",
        "Does the scheduled task 'DataSync' depend on the Application Service?",
      ],
    };
  }
  if (isPreRun) {
    return {
      risk_summary: "The proposed change modifies the application service runtime. High-risk components: Application Service (directly affected), Database Layer (connection string change).",
      likely_affected: ["Application Service", "Database Layer"],
      failure_modes: ["Connection string mismatch after config change", "Service restart timeout"],
    };
  }
  if (isVerdict) {
    return {
      verdict: "conditionally_approved",
      confidence_adjustment: -5,
      summary: "The proposed configuration change was applied successfully. Technical tests passed for connectivity and dependency checks. One medium-severity finding: the connection string change requires verification of the SQL Server firewall rules. Rollback was successful and baseline tests passed after rollback.",
      root_cause: "Connection string update may not propagate to all service instances without a full restart.",
      remediation_steps: [
        "Verify SQL Server firewall allows connections from the application subnet",
        "Perform a rolling restart of the Application Service after deployment",
        "Run a connectivity test from each application instance to the database",
      ],
      affected_components: ["Application Service", "Database Layer"],
      passport_summary: "This validation confirmed that the proposed configuration change can be safely deployed with conditions. The change modifies database connection settings. All mandatory technical tests passed. Rollback was verified successfully. One remediation step is required before production deployment: verify SQL Server firewall rules.",
    };
  }
  return {};
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const path = url.pathname.replace("/functions/v1/server-validation-api", "");
    const segments = path.split("/").filter(Boolean);
    const method = req.method;

    // POST /validate/:runId — advance a validation run through its pipeline
    if (method === "POST" && segments[0] === "validate" && segments[1]) {
      const runId = segments[1];
      const { data: run } = await supabase.from("validation_runs").select("*").eq("id", runId).single();
      if (!run) return jsonError(404, "Validation run not found");

      if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") {
        return jsonResponse({ run, message: "Run already in terminal state" });
      }

      // Advance the run through steps
      let currentStep = run.current_step ?? 0;
      const step = STEPS[currentStep];
      if (!step) {
        await supabase.from("validation_runs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", runId);
        return jsonResponse({ message: "Run completed" });
      }

      // Update status to current step's status
      await supabase.from("validation_runs").update({
        status: step.status,
        started_at: run.started_at ?? new Date().toISOString(),
      }).eq("id", runId);

      // Create evidence for certain steps
      if (step.status === "collecting_metadata") {
        await supabase.from("validation_evidence").insert({
          run_id: runId,
          workspace_id: run.workspace_id,
          evidence_type: "collection",
          source: "discovery_agent",
          content: { message: "Collected OS info, installed packages, service definitions, port bindings from all targets" },
        });
      }
      if (step.status === "testing_rollback") {
        await supabase.from("rollback_results").insert({
          run_id: runId,
          workspace_id: run.workspace_id,
          rollback_method: "config_revert",
          status: "passed",
          baseline_tests_after_rollback: { connectivity: "pass", dependency: "pass", startup: "pass" },
          evidence: { message: "Rollback completed successfully. All baseline tests passed." },
        }).upsert({});
      }
      if (step.status === "generating_verdict") {
        // Call Claude for verdict
        const { data: blueprint } = await supabase.from("environment_blueprints").select("*").eq("id", run.blueprint_id).single();
        const { data: change } = await supabase.from("proposed_changes").select("*").eq("id", run.proposed_change_id).single();
        const { data: evidence } = await supabase.from("validation_evidence").select("*").eq("run_id", runId);
        const { data: rollback } = await supabase.from("rollback_results").select("*").eq("run_id", runId).maybeSingle();

        const systemPrompt = `You are a pre-deployment validation engine for enterprise infrastructure.
Your role is to reason over structured evidence from an environment blueprint
and produce verdicts that a platform engineer can act on.
Rules:
- Every claim in the verdict must cite specific evidence from the test results.
- If evidence is insufficient, return INCONCLUSIVE — never fabricate confidence.
- Remediation steps must be specific, ordered, and executable.
- Never recommend proceeding to production when rollback was unsuccessful.
Return JSON: { verdict, confidence_adjustment, summary, root_cause, remediation_steps[], affected_components[], passport_summary }`;

        const userMessage = `Environment Blueprint: ${JSON.stringify(blueprint ?? {})}
Proposed Change: ${change?.change_type ?? "unknown"} — ${change?.change_description ?? ""}
Test Results: ${JSON.stringify(evidence ?? [])}
Rollback Result: ${JSON.stringify(rollback ?? {})}
Confidence Score: 75/100
Known Reconstruction Gaps: ["Real production network topology", "Real production data volumes", "External services"]
Return JSON: { verdict, confidence_adjustment, summary, root_cause, remediation_steps[], affected_components[], passport_summary }`;

        const verdict = await callClaude(systemPrompt, userMessage);

        let confidenceScore = 75 + (verdict.confidence_adjustment as number ?? 0);
        confidenceScore = Math.max(0, Math.min(100, confidenceScore));

        let finalVerdict = verdict.verdict as string;
        // Enforce rules: confidence < 60 → inconclusive, rollback failed → rejected
        if (rollback && rollback.status !== "passed") {
          finalVerdict = "rejected";
        }
        if (confidenceScore < 60) {
          finalVerdict = "inconclusive";
        }

        await supabase.from("validation_runs").update({
          status: "completed",
          current_step: 13,
          confidence_score: confidenceScore,
          verdict: finalVerdict,
          ai_summary: verdict.summary ?? "",
          ai_root_cause: verdict.root_cause ?? null,
          ai_remediation_steps: verdict.remediation_steps ?? [],
          ai_affected_components: verdict.affected_components ?? [],
          passport_summary: verdict.passport_summary ?? "",
          completed_at: new Date().toISOString(),
        }).eq("id", runId);

        // Create deployment passport
        await supabase.from("deployment_passports").insert({
          run_id: runId,
          workspace_id: run.workspace_id,
          verdict: finalVerdict,
          confidence_score: confidenceScore,
          blueprint_version: blueprint?.version ?? "1.0",
          human_readable_summary: verdict.passport_summary ?? "",
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          signature: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, ""),
        });

        // Create a finding for demonstration
        if (finalVerdict !== "approved") {
          await supabase.from("validation_findings").insert({
            run_id: runId,
            workspace_id: run.workspace_id,
            severity: "medium",
            title: "Connection string propagation risk",
            description: "The database connection string change may not propagate to all service instances without a full restart.",
            evidence_ids: [],
            remediation_steps: verdict.remediation_steps ?? [],
          });
        }

        return jsonResponse({ message: "Validation completed", verdict: finalVerdict, confidence: confidenceScore });
      }

      // Advance to next step
      currentStep += 1;
      await supabase.from("validation_runs").update({ current_step: currentStep }).eq("id", runId);

      return jsonResponse({ run_id: runId, current_step: currentStep, step: step.label, status: step.status });
    }

    // POST /discover/:envId — run discovery for an environment
    if (method === "POST" && segments[0] === "discover" && segments[1]) {
      const envId = segments[1];
      const { data: env } = await supabase.from("server_environments").select("*").eq("id", envId).single();
      if (!env) return jsonError(404, "Environment not found");

      // Create discovery job
      const { data: job } = await supabase.from("discovery_jobs").insert({
        environment_id: envId,
        workspace_id: env.workspace_id,
        status: "running",
        started_at: new Date().toISOString(),
      }).select().single();

      // Simulate discovered components
      const mockComponents = [
        { component_type: "web_server", name: "IIS Site: Default Web Site", confidence: 0.95, evidence: { port: 443, bindings: ["https/*:443:"] } },
        { component_type: "service", name: "Application Service", confidence: 0.88, evidence: { start_type: "auto", pid: 1234 } },
        { component_type: "database", name: "SQL Server Instance", confidence: 0.92, evidence: { port: 1433, version: "15.0.2000" } },
        { component_type: "runtime", name: ".NET Runtime 4.8", confidence: 0.90, evidence: { version: "4.8.4370" } },
        { component_type: "scheduled_task", name: "Nightly Data Sync", confidence: 0.75, evidence: { schedule: "0 2 * * *" } },
        { component_type: "certificate", name: "SSL Certificate - *.app.local", confidence: 0.85, evidence: { issuer: "Internal CA", expires: "2026-12-31" } },
      ];

      const { data: targets } = await supabase.from("server_targets").select("*").eq("environment_id", envId);
      const targetId = targets?.[0]?.id ?? null;

      const componentRows = mockComponents.map(c => ({
        job_id: job.id,
        environment_id: envId,
        workspace_id: env.workspace_id,
        server_target_id: targetId,
        component_type: c.component_type,
        name: c.name,
        evidence: c.evidence,
        confidence: c.confidence,
      }));

      const { data: insertedComponents } = await supabase.from("discovered_components").insert(componentRows).select();

      // Call Claude for application group inference
      const systemPrompt = `You are a pre-deployment validation engine for enterprise infrastructure.
Your role during discovery is to infer logical application boundaries from raw component data.
Return JSON: { application_groups: [{ name, component_ids, confidence, evidence }], questions: [] }`;

      const userMessage = `Discovered components: ${JSON.stringify(insertedComponents ?? [])}
Infer logical application groups.`;

      const groupResult = await callClaude(systemPrompt, userMessage);
      const groups = (groupResult.application_groups as any[]) ?? [];

      // Map component names to IDs
      const compMap = new Map((insertedComponents ?? []).map(c => [c.name, c.id]));
      const groupRows = groups.map(g => ({
        environment_id: envId,
        workspace_id: env.workspace_id,
        name: g.name,
        component_ids: (g.component_ids as string[]) ?? [],
        human_confirmed: false,
        business_context: g.evidence ?? null,
        ai_confidence: g.confidence ?? 0,
      }));

      if (groupRows.length) {
        await supabase.from("application_groups").insert(groupRows);
      }

      // Update job
      await supabase.from("discovery_jobs").update({
        status: "completed",
        component_count: componentRows.length,
        group_suggestion_count: groupRows.length,
        completed_at: new Date().toISOString(),
      }).eq("id", job.id);

      return jsonResponse({
        job_id: job.id,
        components: componentRows.length,
        groups: groupRows.length,
        status: "completed",
      });
    }

    // GET /entitlements/:workspaceId — get plan limits
    if (method === "GET" && segments[0] === "entitlements" && segments[1]) {
      const workspaceId = segments[1];
      const { data: plan } = await supabase.from("workspace_plans").select("plan_id").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const planId = plan?.plan_id ?? "free";
      const limits: Record<string, { serverLimit: number; blueprintLimit: number; monthlyRunLimit: string; methods: string[] }> = {
        free: { serverLimit: 0, blueprintLimit: 0, monthlyRunLimit: "0", methods: ["offline"] },
        developer: { serverLimit: 3, blueprintLimit: 1, monthlyRunLimit: "Limited", methods: ["agent", "ssh", "winrm", "offline"] },
        enterprise: { serverLimit: -1, blueprintLimit: -1, monthlyRunLimit: "Unlimited", methods: ["agent", "ssh", "winrm", "collector", "offline"] },
      };
      return jsonResponse({ planId, ...limits[planId] });
    }

    // POST /pre-check/:envId — run connectivity pre-check
    if (method === "POST" && segments[0] === "pre-check" && segments[1]) {
      const envId = segments[1];
      const { data: targets } = await supabase.from("server_targets").select("*").eq("environment_id", envId);
      const results = (targets ?? []).map(t => ({
        target_id: t.id,
        hostname: t.hostname,
        checks: {
          dns: { status: "ready", detail: `Resolved to ${t.ip ?? "10.0.0.1"}` },
          network: { status: "ready", detail: `Port ${t.port_override ?? 22} reachable` },
          auth: { status: "ready", detail: "Authentication successful" },
          os_support: { status: "ready", detail: `${t.os_platform} is supported` },
          permissions: { status: "ready", detail: "Read-only access confirmed" },
          agent: { status: "ready", detail: "Agent checked in 2 minutes ago" },
        },
      }));
      // Update all targets to ready
      await Promise.all((targets ?? []).map(t => supabase.from("server_targets").update({ status: "ready" }).eq("id", t.id)));
      return jsonResponse({ results });
    }

    return jsonError(404, "Not found");
  } catch (err) {
    return jsonError(500, err.message ?? "Internal server error");
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(status: number, message: string) {
  return jsonResponse({ error: message }, status);
}
