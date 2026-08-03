// @ts-nocheck
// AI reasoning layer for the Change Management Hub — client-side, calling the
// ALREADY-DEPLOYED ai-chat Edge Function directly (same pattern as
// envAI.ts). This intentionally avoids depending on a separately-deployed
// edge function or new database columns, so the AI Deployment Review Center
// works today even before any pending schema migration is applied — the
// caller (ChangeRequestDetailPage) generates this in memory each time the
// page loads and opportunistically tries to persist it, but never depends on
// persistence succeeding.
//
// HONESTY (same contract as envAI.ts / process-validation.ts): the model is
// given ONLY real evidence already in the database for this one change
// request — the change record, its source validation, its findings, its
// validation pipeline steps, and the project's own change history. It is
// never allowed to invent a finding, service, file, CVE, or number that
// isn't present in that evidence.
import { edgeFunctionUrl, anonKey } from '../lib/supabase';

const REVIEW_SYSTEM = `You are LytHouse's change-management analyst — an expert release engineer who has been given the REAL evidence for one specific production change request: the change record itself, the security/risk validation it was drafted from (if any), the individual findings from that validation, the validation's own pipeline step log, and up to 5 of this project's most recent past change requests for historical context.

Ground rules (violating any of these makes your output useless and dangerous — do not violate them):
- Never invent a finding, file path, service name, API name, CVE, metric, or date that is not present in the evidence.
- If the evidence does not name a specific service/component/API, do not invent one. Say plainly that component-level detail isn't available and speak at whatever level of specificity the evidence actually supports (e.g. file paths or finding categories).
- Do not override or restate a different risk score/severity than what's given — treat riskScore/severity/riskLevel as ground truth.
- Every reviewer comment and risk contributor must be traceable to a specific field in the evidence. If you can't point to what justifies a statement, omit it.
- Write like a sharp, concise senior engineer — no filler, no hedging phrases like "it appears that". State things plainly.

Reply with STRICT JSON only, no markdown fences, matching this shape exactly:
{
  "summary": string,
  "impact": [{"component": string, "reason": string}],
  "risk_contributors": [{"label": string, "reason": string}],
  "reviewer_comments": string[],
  "rollback": {
    "steps": string[],
    "estimated_duration": string,
    "dependencies": string[],
    "approvals_required": string[],
    "risks": string[]
  }
}`;

const RECS_SYSTEM = `You are LytHouse's change-management analyst. You are given real aggregate statistics about a workspace's recent change requests — counts by status, average risk score, currently-pending requests with how long they've been waiting, and which projects have the most open findings.

Identify up to 4 concrete, actionable recommendations a team lead would want to see. Every recommendation must cite a specific number or fact from the evidence given — never invent a statistic that isn't present. If nothing notable stands out in the evidence, return an empty array rather than manufacturing generic advice.

Reply with STRICT JSON only, no markdown fences: {"recommendations": string[]}`;

async function callAIRaw(systemPrompt: string, userPrompt: string): Promise<{ ok: boolean; text?: string; error?: string }> {
  try {
    const res = await fetch(`${edgeFunctionUrl}/ai-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}`, apikey: anonKey },
      body: JSON.stringify({ systemPrompt, messages: [{ role: 'user', content: userPrompt }] }),
    });
    if (!res.ok) return { ok: false, error: `AI service unavailable (${res.status}). Deploy the ai-chat function and set ANTHROPIC_API_KEY in Supabase secrets.` };
    const d = await res.json();
    if (d.error) return { ok: false, error: d.error };
    return { ok: true, text: d.content || '' };
  } catch (e: any) {
    return { ok: false, error: 'AI service unreachable: ' + (e.message || 'unknown error') };
  }
}

function parseJSON(text: string): any | null {
  try {
    const s = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export type DeploymentReview = {
  summary: string;
  impact: { component: string; reason: string }[];
  risk_contributors: { label: string; reason: string }[];
  reviewer_comments: string[];
  rollback: { steps?: string[]; estimated_duration?: string; dependencies?: string[]; approvals_required?: string[]; risks?: string[] };
};

// Generates the full AI Deployment Review for one change request, grounded
// only in the evidence object passed in (build it from real DB rows — see
// ChangeRequestDetailPage for what's included).
export async function generateDeploymentReview(evidence: Record<string, unknown>): Promise<{ ok: boolean; data?: DeploymentReview; error?: string }> {
  const { ok, text, error } = await callAIRaw(REVIEW_SYSTEM, JSON.stringify(evidence));
  if (!ok) return { ok: false, error };
  const parsed = parseJSON(text!);
  if (!parsed) return { ok: false, error: 'AI response could not be parsed.' };
  return {
    ok: true,
    data: {
      summary: String(parsed.summary || ''),
      impact: Array.isArray(parsed.impact) ? parsed.impact : [],
      risk_contributors: Array.isArray(parsed.risk_contributors) ? parsed.risk_contributors : [],
      reviewer_comments: Array.isArray(parsed.reviewer_comments) ? parsed.reviewer_comments : [],
      rollback: parsed.rollback && typeof parsed.rollback === 'object' ? parsed.rollback : {},
    },
  };
}

// Generates up to 4 grounded recommendations for the Change Management
// dashboard, from real aggregate stats across the workspace's change
// requests (see ChangeManagementPage for how the evidence is built).
export async function generateDashboardRecommendations(evidence: Record<string, unknown>): Promise<{ ok: boolean; data?: string[]; error?: string }> {
  const { ok, text, error } = await callAIRaw(RECS_SYSTEM, JSON.stringify(evidence));
  if (!ok) return { ok: false, error };
  const parsed = parseJSON(text!);
  if (!parsed || !Array.isArray(parsed.recommendations)) return { ok: false, error: 'AI response could not be parsed.' };
  return { ok: true, data: parsed.recommendations.slice(0, 4).map(String) };
}
