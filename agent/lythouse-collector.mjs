#!/usr/bin/env node
/**
 * LytHouse read-only environment collector.
 *
 * This runs WHERE YOUR CREDENTIALS ALREADY LIVE — a laptop, a CI runner, a
 * bastion, or an on-prem host. It uses the cloud CLIs you already trust
 * (aws / gcloud / az / kubectl), performs ONLY read-only calls, maps the live
 * inventory onto the component types LytHouse validates, and pushes the result
 * to your workspace over HTTPS.
 *
 * It never sends your cloud credentials anywhere. Only the resulting inventory
 * (IAM policy JSON, security-group rules, workload manifests, etc.) is pushed,
 * and only to the endpoint + token you pass in.
 *
 * Usage:
 *   npx @lythouse/collector --provider aws    --token <token> --endpoint <url>
 *   npx @lythouse/collector --provider gcp    --token <token> --endpoint <url> --project my-proj
 *   npx @lythouse/collector --provider azure  --token <token> --endpoint <url>
 *   npx @lythouse/collector --provider onprem --token <token> --endpoint <url> \
 *        --sources /etc/ssh/sshd_config,/etc/nginx/nginx.conf --kube
 *
 * Add --dry-run to print what would be pushed without sending anything.
 */
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { basename } from 'node:path';

const exec = promisify(execFile);

function parseArgs(argv) {
  const a = { provider: '', token: '', endpoint: '', project: '', sources: '', kube: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => argv[++i];
    if (k === '--provider') a.provider = next();
    else if (k === '--token') a.token = next();
    else if (k === '--endpoint') a.endpoint = next();
    else if (k === '--project') a.project = next();
    else if (k === '--sources') a.sources = next();
    else if (k === '--kube') a.kube = true;
    else if (k === '--dry-run') a.dryRun = true;
  }
  return a;
}

async function run(cmd, args) {
  try {
    const { stdout } = await exec(cmd, args, { maxBuffer: 20 * 1024 * 1024 });
    return { ok: true, out: stdout };
  } catch (e) {
    return { ok: false, err: (e && (e.stderr || e.message)) || 'command failed' };
  }
}
function push(list, comp) { if (comp && comp.content) list.push(comp); }
const log = (...m) => console.log('[lythouse]', ...m);
const warn = (...m) => console.warn('[lythouse]', ...m);

// ── AWS ──────────────────────────────────────────────────────────────────────
async function collectAWS() {
  const out = [];
  log('AWS: collecting read-only inventory via `aws` CLI…');

  // Customer-managed IAM policies → iam components
  const pols = await run('aws', ['iam', 'list-policies', '--scope', 'Local', '--output', 'json']);
  if (pols.ok) {
    let doc; try { doc = JSON.parse(pols.out); } catch { doc = null; }
    for (const p of (doc?.Policies || []).slice(0, 50)) {
      const ver = await run('aws', ['iam', 'get-policy-version', '--policy-arn', p.Arn, '--version-id', p.DefaultVersionId, '--output', 'json']);
      if (!ver.ok) continue;
      let v; try { v = JSON.parse(ver.out); } catch { continue; }
      const document = v?.PolicyVersion?.Document;
      push(out, { type: 'iam', name: p.PolicyName, resourceId: p.Arn, content: JSON.stringify(document) });
    }
  } else warn('AWS: could not list IAM policies —', pols.err.split('\n')[0]);

  // Security groups → network components
  const sgs = await run('aws', ['ec2', 'describe-security-groups', '--output', 'json']);
  if (sgs.ok) {
    let doc; try { doc = JSON.parse(sgs.out); } catch { doc = null; }
    for (const g of (doc?.SecurityGroups || []).slice(0, 100)) {
      push(out, { type: 'network', name: g.GroupName || g.GroupId, resourceId: g.GroupId, content: JSON.stringify({ GroupName: g.GroupName, ingress: g.IpPermissions, egress: g.IpPermissionsEgress }, null, 2) });
    }
  } else warn('AWS: could not describe security groups —', sgs.err.split('\n')[0]);

  return out;
}

// ── GCP ──────────────────────────────────────────────────────────────────────
async function collectGCP(project) {
  const out = [];
  log('GCP: collecting read-only inventory via `gcloud`…');
  const proj = project ? ['--project', project] : [];

  const iam = await run('gcloud', ['projects', 'get-iam-policy', project || '', '--format', 'json'].filter(Boolean));
  if (iam.ok) push(out, { type: 'iam', name: `project IAM policy${project ? ` (${project})` : ''}`, resourceId: project, content: iam.out });
  else warn('GCP: could not read IAM policy —', iam.err.split('\n')[0]);

  const fw = await run('gcloud', ['compute', 'firewall-rules', 'list', '--format', 'json', ...proj]);
  if (fw.ok) {
    let doc; try { doc = JSON.parse(fw.out); } catch { doc = null; }
    for (const r of (doc || []).slice(0, 100)) push(out, { type: 'network', name: r.name, resourceId: r.selfLink, content: JSON.stringify(r, null, 2) });
  } else warn('GCP: could not list firewall rules —', fw.err.split('\n')[0]);

  return out;
}

// ── Azure ─────────────────────────────────────────────────────────────────────
async function collectAzure() {
  const out = [];
  log('Azure: collecting read-only inventory via `az`…');

  const ra = await run('az', ['role', 'assignment', 'list', '--all', '--output', 'json']);
  if (ra.ok) push(out, { type: 'iam', name: 'RBAC role assignments', content: ra.out });
  else warn('Azure: could not list role assignments —', ra.err.split('\n')[0]);

  const nsg = await run('az', ['network', 'nsg', 'list', '--output', 'json']);
  if (nsg.ok) {
    let doc; try { doc = JSON.parse(nsg.out); } catch { doc = null; }
    for (const g of (doc || []).slice(0, 100)) push(out, { type: 'network', name: g.name, resourceId: g.id, content: JSON.stringify({ name: g.name, securityRules: g.securityRules }, null, 2) });
  } else warn('Azure: could not list NSGs —', nsg.err.split('\n')[0]);

  return out;
}

// ── On-prem / self-hosted ──────────────────────────────────────────────────────
function guessType(path) {
  const n = path.toLowerCase();
  if (n.includes('sshd') || n.includes('sshd_config')) return 'server';
  if (n.endsWith('.tf')) return 'terraform';
  if (n.includes('dockerfile')) return 'container';
  if (n.endsWith('.yaml') || n.endsWith('.yml')) return 'kubernetes';
  if (n.includes('iptables') || n.includes('firewall') || n.includes('nftables')) return 'network';
  return 'server';
}
async function collectOnPrem(sources, kube) {
  const out = [];
  log('On-prem: collecting from local sources…');
  for (const raw of (sources || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    try {
      const content = await readFile(raw, 'utf8');
      push(out, { type: guessType(raw), name: basename(raw), resourceId: raw, content });
    } catch (e) { warn(`On-prem: could not read ${raw} —`, e.message); }
  }
  if (kube) {
    const kd = await run('kubectl', ['get', 'deployments', '--all-namespaces', '-o', 'yaml']);
    if (kd.ok) push(out, { type: 'kubernetes', name: 'cluster deployments', content: kd.out });
    else warn('On-prem: kubectl read failed —', kd.err.split('\n')[0]);
  }
  return out;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!a.provider || !a.token || !a.endpoint) {
    console.error('Usage: lythouse-collector --provider <aws|gcp|azure|onprem> --token <token> --endpoint <url> [--project p] [--sources a,b] [--kube] [--dry-run]');
    process.exit(1);
  }

  let components = [];
  if (a.provider === 'aws') components = await collectAWS();
  else if (a.provider === 'gcp') components = await collectGCP(a.project);
  else if (a.provider === 'azure') components = await collectAzure();
  else if (a.provider === 'onprem') components = await collectOnPrem(a.sources, a.kube);
  else { console.error('Unknown provider:', a.provider); process.exit(1); }

  log(`collected ${components.length} component(s)`);
  if (!components.length) { warn('Nothing collected. Check that the relevant CLI is installed and authenticated (read-only is fine).'); }

  const payload = { token: a.token, provider: a.provider, collectedAt: Date.now(), components };
  if (a.dryRun) {
    log('--dry-run: not sending. Payload preview:');
    console.log(JSON.stringify({ ...payload, components: components.map((c) => ({ type: c.type, name: c.name, bytes: c.content.length })) }, null, 2));
    return;
  }

  log(`pushing to ${a.endpoint}…`);
  const res = await fetch(a.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { console.error('[lythouse] push failed:', res.status, await res.text().catch(() => '')); process.exit(1); }
  log('done — inventory pushed. Open LytHouse → Environment and hit “Check for sync”.');
}

main().catch((e) => { console.error('[lythouse] fatal:', e.message); process.exit(1); });
