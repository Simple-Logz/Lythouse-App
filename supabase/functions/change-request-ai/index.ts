import { createClient } from "npm:@supabase/supabase-js@2.57.4";

// ── Change Management AI ────────────────────────────────────────────────────
// Generates the AI-authored sections of a change request (executive summary,
// impact analysis, risk contributors, reviewer comments, rollback plan).
//
// HONESTY CONTRACT: this function never invents findings, services, file
// names, CVEs, or numbers. It gathers ONLY real rows already in the database
// — the change request itself, its source validation + findings + pipeline
// steps, and the project's own change history — and asks Claude to explain,
// prioritise and phrase that real evidence, exactly the same grounded pattern
// process-validation/index.ts uses for its risk-assessment step. If the
// evidence needed for a section (e.g. specific affected services) isn't
// present in the data, the model is instructed to say so rather than guess.
// If no ANTHROPIC_API_KEY is configured, this returns a clear "unavailable"
// response — it does not fall back to fabricated text.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM = `You are LytHouse's change-management analyst — an expert release engineer who has been given the REAL evidence for one specific production change request: the change record itself, the security/risk validation it was drafted from (if any), the individual findings from that validation, the validation's own pipeline step log, and up to 5 of this project's most recent past change requests for historical context.

Ground rules (violating any of these makes your output useless and dangerous — do not violate them):
- Never invent a finding, file path, service name, API name, CVE, metric, or date that is not present in the evidence.
- If the evidence does not name a specific service/component/API, do not invent one. Instead say plainly that component-level detail isn't available from this scan and speak at whatever level of specificity the evidence actually supports (e.g. file paths or finding categories).
- Do not override or restate a different risk score/severity than what's given — treat riskScore/severity/riskLevel as ground truth.
- Every reviewer comment and risk contributor must be traceable to a specific field in the evidence (a finding, a missing plan field, a step status, a piece of history). If you can't point to what in the evidence justifies a statement, omit it.
- Write like a sharp, concise senior engineer — no filler, no hedging phrases like "it appears that". State things plainly.

Reply with STRICT JSON only, no markdown fences, matching this shape exactly:
{
  "summary": string,                          // 2-4 sentences. State the overall risk verdict and the concrete reason for it.
  "impact": [{"component": string, "reason": string}],   // components/areas affected, each with a one-sentence reason grounded in evidence. Empty array if evidence doesn't support naming any.
  "risk_contributors": [{"label": string, "reason": string}], // what's driving the risk score up, each grounded in evidence. Empty array if risk is low/clean.
  "reviewer_comments": string[],               // up to 5 short, pointed observations a senior reviewer would flag before approving. Empty array if nothing stands out.
  "rollback": {
    "steps": string[],                          // ordered, concrete rollback steps for THIS change
    "estimated_duration": string,                // a short estimate labeled as an estimate, e.g. "~15-20 min (estimate)"
    "dependencies": string[],                     // what the rollback depends on (pipeline access, DB backup, feature flag, etc.) — only list what's inferable from evidence or standard practice, phrased generically if evidence is silent
    "approvals_required": string[],               // who should sign off on invoking rollback
    "risks": string[]                             // what could go wrong during rollback itself
  }
}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { change_request_id } = await req.json();
    if (!change_request_id) {
      return new Response(JSON.stringify({ error: "change_request_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const { data: cr } = await sb.from("change_requests").select("*").eq("id", change_request_id).single();
    if (!cr) {
      return new Response(JSON.stringify({ error: "change request not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: project } = await sb.from("projects").select("id,name,git_branch,language,framework").eq("id", cr.project_id).single();

    let validation: Record<string, unknown> | null = null;
    let findings: Record<string, unknown>[] = [];
    let steps: Record<string, unknown>[] = [];
    if (cr.validation_id) {
      const [{ data: v }, { data: f }, { data: s }] = await Promise.all([
        sb.from("validations").select("*").eq("id", cr.validation_id).single(),
        sb.from("findings").select("category,severity,title,description,file_path,line,recommendation,status").eq("validation_id", cr.validation_id).order("severity").limit(40),
        sb.from("validation_steps").select("key,name,status,detail,duration_ms").eq("validation_id", cr.validation_id).order("step_index"),
      ]);
      validation = v || null;
      findings = f || [];
      steps = s || [];
    }

    const { data: history } = await sb
      .from("change_requests")
      .select("title,risk_level,status,environment,created_at,decided_at,decision_note,scheduled_start,scheduled_end")
      .eq("project_id", cr.project_id)
      .neq("id", change_request_id)
      .order("created_at", { ascending: false })
      .limit(5);

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: "not_configured", message: "ANTHROPIC_API_KEY not configured in Supabase secrets — AI insights are unavailable until it is." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const evidence = {
      changeRequest: {
        title: cr.title, environment: cr.environment, riskLevel: cr.risk_level, status: cr.status,
        scope: cr.scope, summary: cr.summary, riskAssessment: cr.risk_assessment, rollbackPlan: cr.rollback_plan,
        scheduledStart: cr.scheduled_start, scheduledEnd: cr.scheduled_end,
        approverName: cr.approver_name, approverEmail: cr.approver_email,
      },
      project: project ? { name: project.name, branch: project.git_branch, language: project.language, framework: project.framework } : null,
      validation: validation ? {
        riskScore: validation.risk_score, severity: validation.severity, commitSha: validation.commit_sha,
        totalFindings: validation.total_findings, criticalCount: validation.critical_count, highCount: validation.high_count,
        mediumCount: validation.medium_count, lowCount: validation.low_count, completedAt: validation.completed_at,
      } : null,
      findings: findings.map((f) => ({ category: f.category, severity: f.severity, title: f.title, file: f.file_path, recommendation: f.recommendation, status: f.status })),
      validationSteps: steps.map((s) => ({ name: s.name, status: s.status, detail: s.detail })),
      previousChangeRequestsForThisProject: (history || []).map((h) => ({
        title: h.title, riskLevel: h.risk_level, status: h.status, environment: h.environment,
        createdAt: h.created_at, decidedAt: h.decided_at, decisionNote: h.decision_note,
        rollbackRequired: h.status === "rolled_back",
      })),
    };

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6", max_tokens: 1800, system: SYSTEM,
        messages: [{ role: "user", content: JSON.stringify(evidence) }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Anthropic call failed", res.status, text);
      return new Response(JSON.stringify({ error: "ai_call_failed", message: `AI service returned ${res.status}.` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const text = (data.content || []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n");
    let parsed: any;
    try {
      const jsonStr = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse AI response", (e as Error).message, text);
      return new Response(JSON.stringify({ error: "parse_failed", message: "AI response could not be parsed." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = {
      ai_summary: String(parsed.summary || ""),
      ai_impact: Array.isArray(parsed.impact) ? parsed.impact : [],
      ai_risk_contributors: Array.isArray(parsed.risk_contributors) ? parsed.risk_contributors : [],
      ai_reviewer_comments: Array.isArray(parsed.reviewer_comments) ? parsed.reviewer_comments : [],
      ai_rollback: parsed.rollback && typeof parsed.rollback === "object" ? parsed.rollback : {},
      ai_generated_at: new Date().toISOString(),
    };

    await sb.from("change_requests").update(result).eq("id", change_request_id);

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("change-request-ai error:", error);
    return new Response(JSON.stringify({ error: "internal_error", message: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
