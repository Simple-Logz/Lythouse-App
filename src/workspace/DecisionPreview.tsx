// @ts-nocheck
// TEMP proof-preview: renders the REAL RepoDiscovery with a seeded cached report
// so the folded Release Decision card can be viewed at /__dpreview (no auth/network).
import { useState } from 'react';
import { RepoDiscovery } from './RepoDiscovery';
import { saveReport } from './repoCache';

const PROJECT = { id: 'demo', name: 'LytHouse-App', git_url: 'https://github.com/demo/lythouse', git_branch: 'main', github_token: null };

const FULL = {
  appType: 'Cloud-Native Microservices', services: 24, serviceNames: ['accounting', 'checkout', 'payments', 'auth'],
  cloud: ['AWS'], orchestration: 'Kubernetes', ci: 'GitHub Actions', infra: 'Terraform', container: 'Docker',
  monitoring: ['OpenTelemetry', 'Prometheus', 'Grafana', 'Jaeger'], stores: ['PostgreSQL'], envs: ['Production'],
  detected: ['Kubernetes', 'Terraform', 'GitHub Actions', 'Docker'],
  inventory: { total: 1200, relevant: 300, ignored: 900, buckets: [{ key: 'Source code', n: 800 }, { key: 'Kubernetes', n: 30 }, { key: 'Containers', n: 24 }] },
  counts: { files: 1200, services: 24, dockerfiles: 24, tf: 10, k8s: 30, ghActions: 2, helm: 1, compose: 0 },
  overall: 70,
  prediction: { successProb: 68, rollbackProb: 20, incident: 'Medium', expectedTime: 12, mostLikely: 'Container security' },
  summary: { blockers: 2, warnings: 1, opportunities: 1 },
  timeToReady: 45,
  recommendation: { verdict: 'Release Blocked', status: 'BLOCKED', tone: 'red', text: 'Resolve the blocking issues before promoting this release. Release approval is unavailable until they are cleared.' },
  strengths: ['CI runs automated security scanning.', 'Modern Kubernetes-based architecture.'],
  areas: [
    { k: 'Architecture', s: 82, op: 'Mature' }, { k: 'Security', s: 58, op: 'Needs improvement' },
    { k: 'Deployment Automation', s: 80, op: 'Mature' }, { k: 'Observability', s: 76, op: 'Mature' },
    { k: 'Disaster Recovery', s: 60, op: 'Moderate' }, { k: 'Operational Readiness', s: 72, op: 'Moderate' },
  ],
  concerns: [
    { sev: 'high', cat: 'Container security', label: 'Containers Running as Root', impact: 'Privilege escalation — a compromised container can reach adjacent services and credentials.', owner: 'Platform', eta: '30 min', etaMin: 30, delta: 9, fix: 'Run containers as non-root', likelihood: 'High', affected: ['accounting', 'checkout'] },
    { sev: 'high', cat: 'Secrets', label: 'Secrets in Source Control', impact: 'Credential exposure — unauthorized access to production systems and data.', owner: 'Security', eta: '15 min', etaMin: 15, delta: 12, fix: 'Remove committed .env, rotate secrets', likelihood: 'High', affected: ['accounting', 'checkout'] },
  ],
  priorities: [{ fix: 'Remove committed .env, rotate secrets', delta: 12, eta: '15 min' }, { fix: 'Run containers as non-root', delta: 9, eta: '30 min' }],
  projection: { readiness: [70, 88], rollback: [20, 8], confidence: [68, 86] },
  narrative: 'Cloud-Native Microservices platform. CI runs automated security scanning; centralized observability and automated CI/CD in place. 2 issues increase operational risk. Highest priority: Containers Running as Root.',
  allPaths: ['Dockerfile', '.env', 'src/index.ts'],
  analyzedSha: 'demo', analyzedAt: Date.now(),
};

export function DecisionPreview() {
  useState(() => { saveReport('discovery', PROJECT, FULL); return true; });
  return (
    <div className="max-w-3xl mx-auto p-4">
      <p className="text-xs text-gray-400 mb-3">Proof preview — the real RepoDiscovery Release Decision card, collapsed by default.</p>
      <RepoDiscovery project={PROJECT} onRunValidation={() => {}} onConnect={null} hadFailure={false} />
    </div>
  );
}
export default DecisionPreview;
