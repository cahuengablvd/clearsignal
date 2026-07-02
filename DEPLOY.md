# Deployment Checklist

## Before Any Deploy

- [ ] `npm test` passes locally
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds
- [ ] No ASCII-unsafe code. Windows CP1251 rule: use `\u` escapes for non-ASCII in source.

## Vercel (Frontend)

- Automatic on `main` branch push.
- Check Vercel dashboard: build success, deployment live.

## Trigger.dev (Backend / Generation)

**CRITICAL: Always deploy from `C:\csdeploy` (no-space path).**

```powershell
cd C:\csdeploy
git pull origin main
npx trigger.dev@latest deploy
```

Wait for:

```text
Successfully deployed version 20260701.X
```

Verify deployments:

```text
https://cloud.trigger.dev/projects/v3/proj_asmgraqylwwxozdsmmjx/deployments
```

## Supabase (Migrations)

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
