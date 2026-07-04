# ClearSignal System Analysis

## 1. Verdict

Not safe to scale paid selling yet; safe only for tightly watched test sales. Top risks: (1) Stripe webhook idempotency is check-then-insert without a unique `stripe_session`, so concurrent retries can create duplicate paid audits; (2) admin regeneration can reuse stale completed stage outputs because stage completion lookup ignores generation version/attempt; (3) public free/monitoring surfaces can spend vendor credits if persistent rate limiting is missing or bypassed. Core generation is much safer than before: Trigger queueing, stage locks, validation degradation, cost logs, and operator-gated delivery are present.

## 2. Findings table

| ID | severity | area | one-line summary |
|---|---|---|---|
| F-01 | blocker | money path | Stripe webhook idempotency is not DB-enforced; duplicate events can create duplicate paid audits. |
| F-02 | high | money path | Stripe retry for an existing `paid` row returns before enqueue/status repair. |
| F-03 | high | failure/recovery | Admin re-generation can reuse old completed stage outputs instead of regenerating. |
| F-04 | high | config parity | Vercel deploy and Trigger worker deploy are separate; pushed code may not update paid audit workers. |
| F-05 | high | cost burn | Public monitoring signup creates active recurring GEO scans without payment/auth. |
| F-06 | high | cost burn | Free score endpoint spends Firecrawl + Claude/GEO and rate limits degrade to per-instance memory. |
| F-07 | high | security | Admin password endpoint has no rate limit or lockout. |
| F-08 | high | money path | `AUTO_DELIVER_AUDITS=true` bypasses operator review and is undocumented in env example. |
| F-09 | medium | cost/recovery | Firecrawl target/competitor scrapes are outside stage locks, so retries repeat them. |
| F-10 | medium | failure/recovery | Stage lock TTL exceeds Trigger task maxDuration, causing retry/active-lock timing risk. |
| F-11 | medium | security/data | Supabase migrations create tables without RLS policies; current safety relies on service-role-only access. |
| F-12 | medium | config parity | Many production env vars are read in code but absent from `.env.local.example` / deploy docs. |
| F-13 | medium | security/cost | Public URL inputs are only `z.string().url()` and can trigger paid scraping/engine calls for arbitrary URLs. |
| F-14 | low | observability/privacy | Webhook logs customer email and URL metadata. |
| F-15 | low | known debt | `BROKEN_TEXT_REPAIRS` regex repair layer remains active in multiple validator paths. |
| F-16 | low | dependencies | `npm audit` reports 37 advisories, including 1 critical dev advisory and 10 high advisories. |

## 3. Findings detail

**F-01 - blocker - money path - Stripe webhook idempotency is not DB-enforced.**
Evidence: webhook checks existing row by `stripe_session` before insert at `app/api/stripe/webhook/route.ts:51`-`55`, then inserts at `app/api/stripe/webhook/route.ts:86`-`100`. Migration creates only a non-unique index at `supabase/migrations/001_initial.sql:48`-`49`.
Expected impact: concurrent Stripe deliveries can both miss the pre-check, insert two paid audits for one payment, enqueue two Trigger runs, and burn duplicate API credits.
Suggested fix (S): add a unique partial index on non-null `audits.stripe_session` and use upsert/insert-on-conflict.

**F-02 - high - money path - Existing paid webhook rows return before enqueue repair.**
Evidence: an existing row with `payment_status === 'paid'` returns immediately at `app/api/stripe/webhook/route.ts:69`-`70`; enqueue happens later at `app/api/stripe/webhook/route.ts:113`-`125`.
Expected impact: if a paid row exists but enqueue did not happen or status is still repairable (`queued`/`failed`), Stripe retry will not re-enqueue; recovery is the only safety net.
Suggested fix (S): in existing-row branch, check `audit_status` first and enqueue/mark queued for `queued`/`failed` before returning.

**F-03 - high - failure/recovery - Re-generation can reuse old stage outputs.**
Evidence: admin regeneration resets `recovery_attempts` to 0 at `app/api/audit/route.ts:39`-`47`. Stage claim returns any completed row for `audit_id + stage` without filtering `attempt` at `supabase/migrations/009_audit_ai_execution_logging.sql:68`-`76`. `runAuditStage` returns already-completed results at `lib/audit-execution.ts:62`-`64`.
Expected impact: admin "Re-generate" can rebuild a report from stale prior Claude outputs instead of fresh analysis, giving false confidence during customer fixes.
Suggested fix (M): add a generation/run id to stage execution keys or clear/namespace stage rows on intentional regeneration.

**F-04 - high - config parity - Trigger workers are not deployed by GitHub push.**
Evidence: Vercel deploy is automatic on `main` at `DEPLOY.md:10`-`13`, but Trigger deploy is a separate manual command from `C:\csdeploy` at `DEPLOY.md:15`-`23`. Paid audits call Trigger when `TRIGGER_SECRET_KEY` exists at `lib/audit-queue.ts:20`-`31`.
Expected impact: production web app can run new code while paid audit workers run old code, so fixes/validators may not apply to paid audits.
Suggested fix (M): add CI/deploy automation or a release checklist gate that verifies Trigger deployment version after every push.

**F-05 - high - cost burn - Public monitoring signup creates recurring billable work.**
Evidence: `/api/monitoring` is unauthenticated and creates a tokenized monitor at `app/api/monitoring/route.ts:14`-`31`. `createMonitoredSite` inserts `status: 'active'` and `next_run_at: now()` at `lib/monitoring.ts:218`-`229`. Daily cron processes up to 100 due sites at `trigger/monitoring-task.ts:8`-`15` and `lib/monitoring.ts:188`-`203`.
Expected impact: public users can create recurring GEO scans without payment; even with rate limits, accumulated sites can drive daily API spend.
Suggested fix (M): require payment/admin for monitoring creation or add verified email/payment state before `status='active'`.

**F-06 - high - cost burn - Free score spend surface depends on best-effort limits.**
Evidence: `/api/score` states it spends credits at `app/api/score/route.ts:58`-`60`, then calls Firecrawl and Claude/GEO at `app/api/score/route.ts:74`-`127`. Upstash failure falls back to in-memory limiter at `lib/rate-limit.ts:58`-`71`.
Expected impact: without Upstash or under cold-start/multi-instance traffic, attackers can rotate email/IP and force Firecrawl + Anthropic spend.
Suggested fix (M): make Upstash required in production for spend endpoints and add a daily global budget/kill switch for free scores.

**F-07 - high - security - Admin login has no rate limit.**
Evidence: admin auth reads password and compares it at `app/api/admin/auth/route.ts:15`-`23`; no `enforceRateLimits` call appears in that route. Admin cookie grants access via `lib/auth.ts:12`-`21`.
Expected impact: weak/reused `ADMIN_PASSWORD` can be brute-forced online, exposing reports and spend-capable admin endpoints.
Suggested fix (S): add IP/password-attempt rate limits and alerting to `/api/admin/auth`.

**F-08 - high - money path - `AUTO_DELIVER_AUDITS` can bypass manual review.**
Evidence: generation auto-sends email when `AUTO_DELIVER_AUDITS === 'true'` at `lib/audit-runner.ts:807`-`810`. `.env.local.example` lists env vars at `.env.local.example:1`-`27` but does not list `AUTO_DELIVER_AUDITS`.
Expected impact: a production env typo/legacy setting can deliver unreviewed paid reports to customers.
Suggested fix (S): remove the auto-delivery path or require an explicit non-production guard/admin allowlist.

**F-09 - medium - cost/recovery - Firecrawl scrapes are outside stage locks.**
Evidence: target and competitor scrapes happen at `lib/audit-runner.ts:429`-`448` before first locked Claude stage at `lib/audit-runner.ts:517`-`537`.
Expected impact: Trigger retry/recovery repeats target and competitor Firecrawl calls even when later Claude stages are already stage-locked.
Suggested fix (M): stage-lock `target_scrape` and competitor scrape results or persist scrape snapshots per generation.

**F-10 - medium - failure/recovery - Stage lock TTL is longer than task max duration.**
Evidence: claim RPC default TTL is 1800 seconds at `supabase/migrations/009_audit_ai_execution_logging.sql:52`-`59`; Trigger audit task maxDuration is 600 seconds at `trigger/audit-task.ts:15`-`20`; stale processing recovery starts after 20 minutes at `lib/audit-recovery.ts:14`-`16`.
Expected impact: a killed worker can leave a running stage lock active past Trigger retry windows; retries may fail as "already active" until TTL expiry.
Suggested fix (M): align stage TTL with task timeout/retry cadence or renew/clear locks on task failure.

**F-11 - medium - security/data - RLS is absent in migrations.**
Evidence: core tables are created at `supabase/migrations/001_initial.sql:3`-`46` and monitoring tables at `supabase/migrations/002_monitoring.sql:3`-`32`; search found no `enable row level security` or `create policy`. Server uses service role at `lib/supabase.ts:5`-`12`.
Expected impact: current code is server-only, but any future client-side anon Supabase usage would expose tables unless RLS is added first.
Suggested fix (M): enable RLS and explicit deny-by-default policies on all product tables before adding any anon client.

**F-12 - medium - config parity - Env docs are incomplete.**
Evidence: code reads cost/alert/quality/delivery vars at `lib/anthropic-balance.ts:20`-`30`, `lib/anthropic-balance.ts:78`-`79`, `lib/audit-runner.ts:809`, and `lib/quality/critic.ts:33`-`34`; `.env.local.example:1`-`27` omits these.
Expected impact: Vercel/Trigger parity is hard to verify; missing vars silently disable alerts or accidentally enable dangerous behavior.
Suggested fix (S): update `.env.local.example` and `DEPLOY.md` with required/optional vars per runtime.

**F-13 - medium - security/cost - Public URL inputs can trigger arbitrary paid fetches.**
Evidence: score accepts `url: z.string().url()` at `app/api/score/route.ts:35`-`40` and scrapes it at `app/api/score/route.ts:74`-`80`; monitoring accepts URL similarly at `app/api/monitoring/route.ts:7`-`12`; paid audit scrapes submitted URL at `lib/audit-runner.ts:429`.
Expected impact: users can spend crawler/API resources on arbitrary hosts; Firecrawl reduces server-side SSRF risk but not cost/abuse risk.
Suggested fix (M): add hostname/IP allow/deny checks, max redirects/content rules, and domain-level abuse controls.

**F-14 - low - observability/privacy - Webhook logs customer PII.**
Evidence: webhook logs session id and metadata email/url at `app/api/stripe/webhook/route.ts:47`-`48`.
Expected impact: production logs contain lead/customer email and audited URL, increasing privacy exposure during support/debug exports.
Suggested fix (S): log audit id/session suffix only and avoid raw email/url.

**F-15 - low - known debt - Regex repair layer remains broad and active.**
Evidence: `BROKEN_TEXT_REPAIRS` is exported at `lib/trust-phrases.ts:30`; validator applies it in at least two paths at `lib/report-validator.ts:349` and `lib/report-validator.ts:460`.
Expected impact: deterministic cleanup is useful but broad regex repairs remain a quality-maintenance risk as prompts evolve.
Suggested fix (M): replace regex families with scoped rule tests or retire patterns covered by Phase 1 validators.

**F-16 - low - dependencies - `npm audit` has unresolved advisories.**
Evidence: direct versions include `@anthropic-ai/sdk` at `package.json:16`, `@trigger.dev/sdk` at `package.json:20`, `next` at `package.json:28`, `undici` at `package.json:38`, and `vitest` at `package.json:42`. `npm audit --json` reported 37 total advisories.
Expected impact: mostly dependency hygiene; top advisories include Vitest critical dev server issue, Next SSRF/cache advisories, and Trigger/OpenTelemetry/systeminformation chain.
Suggested fix (M): schedule dependency update pass; prioritize production deps before dev-only Vitest.

## 4. Unverified suspicions

- A missing Trigger.dev deployment after the latest GitHub push may already mean production paid workers are behind the web app; verify in Trigger dashboard.
- The Stripe webhook existing-row branch may be safe enough if recovery is always healthy, but code evidence shows Stripe itself will not re-enqueue paid existing rows.
- Monitoring may be intentionally pre-revenue/demo-only; if not sold publicly, its public creation route is a cost liability.
- `AUTO_DELIVER_AUDITS` may not be set in production; if unset, operator review remains enforced.
- `.env.local` exists locally but was not opened to avoid reading secrets.

## 5. What was NOT analyzed and why

- Live Vercel, Trigger.dev, Stripe, Supabase, Resend, Firecrawl, Anthropic, OpenAI, and Perplexity dashboards were not inspected; this audit is code/local-repo only.
- Real production environment variable values were not inspected; report uses code and example/deploy docs only.
- No live payment, webhook replay, email send, PDF render, or Trigger run was executed to avoid spending money or changing production data.
- No secrets scan beyond filename/path and grep patterns was performed; `.env.local` was intentionally not read.
- No Phase 3 repair-engine design review was performed because Phase 3 is not implemented.

## 6. Commands run + outputs summarized

- `git status --short`: clean before analysis.
- `rg` route/migration/env/call-site scans: identified API routes, migrations 001-010, env reads, callClaudeJSON/Firecrawl/GEO call sites, skipped tests, and no RLS policy statements.
- `tsc --noEmit --incremental false`: passed with exit code 0.
- `vitest run --no-cache`: passed; 8 test files passed, 1 skipped; 170 tests passed, 13 skipped. Skips are fixture-gated optional vertical fixtures in `tests/golden-report.test.ts:14` and `tests/golden-report.test.ts:212`, plus disabled live shadow critic run in `tests/quality-critic-shadow.test.ts:15`.
- `npm audit --json`: first PowerShell `npm.ps1` was blocked by execution policy; rerun via npm CLI required network approval and completed. Summary: 37 total vulnerabilities: 1 critical, 10 high, 24 moderate, 2 low. Top 3 practical advisories by direct/prod relevance: `next` SSRF/cache/XSS family, `undici` high TLS/header/WebSocket issues, `@anthropic-ai/sdk` moderate filesystem-memory-tool issues. Dev-only top advisory: `vitest` critical UI server file read/execute.
