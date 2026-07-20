# LytHouse — Launch Readiness Checklist

Stack: **Vite + React SPA** hosted on Vercel, backed by **Supabase** (Postgres + Auth + Edge Functions).
Secrets live in **Supabase Edge Function secrets**, never in the frontend bundle.

Legend: ✅ done in repo · 🟡 in progress · ⬜ to do (code) · 👤 your action (dashboard/account, no code)

---

## 1. Security & tenant isolation  ← FOUNDATION
- ✅ Tenant-scoped RLS migration written (`supabase/migrations/20260720000000_reenable_tenant_rls.sql`) — replaces the wide-open `anon USING(true)` policies with authenticated, workspace-membership-scoped ones.
- ✅ `.env` removed from git tracking; `.gitignore` + `.env.example` added.
- 👤 **Rotate the Supabase service-role key** (it was committed to git history — treat as compromised).
- 👤 Apply the RLS migration to a **staging** Supabase branch, run the isolation test (two users / two workspaces can't see each other), then production.
- ⬜ Add RLS to remaining enterprise tables (compliance_scans, incidents, integrations, server_*) — templates in the migration.
- ⬜ Move integration tokens to **encrypted** storage (Edge Function encrypt/decrypt with `ENCRYPTION_KEY`); never return tokens to the browser.
- 👤 Supabase: enable backups, connection pooling (pgbouncer), point-in-time recovery.

## 2. Authentication lifecycle
- ✅ Login / signup / logout (existing).
- ✅ Password reset — "Forgot password?" flow + `/reset-password` page (auth.tsx `resetPassword`/`updatePassword`).
- ✅ Resend-verification helper in auth layer (`resendVerification`).
- ⬜ Wire resend-verification button into the "check your email" screen.
- ⬜ Workspace invitations: send, accept/decline, remove member.
- ⬜ Role-based authorization (Owner/Admin/Developer/Approver/Viewer) enforced in UI **and** RLS.
- ⬜ Account deletion + data export.
- ⬜ Session refresh/expiry UX.
- 👤 Supabase Auth: set production redirect/callback URLs (`https://app.lythouse.ai/...`), configure email templates, enable rate-limiting.
- 👤 (Enterprise) SSO/SAML, MFA.

## 3. Billing & plan enforcement
- ⬜ Stripe Edge Functions: `stripe-checkout` (create session) + `stripe-webhook` (handle `checkout.session.completed`, `customer.subscription.*`, `invoice.*`). (Function folders exist — need real implementation + deploy.)
- ⬜ **Backend** plan enforcement: gate paid features server-side (Edge Function + RLS on entitlements), not just hidden UI.
- ⬜ Billing portal link, upgrade/downgrade, cancellation, failed-payment handling, invoice history.
- 👤 Stripe account: live keys, products/prices (monthly/annual), trial rules, tax settings, live webhook endpoint.

## 4. Legal / trust + observability
- ⬜ Pages: Terms of Service, Privacy Policy, Cookie notice, Acceptable Use, Security, Data-deletion, Subprocessors, Support contact.
- ⬜ Sentry (or similar) error tracking wired behind `VITE_SENTRY_DSN`.
- ⬜ Enterprise data-handling answers (what's collected, retention, token encryption, deletion on GitHub disconnect, AI-training stance).
- 👤 Transactional email provider (Resend/Postmark) + SPF/DKIM/DMARC DNS.
- 👤 Uptime/status page, alert routing.

## Domain & infra (your side)
- 👤 Buy domain; connect `lythouse.ai`, `www`, `app` (and later `api`) in Vercel.
- 👤 Create Vercel env-var sets for **Development / Preview / Production** (client `VITE_*` only; secrets go to Supabase, not Vercel).
- 👤 Protect `main`: Preview deploys for branches/PRs; promote tested previews to Production.

## Suggested launch stages
1. **Private beta (5–15 users):** #1 security + #2 core auth + real GitHub validation + error tracking + basic email. No public payments yet.
2. **Paid public beta:** add #3 billing + enforcement + docs + background jobs.
3. **Enterprise:** SSO/SCIM, audit logs, data-retention controls, security docs, SLAs.

## Not yet built (bigger infra — flagged for honesty)
- Background job/worker system for long validations (Vercel functions time out; needs a queue + worker).
- Isolated/sandboxed execution for inspecting untrusted customer repos.
- These are Paid-beta/Enterprise-stage items, not private-beta blockers.
