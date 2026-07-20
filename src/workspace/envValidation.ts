// @ts-nocheck
// Environment Validation engine — validates infrastructure/config COMPONENTS the
// user provides (pasted or uploaded), using real static checks. Reuses the
// existing file linters and adds IAM / networking / API validators. Everything
// here analyzes the actual artifact given — no fabricated "live" data.
import { lintDockerfile, lintTerraform, lintK8s, lintCI } from './fileLinters';
import { LayoutGrid, Boxes, Cloud, Network, Lock, Container, FileCode2, Globe, Server } from 'lucide-react';

// ── New validators ──────────────────────────────────────────────────────────
function tryJSON(s) { try { return JSON.parse(s); } catch { return null; } }

export function lintIAM(content) {
  const out = [];
  const doc = tryJSON(content);
  if (!doc) { out.push({ severity: 'medium', title: "Couldn't parse as JSON", detail: 'Paste a valid IAM policy document (JSON) so it can be validated.' }); return out; }
  const stmts = Array.isArray(doc.Statement) ? doc.Statement : doc.Statement ? [doc.Statement] : [];
  if (!stmts.length) out.push({ severity: 'low', title: 'No Statement block', detail: 'This does not look like a standard IAM policy — no Statement array found.' });
  stmts.forEach((s, i) => {
    const label = `Statement ${i + 1}`;
    if (s.Effect !== 'Allow') return;
    const acts = [].concat(s.Action || []);
    const res = [].concat(s.Resource || []);
    const allAct = acts.includes('*') || acts.some((a) => /:\*$/.test(a) || a === '*');
    const allRes = res.includes('*') || res.some((r) => r === '*');
    if (allAct && allRes) out.push({ severity: 'critical', title: 'Full-admin wildcard grant', detail: `${label} allows Action "*" on Resource "*" — effectively administrator access. Violates least privilege.` });
    else if (allAct) out.push({ severity: 'high', title: 'Wildcard action', detail: `${label} allows all actions ("*") — scope to the specific actions needed.` });
    else if (allRes && !s.Condition) out.push({ severity: 'medium', title: 'Wildcard resource without condition', detail: `${label} applies to Resource "*" with no Condition — narrow the resources or add a condition.` });
    if (s.NotAction || s.NotResource) out.push({ severity: 'medium', title: 'NotAction / NotResource used', detail: `${label} uses NotAction/NotResource, which grants everything except the listed items — easy to over-permit.` });
    if (allAct && !s.Condition) out.push({ severity: 'low', title: 'No Condition constraints', detail: `${label} has no Condition (e.g. MFA, source IP, tag) limiting when the permission applies.` });
  });
  return out;
}

export function lintNetwork(content) {
  const out = [];
  const L = content.split('\n');
  let sawWorld = false;
  L.forEach((raw, i) => {
    const line = i + 1, t = raw;
    if (/0\.0\.0\.0\/0|::\/0/.test(t)) { sawWorld = true; out.push({ line, severity: 'high', title: 'Open to the entire internet (0.0.0.0/0)', detail: 'An ingress rule allows every source IP. Restrict to known CIDRs.' }); }
    if (/(?:port|from_port|dport)\D{0,4}(22|3389)\b/i.test(t) && /0\.0\.0\.0\/0/.test(content)) out.push({ line, severity: 'high', title: 'SSH/RDP exposed to the world', detail: 'Port 22 or 3389 reachable from 0.0.0.0/0 — a top attack vector. Use a bastion or VPN.' });
    if (/from_port\D+0\b[\s\S]{0,40}to_port\D+65535/i.test(t) || /-1\b.*(protocol|ipprotocol)/i.test(t)) out.push({ line, severity: 'high', title: 'All ports open', detail: 'Rule opens the full port range / all protocols. Open only what is needed.' });
    if (/protocol['":\s]+["']?-1|ipprotocol['":\s]+["']?-1/i.test(t)) out.push({ line, severity: 'medium', title: 'All protocols allowed (-1)', detail: 'Rule allows every protocol.' });
    if (/(telnet|ftp)\b/i.test(t)) out.push({ line, severity: 'medium', title: 'Insecure protocol', detail: 'Telnet/FTP transmit credentials in clear text.' });
  });
  if (!/egress|outbound/i.test(content)) out.push({ severity: 'low', title: 'No egress rules defined', detail: 'Consider restricting outbound traffic (default-allow egress can enable data exfiltration).' });
  if (!sawWorld && !L.length) out.push({ severity: 'low', title: 'Empty configuration', detail: 'No rules to validate.' });
  return out;
}

export function lintAPI(content) {
  const out = [];
  const lower = content.toLowerCase();
  if (/http:\/\/(?!localhost|127\.)/.test(content)) out.push({ severity: 'medium', title: 'Non-HTTPS endpoint', detail: 'An http:// URL is used — traffic (and tokens) travel unencrypted. Use https://.' });
  if (!/security|securityschemes|authorization|bearer|oauth|apikey|api_key/i.test(lower)) out.push({ severity: 'high', title: 'No authentication defined', detail: 'The spec declares no security scheme — endpoints may be open. Define auth (OAuth/JWT/API key).' });
  if (/access-control-allow-origin['":\s]+["']?\*/i.test(content) || /cors[\s\S]{0,40}\*/i.test(lower)) out.push({ severity: 'medium', title: 'Wildcard CORS (*)', detail: 'CORS allows any origin. Restrict to trusted domains.' });
  if (!/rate.?limit|throttl|quota|x-ratelimit/i.test(lower)) out.push({ severity: 'low', title: 'No rate limiting mentioned', detail: 'No rate limiting/throttling declared — APIs without it are prone to abuse.' });
  if (!/version|"openapi"|swagger|info:/i.test(lower)) out.push({ severity: 'low', title: 'No version / spec metadata', detail: 'Could not detect an OpenAPI/Swagger version block.' });
  return out;
}

function lintServer(content) {
  // Server hardening config (sshd_config / os hardening text)
  const out = [];
  const L = content.split('\n');
  L.forEach((raw, i) => {
    const line = i + 1, t = raw.trim();
    if (/^PermitRootLogin\s+(yes|prohibit-password)/i.test(t)) out.push({ line, severity: 'high', title: 'Root SSH login permitted', detail: 'Set PermitRootLogin no; use a named account with sudo.' });
    if (/^PasswordAuthentication\s+yes/i.test(t)) out.push({ line, severity: 'medium', title: 'Password SSH auth enabled', detail: 'Prefer key-based auth (PasswordAuthentication no).' });
    if (/^Protocol\s+1/i.test(t)) out.push({ line, severity: 'high', title: 'SSH protocol 1', detail: 'Legacy, insecure SSH protocol.' });
    if (/(password|secret|token)\s*=\s*\S+/i.test(t)) out.push({ line, severity: 'high', title: 'Credential in config', detail: 'A secret appears in plain text.' });
  });
  if (!/PermitRootLogin/i.test(content)) out.push({ severity: 'low', title: 'PermitRootLogin not set', detail: 'Explicitly disable root SSH login.' });
  return out;
}

// ── Component type registry ─────────────────────────────────────────────────
export const COMPONENT_TYPES = [
  { id: 'kubernetes', label: 'Kubernetes', icon: Boxes, hint: 'Deployment / manifest YAML', run: (c) => lintK8s(c, 'component.yaml'), sample: 'apiVersion: apps/v1\nkind: Deployment\n...' },
  { id: 'terraform', label: 'Terraform / IaC', icon: Cloud, hint: 'Terraform .tf configuration', run: (c) => lintTerraform(c, 'component.tf'), sample: 'resource "aws_s3_bucket" "b" { ... }' },
  { id: 'container', label: 'Container Image', icon: Container, hint: 'Dockerfile', run: (c) => lintDockerfile(c, 'Dockerfile'), sample: 'FROM node:20\n...' },
  { id: 'iam', label: 'IAM Policy', icon: Lock, hint: 'AWS/GCP IAM policy JSON', run: (c) => lintIAM(c), sample: '{"Version":"2012-10-17","Statement":[...]}' },
  { id: 'network', label: 'Networking', icon: Network, hint: 'Security group / firewall rules', run: (c) => lintNetwork(c), sample: 'ingress { cidr_blocks = ["0.0.0.0/0"] from_port = 22 ... }' },
  { id: 'api', label: 'API Endpoint', icon: Globe, hint: 'OpenAPI / Swagger spec', run: (c) => lintAPI(c), sample: 'openapi: 3.0.0\ninfo: ...' },
  { id: 'cicd', label: 'CI/CD Pipeline', icon: FileCode2, hint: 'GitHub Actions / GitLab CI YAML', run: (c) => lintCI(c, '.github/workflows/deploy.yml'), sample: 'name: deploy\non: [push]\n...' },
  { id: 'server', label: 'Server', icon: Server, hint: 'sshd_config / hardening config', run: (c) => lintServer(c), sample: 'PermitRootLogin no\nPasswordAuthentication no' },
];
export const typeOf = (id) => COMPONENT_TYPES.find((t) => t.id === id) || COMPONENT_TYPES[0];

// ── Scoring + status ────────────────────────────────────────────────────────
const WEIGHT = { critical: 30, high: 15, medium: 7, low: 3 };
export function scoreFindings(findings) {
  const penalty = findings.reduce((s, f) => s + (WEIGHT[f.severity] || 3), 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}
export function statusFor(findings) {
  const score = scoreFindings(findings);
  const hasCrit = findings.some((f) => f.severity === 'critical' || f.severity === 'high');
  if (hasCrit || score < 55) return 'blocked';
  if (findings.length) return 'issues';
  return 'validated';
}

export function validateComponent(comp) {
  const t = typeOf(comp.type);
  let findings = [];
  try { findings = (t.run(comp.content || '') || []).map((f) => ({ severity: f.severity || 'low', title: f.title, detail: f.detail, line: f.line })); }
  catch (e) { findings = [{ severity: 'medium', title: 'Validation error', detail: e.message }]; }
  return { findings, score: scoreFindings(findings), status: statusFor(findings) };
}

// ── Persistence (per-workspace, local for v1) ───────────────────────────────
const KEY = (wid) => `lh_env_components_${wid || 'default'}`;
export function loadComponents(wid) { try { return JSON.parse(localStorage.getItem(KEY(wid)) || '[]'); } catch { return []; } }
export function saveComponents(wid, list) { try { localStorage.setItem(KEY(wid), JSON.stringify(list)); } catch {} }
