# Deployment Checklist

## Before Any Deploy

- [ ] `npm test` passes locally
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds
- [ ] No ASCII-unsafe code. Windows CP1251 rule: use `\u` escapes for non-ASCII in source.

## Vercel (Frontend)

- Automatic on `main` branch push.
- Check Vercel dashboard: build success, deployment live.
- Verify production env:
  - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set.
  - `FREE_SCORE_DAILY_LIMIT` is set to the desired daily free-score cap.
  - `MONITORING_SIGNUP_ENABLED` is unset or `false` until monitoring is paid/approved.
  - `MONITORING_SIGNUP_DAILY_LIMIT` is set before enabling monitoring signup.
  - `AUTO_DELIVER_AUDITS` is unset or `false`.
  - `QUALITY_CRITIC_ENABLED` is unset or `false` unless intentionally sampling shadow critic.
  - `NOTIFY_WEBHOOK_URL` is set for paid-audit/admin-auth alerts.

## Trigger.dev (Backend / Generation)

**CRITICAL: Always deploy from `C:\csdeploy` (no-space path).**

**Pin the CLI to the SDK version in `package.json` — never `@latest`.** The CLI aborts when its
version differs from the installed `@trigger.dev/*` packages. Working around that by bumping the
SDK inside `C:\csdeploy` (as happened before 2026-07-24, leaving the worker on an SDK version
absent from the repo) is how the deploy silently drifts from `main`.

```powershell
cd C:\csdeploy
git pull origin main
npx trigger.dev@4.4.6 deploy   # the version from package.json, not @latest
```

Wait for:

```text
Successfully deployed version 20260701.X
```

Verify deployments:

```text
https://cloud.trigger.dev/projects/v3/proj_asmgraqylwwxozdsmmjx/deployments
```

Trigger workers must be deployed after every code push that touches `lib/audit-*`,
`lib/report-*`, `lib/quality/*`, `trigger/*`, or prompt/cost code. GitHub/Vercel
deploy does not update Trigger workers.

Verify Trigger env matches Vercel for:

```text
ANTHROPIC_API_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
FIRECRAWL_API_KEY
RESEND_API_KEY
RESEND_FROM
NEXT_PUBLIC_BASE_URL
NOTIFY_WEBHOOK_URL
ACCESS_TOKEN_SECRET
TRIGGER_SECRET_KEY
TRIGGER_PROJECT_ID
AUTO_DELIVER_AUDITS=false
QUALITY_CRITIC_ENABLED=false
AUDIT_AI_COST_ALERT_USD
AUDIT_AI_CALL_ALERT_COUNT
ANTHROPIC_BALANCE_ALERT_THRESHOLD
MONTHLY_BUDGET_USD
ADMIN_ALERT_EMAIL
ADMIN_EMAIL
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
USE_ANTHROPIC_ADMIN_BALANCE=false
ANTHROPIC_ADMIN_API_KEY
ANTHROPIC_USAGE_REPORT_URL
PERPLEXITY_API_KEY
OPENAI_API_KEY
```

Do not set `TRIGGER_VERSION`: Trigger uses it to lock task runs to a specific deployment version.
The running task records its own deployment version from the Trigger run context instead.

## Supabase (Migrations)

**Any change that adds a column to a query must include and apply its migration before the code ships.**
The authorized `/api/health` response checks the columns selected by the admin audit query, but it
is a diagnostic, not a migration runner.

List pending migrations:

```powershell
supabase migration list
```

Apply migrations only after manually reviewing SQL in Supabase dashboard:

```powershell
supabase migration up
```

## Golden Report Fixture

The golden regression test expects:

```text
tests/fixtures/golden-report-az-moving.json
```

Export it from Supabase from the latest known-good AZ Moving audit:

```sql
select report
from audits
where url ilike '%az-moving%'
  and audit_status in ('done', 'delivered')
order by created_at desc
limit 1;
```

Save only the JSON value of `report` to the fixture file.

If the fixture is absent, `tests/golden-report.test.ts` skips golden-specific assertions.

## Post-Deploy Smoke Test

- [ ] Create test audit via admin UI or `/api/admin/audits/create`
- [ ] Check Trigger dashboard: run status is successful
- [ ] Verify report generated: `/audit/[id]`
- [ ] Download PDF
- [ ] Check footer: build hash and Trigger version are visible
- [ ] Confirm report has no client-facing validation artifacts
