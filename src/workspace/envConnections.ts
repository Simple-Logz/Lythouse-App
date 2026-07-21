// @ts-nocheck
// Environment CONNECTIONS — the "connect a real source" layer that sits on top of
// the static validators. A connection represents a live environment (an AWS
// account, a GCP project, an Azure subscription, or an on-prem/self-hosted
// estate). LytHouse never stores the customer's cloud credentials: a read-only
// collector runs where those credentials already live (a laptop, CI, a bastion,
// an on-prem box), pulls the real inventory, and pushes it here. The SAME
// validators that check a pasted file then run against the live inventory.
//
// HONESTY: nothing in here fabricates inventory. A connection only shows
// components that a collector actually pushed. Until the collector runs, a
// connection is "Awaiting first sync" — never a fake "connected, 12 resources".
import { Cloud, Server } from 'lucide-react';
import { validateComponent } from './envValidation';
import { edgeFunctionUrl, anonKey } from '../lib/supabase';

// ── Provider registry ────────────────────────────────────────────────────────
// Each provider maps its real read-only inventory to the component types the
// validators already understand (iam, network, container, kubernetes, server…).
export const PROVIDERS = [
  {
    id: 'aws',
    label: 'Amazon Web Services',
    short: 'AWS',
    icon: Cloud,
    accent: '#ff9900',
    blurb: 'IAM policies, security groups, EKS workloads, ECR images, S3 exposure.',
    pulls: ['IAM policies & roles', 'Security groups / NACLs', 'EKS workloads', 'ECR image config', 'Public S3 / RDS exposure'],
    // The collector uses the customer's own read-only AWS CLI credentials.
    setup: [
      'Attach the AWS-managed ReadOnlyAccess (or SecurityAudit) policy to a role or user you control.',
      'From a machine where that AWS CLI profile works, run the collector command below.',
      'The collector pulls read-only inventory and pushes it here. Your AWS keys never leave your machine.',
    ],
  },
  {
    id: 'gcp',
    label: 'Google Cloud',
    short: 'GCP',
    icon: Cloud,
    accent: '#4285f4',
    blurb: 'IAM bindings, firewall rules, GKE workloads, Artifact Registry, bucket exposure.',
    pulls: ['IAM policy bindings', 'VPC firewall rules', 'GKE workloads', 'Artifact Registry images', 'Public bucket exposure'],
    setup: [
      'Grant the roles/viewer (or roles/iam.securityReviewer) role to an account you control.',
      'From a machine where gcloud is authenticated to that project, run the collector command below.',
      'The collector pulls read-only inventory and pushes it here. Your GCP credentials never leave your machine.',
    ],
  },
  {
    id: 'azure',
    label: 'Microsoft Azure',
    short: 'Azure',
    icon: Cloud,
    accent: '#0078d4',
    blurb: 'RBAC assignments, NSG rules, AKS workloads, ACR images, storage exposure.',
    pulls: ['RBAC role assignments', 'Network security groups', 'AKS workloads', 'ACR image config', 'Public storage exposure'],
    setup: [
      'Assign the built-in Reader (or Security Reader) role at the subscription scope to an account you control.',
      'From a machine where the az CLI is signed in to that subscription, run the collector command below.',
      'The collector pulls read-only inventory and pushes it here. Your Azure credentials never leave your machine.',
    ],
  },
  {
    id: 'onprem',
    label: 'On-prem / Self-hosted',
    short: 'On-prem',
    icon: Server,
    accent: '#7c3aed',
    blurb: 'Servers, Kubernetes clusters, container hosts and firewalls inside your own network.',
    pulls: ['Server hardening (sshd, OS)', 'Self-hosted Kubernetes', 'Docker / container hosts', 'Firewall / iptables rules', 'Internal API gateways'],
    setup: [
      'Your private network is not reachable from the internet, so the collector runs INSIDE it and reaches out.',
      'Install the collector on a box that can read the configs you want validated (or point it at kubectl).',
      'Run it with --provider onprem. It reads the sources you list and pushes findings out to LytHouse.',
    ],
  },
];
export const providerOf = (id) => PROVIDERS.find((p) => p.id === id) || PROVIDERS[0];

// ── Connection records (per workspace) ───────────────────────────────────────
// status: 'awaiting'  → created, no collector sync yet
//         'connected' → at least one successful collector sync
//         'error'     → last sync failed
const uid = () => Math.random().toString(36).slice(2, 10);
// A connect token the collector presents when pushing inventory. It is an
// identifier scoped to one connection — NOT a cloud credential.
const mkToken = () => 'lhc_' + uid() + uid();

const CKEY = (wid) => `lh_env_connections_${wid || 'default'}`;
export function loadConnections(wid) {
  try { return JSON.parse(localStorage.getItem(CKEY(wid)) || '[]'); } catch { return []; }
}
export function saveConnections(wid, list) {
  try { localStorage.setItem(CKEY(wid), JSON.stringify(list)); } catch {}
}

export function newConnection(providerId, name) {
  const p = providerOf(providerId);
  return {
    id: uid(),
    provider: p.id,
    name: name?.trim() || `${p.short} environment`,
    status: 'awaiting',
    token: mkToken(),
    createdAt: Date.now(),
    lastSyncAt: null,
    componentCount: 0,
    error: null,
  };
}

// The exact command the customer runs to connect this source. The collector is
// published as an npx package; the token binds the push to this connection.
export function collectorCommand(conn) {
  const endpoint = `${edgeFunctionUrl}/environment-ingest`;
  return `npx @lythouse/collector --provider ${conn.provider} --token ${conn.token} --endpoint ${endpoint}`;
}

// ── Live sync ────────────────────────────────────────────────────────────────
// Ask the backend whether the collector has pushed inventory for this
// connection. Returns { components } where each component is validated with the
// SAME engine used for manual components. Never invents data: if the backend is
// unreachable or nothing was pushed, components is empty and the caller keeps
// the connection in 'awaiting'.
export async function syncConnection(conn) {
  const endpoint = `${edgeFunctionUrl}/environment-ingest?token=${encodeURIComponent(conn.token)}`;
  const res = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey },
  });
  if (!res.ok) throw new Error(`Sync failed (${res.status})`);
  const data = await res.json();
  const raw = Array.isArray(data?.components) ? data.components : [];
  // Validate each pushed component locally so scoring/status is identical to
  // the manual path. The collector sends { type, name, content }.
  const components = raw.map((c) => {
    const v = validateComponent({ type: c.type, content: c.content || '' });
    return {
      id: uid(),
      source: conn.provider,
      connectionId: conn.id,
      type: c.type,
      name: c.name || `${c.type} resource`,
      resourceId: c.resourceId || null,
      content: c.content || '',
      ...v,
      validatedAt: Date.now(),
    };
  });
  return { components, syncedAt: data?.syncedAt || Date.now() };
}
