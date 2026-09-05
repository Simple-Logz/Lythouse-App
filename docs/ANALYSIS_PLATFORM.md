# Lythouse Analysis Platform

Lythouse separates the customer-facing control plane from repository analysis execution.

## Runtime

`Run Analysis -> Orchestrator -> Queue -> Isolated Worker -> Understand -> Investigate -> Resolve -> Persist -> UI`

The web application never executes an untrusted customer repository. The control plane creates an immutable analysis run and queues work. A worker leases one job, executes it in an isolated ephemeral sandbox, persists evidence/results, and exits. Workers are horizontally scalable and disposable.

## Stage 1 — Understand

Build the Lythouse Application Model from repository evidence. Collect repository structure, manifests, source/configuration metadata, CI/CD, IaC, tests, migrations, APIs, data/auth surfaces and deployment configuration. Extract components and evidence-backed relationships. Do not infer unsupported runtime topology.

Output: `application_components`, `intelligence_relationships`, `intelligence_evidence`.

## Stage 2 — Investigate

Run deterministic analyzers and specialist investigators against the Application Model. Investigators may include code, security, architecture, infrastructure, DevOps, QA, dependency, vendor, reliability and cost specialists. External claims must come from supplied authoritative evidence. A cross-domain reasoning pass connects evidence across components.

Customer-facing domains remain exactly: Code, Infrastructure, DevOps, QA, Cost, Dependencies, Vendor Intelligence.

Output: normalized `intelligence_findings`. Every non-PASS conclusion carries evidence, confidence, impact, recommendation and verification criteria. Missing evidence becomes `needs_investigation` or `not_evaluated`, never invented certainty.

## Stage 3 — Resolve

Classify each finding into one safe disposition:

- `fix_in_lythouse`: repository/configuration change can be safely proposed and verified in an isolated branch/sandbox.
- `guided_fix`: Lythouse can prescribe the remediation but should not execute it automatically.
- `create_incident`: resolution requires production access, another team, runtime investigation, organizational action, or evidence unavailable to repository analysis.

Automated fixes must pass a verification plan before a PR can be proposed. AI never silently overrides the deterministic release verdict.

## Worker contract

Workers lease `analysis_jobs`; they do not accept arbitrary browser-originated execution commands. A production worker must enforce resource/time/network limits, use short-lived repository credentials, redact secrets from persisted artifacts, and destroy its sandbox after artifacts are persisted.

The initial control plane is implemented with Supabase/Postgres. Worker runtime can be container-backed, but a plain shared Docker daemon is not considered a sufficient security boundary for untrusted repository execution. The execution provider remains replaceable behind the worker contract.
