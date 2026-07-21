# LytHouse Collector

A tiny read-only agent that connects a real environment to LytHouse.

## Why it exists

LytHouse validates your infrastructure — IAM policies, security groups, workloads,
container images, server hardening. To do that on **live** infrastructure it needs
to read your inventory. Rather than asking you to hand LytHouse your cloud keys,
the collector runs **where your credentials already live** (your laptop, a CI
runner, a bastion, or an on-prem host), performs **only read-only calls** through
the CLIs you already trust, and pushes just the resulting inventory to your
workspace.

**Your cloud credentials never leave the machine you run this on.** Only the
inventory (policy JSON, firewall rules, manifests) is sent, and only to the
endpoint and token you pass in. The token identifies your LytHouse connection —
it is not a cloud credential.

## Requirements

- Node.js 18+
- The relevant CLI, already authenticated read-only:
  - AWS → `aws` (attach `ReadOnlyAccess` or `SecurityAudit`)
  - GCP → `gcloud` (`roles/viewer` or `roles/iam.securityReviewer`)
  - Azure → `az` (built-in `Reader` or `Security Reader`)
  - On-prem → file read access, optionally `kubectl`

## Usage

Grab the command from **LytHouse → Environment → your connection**. It looks like:

```bash
npx @lythouse/collector --provider aws --token <token> --endpoint <url>
```

Provider-specific:

```bash
# AWS — IAM policies + security groups
npx @lythouse/collector --provider aws --token <token> --endpoint <url>

# GCP — project IAM + firewall rules
npx @lythouse/collector --provider gcp --token <token> --endpoint <url> --project my-project

# Azure — RBAC + network security groups
npx @lythouse/collector --provider azure --token <token> --endpoint <url>

# On-prem — local config files, optionally live Kubernetes
npx @lythouse/collector --provider onprem --token <token> --endpoint <url> \
  --sources /etc/ssh/sshd_config,/etc/nginx/nginx.conf --kube
```

Add `--dry-run` to see exactly what would be pushed without sending anything.

## Schedule it

Run it on a cron / CI schedule to keep LytHouse's view of your environment
current — every run replaces the previous inventory for that connection, so
posture stays live.
