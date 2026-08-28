export type ReleaseVerdict = 'SHIP' | 'REVIEW' | 'BLOCK';

export type ChangeImpact = {
  path: string;
  kind: 'application' | 'dependency' | 'infrastructure' | 'ci' | 'security' | 'configuration' | 'database' | 'unknown';
  weight: number;
  reasons: string[];
};

const RULES: Array<{ test: RegExp; kind: ChangeImpact['kind']; weight: number; reason: string }> = [
  { test: /(^|\/)\.github\/workflows\//i, kind: 'ci', weight: 14, reason: 'CI/CD workflow changed' },
  { test: /(^|\/)(terraform|infra|infrastructure)\/|\.tf(vars)?$/i, kind: 'infrastructure', weight: 18, reason: 'Infrastructure-as-code changed' },
  { test: /(^|\/)(k8s|kubernetes|helm)\/|\.ya?ml$/i, kind: 'infrastructure', weight: 12, reason: 'Deployment or orchestration configuration changed' },
  { test: /Dockerfile|docker-compose/i, kind: 'infrastructure', weight: 12, reason: 'Container/runtime definition changed' },
  { test: /package(-lock)?\.json$|requirements\.txt$|poetry\.lock$|go\.mod$|go\.sum$/i, kind: 'dependency', weight: 12, reason: 'Dependency graph changed' },
  { test: /(^|\/)supabase\/migrations\/|(^|\/)migrations\//i, kind: 'database', weight: 18, reason: 'Database schema/migration changed' },
  { test: /(^|\/)(auth|security|permissions|iam|rbac)(\/|\.|-)/i, kind: 'security', weight: 18, reason: 'Authentication/authorization/security code changed' },
  { test: /\.env|config\.|vercel\.json|netlify\.toml/i, kind: 'configuration', weight: 14, reason: 'Runtime/deployment configuration changed' },
  { test: /(^|\/)(api|server|functions|routes)\//i, kind: 'application', weight: 10, reason: 'Backend/API behavior changed' },
];

export function classifyChangedPath(path: string): ChangeImpact {
  const matches = RULES.filter((r) => r.test.test(path));
  if (!matches.length) return { path, kind: 'unknown', weight: 3, reasons: ['Application code changed'] };
  const strongest = [...matches].sort((a, b) => b.weight - a.weight)[0];
  return { path, kind: strongest.kind, weight: Math.min(25, matches.reduce((n, r) => n + Math.ceil(r.weight / 2), 0)), reasons: matches.map((r) => r.reason) };
}

export function calculateChangeRisk(paths: string[], findingRisk = 0) {
  const impacts = paths.map(classifyChangedPath);
  const changeRisk = Math.min(100, impacts.reduce((sum, item) => sum + item.weight, 0));
  const riskScore = Math.min(100, Math.round(findingRisk * 0.7 + changeRisk * 0.3));
  const criticalChange = impacts.some((i) => ['security', 'database', 'infrastructure'].includes(i.kind) && i.weight >= 18);
  const verdict: ReleaseVerdict = riskScore >= 70 ? 'BLOCK' : riskScore >= 35 || criticalChange ? 'REVIEW' : 'SHIP';
  return { impacts, changeRisk, riskScore, verdict };
}
