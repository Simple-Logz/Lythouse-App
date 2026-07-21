// @ts-nocheck
// AI reasoning layer for Environment validation.
//
// IMPORTANT (honesty): the AI here NEVER detects issues. Detection is done by the
// deterministic validators in envValidation.ts. The AI is given ONLY those
// already-found findings and the component config, and its job is to explain,
// prioritize, and fix them — not to invent new ones. This is the same grounded
// pattern the rest of the app uses (it calls the ai-chat Edge Function → Claude).
import { edgeFunctionUrl, anonKey } from '../lib/supabase';
import { typeOf } from './envValidation';

const SYSTEM = `You are LytHouse's environment security analyst — an expert cloud/DevSecOps engineer.
You are given findings that were ALREADY detected by deterministic static checks, plus the component's configuration.
Your job: explain, prioritise, and fix ONLY what you are given.
Rules:
- Do NOT invent findings, CVEs, or claim to have scanned anything beyond the provided data.
- If there are no findings, say the component passed all checks — do not manufacture concerns.
- Be concise, specific and actionable. Plain language a busy engineer or manager can act on.`;

async function callAI(prompt: string): Promise<string> {
  try {
    const res = await fetch(`${edgeFunctionUrl}/ai-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}`, apikey: anonKey },
      body: JSON.stringify({ systemPrompt: SYSTEM, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) return `AI service unavailable (${res.status}). Deploy the ai-chat function and set ANTHROPIC_API_KEY in Supabase secrets.`;
    const d = await res.json();
    return d.content || 'No response.';
  } catch (e) {
    return `AI service unreachable: ${e.message}`;
  }
}

const findingsBlock = (comp) =>
  (comp.findings || []).map((f, i) => `${i + 1}. [${(f.severity || 'low').toUpperCase()}] ${f.title} — ${f.detail}${f.line ? ` (line ${f.line})` : ''}`).join('\n') || '(none)';

// Plain-language explanation of a single finding, grounded on that finding only.
export function explainFinding(comp, finding) {
  return callAI(`Explain this ONE environment finding in clear language. Cover: what it means, why it matters (what an attacker or failure could do), and whether it should block a production release. 3-5 sentences, no fluff.

Component: ${comp.name} (${typeOf(comp.type).label})
Finding: [${(finding.severity || 'low').toUpperCase()}] ${finding.title}
Detail: ${finding.detail}${finding.line ? `\nLocation: line ${finding.line}` : ''}`);
}

// A concrete, ready-to-apply fix for a single finding, grounded on the real config.
export function generateFix(comp, finding) {
  const cfg = (comp.content || '').slice(0, 6000);
  return callAI(`Produce a concrete fix for this environment finding. Structure it as:
PROBLEM: one line.
FIX: exactly what to change.
CORRECTED CONFIG: the corrected snippet (only the relevant part).
RISK: any risk of applying it.
Keep it tight and specific to the config shown.

Component: ${comp.name} (${typeOf(comp.type).label})
Finding: [${(finding.severity || 'low').toUpperCase()}] ${finding.title} — ${finding.detail}

Current configuration:
\`\`\`
${cfg}
\`\`\``);
}

// Overall posture assessment across all components, grounded on the findings list.
// Returns a plain assessment + the single most important fix + a deploy call.
export function analyzePosture(components) {
  if (!components.length) return Promise.resolve('No components connected yet — nothing to assess.');
  const inventory = components.map((c) =>
    `• ${c.name} (${typeOf(c.type).label}) — status: ${c.status}, score: ${c.score}/100\n  findings:\n${(c.findings || []).map((f) => `    - [${(f.severity || 'low').toUpperCase()}] ${f.title}`).join('\n') || '    (none)'}`
  ).join('\n');
  const blocked = components.filter((c) => c.status === 'blocked').length;
  return callAI(`Here is the current environment inventory with the findings detected for each component. Assess it.

Give me exactly three short sections:
1. ASSESSMENT — one paragraph: the overall state of this environment in plain language.
2. FIX FIRST — the single most important thing to fix and why (name the component).
3. DEPLOY CALL — one of: SAFE TO DEPLOY / FIX FIRST / DO NOT DEPLOY, with a one-line reason. Base this only on the findings below; ${blocked} component(s) are currently blocked.

Inventory:
${inventory}`);
}
