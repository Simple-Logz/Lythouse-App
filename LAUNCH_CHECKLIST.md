# LytHouse — Launch Readiness Checklist

Stack: **Vite + React SPA** hosted on Vercel, backed by **Supabase** (Postgres + Auth + Edge Functions).
Secrets live in **Supabase Edge Function secrets**, never in the frontend bundle.

Legend: ✅ done in repo · 🟡 in progress · ⬜ to do (code) · 👤 your action (dashboard/account, no code)

---

## 1. Security & tenant isolation  ← FOUNDATION
- ✅ Tenant-scoped RLS migration written (`supabase/migrations/20260720000000_reenable_tenant_rls.sql`) — replaces the wide-open `anon USING(true)` policies with authenticated, workspace-membership-scoped ones.
- 🟡 Secret hygiene — `.env.example` added, but `.env` is STILL committed for now because the Vercel build reads it. Correct sequence: (1) set the `VITE_*` vars in the Vercel dashboard → (2) confirm a deploy works → (3) `git rm --cached .env` + gitignore it → (4) rotate keys.
- 👤 **Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_GITHUB_CLIENT_ID` in Vercel** (Settings → Environment Variables, Production + Preview) — these are public values, safe to store there.
- 👤 **Rotate the Supabase service-role key** (it's in git history — treat as compromised) — do this once the app no longer depends on the committed `.env`.
- 👤 Apply the RLS migration to a **staging** Supabase branch, run the isolation test (two users / two workspaces can't see each other), then production.
- ✅ Add RLS to remaining enterprise tables (compliance_scans, incidents, integrations, dora_metrics, environment_drift, ai_insights, server_*/validation_*/discovery set) — `supabase/migrations/20260721030000_rls_hardening.sql` (dynamic, member-scoped; deployment_policies + integrations tightened to admin-only writes).
- ⬜ Move integration tokens to **encrypted** storage (Edge Function encrypt/decrypt with `ENCRYPTION_KEY`); never return tokens to the browser. (RLS now hides integration rows from non-admins; encryption-at-rest still to do.)
- 👤 Supabase: enable backups, connection pooling (pgbouncer), point-in-time recovery.

## 2. Authentication lifecycle
- ✅ Login / signup / logout (existing).
- ✅ Password reset — "Forgot password?" flow + `/reset-password` page (auth.tsx `resetPassword`/`updatePassword`).
- ✅ Resend-verification helper in auth layer (`resendVerification`).
- ✅ Wire resend-verification button into the "check your email" screen (AuthPage).
- ✅ Workspace invitations: pending-invite flow with shareable link, revoke, and `accept_invitation` RPC (`workspace_invitations` table + AcceptInvitePage + `/invite/:token`). Works even if the invitee has no account yet.
- ✅ Role-based authorization (Owner/Admin/Developer/Approver/Viewer) enforced in UI (`src/lib/roles.ts` + `useRole`) **and** RLS (role CHECK, `is_workspace_admin`/`is_workspace_approver`, admin-only writes on sensitive tables).
- ✅ Account deletion (`delete-account` Edge Function, sole-owner guard) + data export (client JSON download) in Settings → Security.
- ⬜ Session refresh/expiry UX.
- 👤 Supabase Auth: set production redirect/callback URLs (`https://app.lythouse.ai/...`), configure email templates, enable rate-limiting.
- 👤 (Enterprise) SSO/SAML, MFA.

## 3. Billing & plan enforcement
- ✅ Stripe Edge Functions: `stripe-checkout` (now carries `workspace_id` + admin authz + subscription metadata) and `stripe-webhook` (now maps the Stripe subscription → `workspace_plans` via price→plan env map). New `stripe-portal` function for the billing portal.
- ✅ **Backend** plan enforcement: Free-plan limits enforced in the DB via BEFORE INSERT triggers (`enforce_project_limit`, `enforce_validation_limit`) + `current_plan()` helper — not just hidden UI. (`20260721020000_billing_plan_enforcement.sql`)
- ✅ Billing portal link (Manage billing → Stripe portal handles upgrade/downgrade, cancellation, invoice history); PlansPage wired to real checkout + gated by `billing.manage`; cancel-at-period-end banner.
- 👤 Stripe account: live keys, products/prices (set `VITE_STRIPE_PRICE_*` client-side + `STRIPE_PRICE_DEVELOPER`/`STRIPE_PRICE_ENTERPRISE` in Edge Function secrets), trial rules, tax settings, live webhook endpoint. Deploy the three stripe-* functions + delete-account.

## 4. Legal / trust + observability
- ✅ Pages: Terms, Privacy, Security, Acceptable Use, Cookies, Data-deletion, Subprocessors — public routes (`/terms`, `/privacy`, …), tailored to a code-connected tool, with a counsel-review banner. Linked from the landing footer + signup. **Have counsel review before relying on them.**
- ✅ App-wide ErrorBoundary — crashes show a recovery screen (Reload / Go home) instead of a blank page; `window.__errorReporter` hook ready for Sentry.
- ⬜ Wire an actual Sentry DSN (`window.__errorReporter`) when you have an account.
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
