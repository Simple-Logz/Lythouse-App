# Production hardening status

## Implemented in repository
- Plan entitlement RPC checks gate protected actions.
- Session refresh and expiry state exist in the auth provider.
- Integration credentials are encrypted by the integration-secrets Edge Function.
- `api-test-executor` provides authenticated, workspace-scoped, plan-gated, HTTPS-only, allowlisted, timeout-bounded, non-destructive real HTTP baseline testing with audit recording.
- Load and chaos execution remain blocked until an isolated authorized executor exists.
- Vitest and Playwright foundations exist and the quality gate runs tests, build, lint and browser smoke checks.

## External production operations
These cannot be completed by a source commit: rotate production secrets; configure Supabase backups/PITR/auth settings; deploy Edge Functions and set `API_TEST_ALLOWED_HOSTS`; configure Stripe live products/prices/webhooks; configure SPF/DKIM/DMARC and monitoring destinations; provision SSO/SAML/SCIM.

## Required production proof
Run two-user/two-workspace RLS isolation against the deployed Supabase project, exercise GitHub webhooks/checks against an authorized test repository, benchmark labelled known-good/known-bad repositories, stress the worker with large repositories, and execute the full Connect -> Sync -> Validate -> Finding -> Fix -> Revalidate -> Release E2E with dedicated test credentials.
