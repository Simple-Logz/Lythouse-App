// @ts-nocheck
// Line-level static linters for infrastructure & config files.
// Each returns findings: { file, line, type:'omission'|'commission', severity,
// title, detail, fixable }.  "omission" = something absent that should exist;
// "commission" = something present that is wrong.

const push = (out, f) => out.push(f);

export function lintDockerfile(content, path) {
  const out = [];
  const L = content.split('\n');
  let hasUser = false, hasHealthcheck = false, hasFrom = false;
  L.forEach((raw, i) => {
    const n = i + 1, t = raw.trim();
    if (/^USER\s+(?!root\b)\S+/i.test(t)) hasUser = true;
    if (/^HEALTHCHECK/i.test(t)) hasHealthcheck = true;
    if (/^FROM\s+/i.test(t)) hasFrom = true;
    if (/^FROM\s+\S+:latest/i.test(t) || /^FROM\s+[^:\s@]+\s*(as\s+\w+)?\s*$/i.test(t)) push(out, { line: n, type: 'commission', severity: 'medium', title: 'Mutable base image tag', detail: 'Uses :latest or no tag — builds are not reproducible and rollbacks are unreliable.' });
    if (/^ADD\s+https?:\/\//i.test(t)) push(out, { line: n, type: 'commission', severity: 'medium', title: 'ADD from remote URL', detail: 'Prefer COPY or a verified download; ADD from a URL is a supply-chain risk.' });
    if (/curl[^|]*\|\s*(sudo\s+)?(sh|bash)/i.test(t)) push(out, { line: n, type: 'commission', severity: 'high', title: 'Pipe curl to shell', detail: 'Executing an unverified remote script — remote code execution risk.' });
    if (/^ENV\s+.*(secret|password|token|api[_-]?key)\s*=/i.test(t)) push(out, { line: n, type: 'commission', severity: 'high', title: 'Secret in ENV', detail: 'Hardcoded credential baked into an image layer.' });
    if (/apt-get\s+install/i.test(t) && !/--no-install-recommends/.test(t)) push(out, { line: n, type: 'omission', severity: 'low', title: 'apt without --no-install-recommends', detail: 'Bloats the image and enlarges the attack surface.' });
  });
  if (hasFrom && !hasUser) push(out, { line: 1, type: 'omission', severity: 'high', title: 'Container runs as root', detail: 'No non-root USER instruction — a compromise has full container privileges.' });
  if (hasFrom && !hasHealthcheck) push(out, { line: 1, type: 'omission', severity: 'low', title: 'No HEALTHCHECK', detail: 'Orchestrators cannot detect an unhealthy container.' });
  return out.map((f) => ({ ...f, file: path }));
}

export function lintTerraform(content, path) {
  const out = [];
  content.split('\n').forEach((raw, i) => {
    const n = i + 1, t = raw;
    if (/0\.0\.0\.0\/0/.test(t)) push(out, { line: n, type: 'commission', severity: 'high', title: 'Open to the world (0.0.0.0/0)', detail: 'A security group / firewall rule is open to every IP address.' });
    if (/acl\s*=\s*"(public-read|public-read-write)"/i.test(t)) push(out, { line: n, type: 'commission', severity: 'high', title: 'Public bucket ACL', detail: 'Object storage is publicly readable/writable.' });
    if (/(secret|password|access_key|secret_key|token)\s*=\s*"[^"$\{][^"]{5,}"/i.test(t)) push(out, { line: n, type: 'commission', severity: 'high', title: 'Hardcoded credential', detail: 'Secret literal in Terraform — use variables or a secret store.' });
  });
  if (/(^|\n)\s*terraform\s*\{/.test(content) && !/backend\s+"/.test(content)) push(out, { line: 1, type: 'omission', severity: 'medium', title: 'No remote state backend', detail: 'Terraform state stored locally — unsafe for teams; configure a backend (S3/GCS/etc).' });
  if (/resource\s+"aws_s3_bucket"/.test(content) && !/encryption|kms/i.test(content)) push(out, { line: 1, type: 'omission', severity: 'medium', title: 'S3 bucket without encryption', detail: 'No server-side encryption configured on the bucket.' });
  if (/aws_iam/.test(content) && /"\*"/.test(content)) push(out, { line: 1, type: 'commission', severity: 'high', title: 'IAM wildcard permissions', detail: 'An IAM policy grants "*" — violates least privilege.' });
  return out.map((f) => ({ ...f, file: path }));
}

export function lintCI(content, path) {
  const out = [];
  const isGh = /\.github\/workflows\//.test(path);
  if (isGh) {
    if (!/environment:\s*(\n\s*name:\s*)?["']?prod/i.test(content)) push(out, { line: 1, type: 'omission', severity: 'high', title: 'No production approval gate', detail: 'Deploys to production without a protected environment / required reviewers.' });
    if (!/trivy|snyk|codeql|semgrep|gitleaks|grype|checkov/i.test(content)) push(out, { line: 1, type: 'omission', severity: 'medium', title: 'No security scanning step', detail: 'The pipeline runs no security scanner.' });
    if (!/permissions:/.test(content)) push(out, { line: 1, type: 'omission', severity: 'low', title: 'No explicit permissions', detail: 'Workflow uses the default (broad) GITHUB_TOKEN permissions.' });
    content.split('\n').forEach((ln, i) => { if (/uses:\s*[\w.\/-]+@(v?\d|main|master)/i.test(ln) && !/@[0-9a-f]{40}/.test(ln)) push(out, { line: i + 1, type: 'commission', severity: 'low', title: 'Action pinned by tag, not SHA', detail: 'Pin third-party actions to a commit SHA to prevent supply-chain tampering.' }); });
  }
  content.split('\n').forEach((ln, i) => { if (/(password|secret|token|api[_-]?key)\s*[:=]\s*["'][^"'$\{]{6,}/i.test(ln)) push(out, { line: i + 1, type: 'commission', severity: 'high', title: 'Hardcoded secret in pipeline', detail: 'Move this into CI secrets, not plaintext.' }); });
  return out.map((f) => ({ ...f, file: path }));
}

export function lintK8s(content, path) {
  const out = [];
  if (/kind:\s*(Deployment|StatefulSet|DaemonSet)/i.test(content)) {
    if (!/resources:\s*(\n\s+(limits|requests))/i.test(content)) push(out, { line: 1, type: 'omission', severity: 'medium', title: 'No resource limits', detail: 'Pods have no CPU/memory limits and can starve the node.' });
    if (!/livenessProbe|readinessProbe/i.test(content)) push(out, { line: 1, type: 'omission', severity: 'medium', title: 'No health probes', detail: 'No liveness/readiness probes — traffic can hit unhealthy pods.' });
    if (/privileged:\s*true/i.test(content)) push(out, { line: 1, type: 'commission', severity: 'high', title: 'Privileged container', detail: 'Runs with full host privileges.' });
    if (/hostNetwork:\s*true/i.test(content)) push(out, { line: 1, type: 'commission', severity: 'high', title: 'hostNetwork enabled', detail: 'Shares the host network namespace.' });
    if (/image:\s*\S+:latest/i.test(content)) push(out, { line: 1, type: 'commission', severity: 'medium', title: 'Mutable image tag (:latest)', detail: 'Non-reproducible deployments.' });
    if (!/runAsNonRoot:\s*true/i.test(content)) push(out, { line: 1, type: 'omission', severity: 'medium', title: 'Non-root not enforced', detail: 'securityContext.runAsNonRoot is not set to true.' });
  }
  return out.map((f) => ({ ...f, file: path }));
}

// Pick the right linter for a path.
export function linterFor(path) {
  if (/(^|\/)Dockerfile/i.test(path)) return lintDockerfile;
  if (/\.tf$/i.test(path)) return lintTerraform;
  if (/\.github\/workflows\/[^/]+\.ya?ml$/i.test(path) || /(^|\/)\.gitlab-ci\.ya?ml$/i.test(path) || /(^|\/)Jenkinsfile$/i.test(path)) return lintCI;
  if (/(k8s|kubernetes|manifests?|deploy(ments?)?|overlays?|base)\/.*\.ya?ml$/i.test(path)) return lintK8s;
  return null;
}

export function selectScanTargets(paths) {
  const dock = paths.filter((p) => /(^|\/)Dockerfile/i.test(p)).slice(0, 10);
  const tf = paths.filter((p) => /\.tf$/i.test(p)).slice(0, 10);
  const ci = paths.filter((p) => /\.github\/workflows\/[^/]+\.ya?ml$/i.test(p) || /(^|\/)\.gitlab-ci\.ya?ml$/i.test(p) || /(^|\/)Jenkinsfile$/i.test(p)).slice(0, 8);
  const k8s = paths.filter((p) => /(k8s|kubernetes|manifests?|deploy(ments?)?|overlays?|base)\/.*\.ya?ml$/i.test(p)).slice(0, 10);
  return [...dock, ...tf, ...ci, ...k8s];
}
