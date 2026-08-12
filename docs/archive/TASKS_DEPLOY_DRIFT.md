# TASKS_DEPLOY_DRIFT — nothing shows which engine version actually generated a report

Admin + report metadata. Touches `lib/audit-runner.ts`, so it **needs a Trigger deploy from
`C:\csdeploy`** before it means anything.

## The problem

The code runs in two places that update independently: Vercel auto-deploys `main`; Trigger.dev is
deployed by hand from `C:\csdeploy`. Between a push and that manual step, generation runs on old
code and nothing says so. This session hit it twice, and each detection cost a full
regenerate-and-inspect cycle.

**The report footer looks like it answers this, and does not.** `footerText`
(`lib/pdf-footer.ts:21`) is evaluated where the PDF is *rendered* — the web app on Vercel — not
where the report was *generated*:

```
Build: ba6af93 | Version: ba6af93
```

`buildHash()` reads the renderer's git HEAD, and `TRIGGER_VERSION` is unset there so `version` falls
back to the same Vercel commit. Both numbers describe the renderer. A report generated on Trigger
`20260810.1` and re-rendered today prints today's commit twice — which is exactly what made the
first PDF in this session look current while carrying stale data.

## Fix

1. **Record the generating worker's identity on the audit row at generation time.** In
   `runFullAudit`, capture `process.env.TRIGGER_VERSION` (and the worker's commit if available) and
   persist it with the report — `report.meta` already carries generation metadata, so put it there
   rather than adding a column.
2. **Show it in `/admin`, next to the current app commit.** Each audit row already shows
   `last_generated_at`; add the engine version that produced it. When it differs from the version
   the current worker would use, mark the row — the operator must be able to see "this report came
   from an older engine" without opening the Trigger dashboard.
3. **Surface the pair in `/api/health`.** `deploymentInfo()` (`app/api/health/route.ts:91`) reports
   only the Vercel commit. Add the most recent generation's engine version so one request answers
   "are the two halves in sync?".
4. **Make the footer honest.** Either label the two numbers for what they are (renderer build vs
   generating engine) or print the stored generation version instead of the renderer's. Do not leave
   a footer that implies the engine version when it prints the renderer's.

## Acceptance

- A report generated with `TRIGGER_VERSION` set stores that value and renders it unchanged after a
  later re-render on a different app commit. Failing test first.
- `/admin` shows the generating engine version per audit and visibly marks one that does not match
  the current worker.
- `/api/health` returns both the app commit and the latest generation's engine version.
- No test asserts the footer's old shape in a way that hides the renderer/engine distinction.
- `npx tsc --noEmit`, `npm run build`, full vitest suite pass.

## Out of scope

Automating the Trigger deploy, or deploying it from CI. The manual step stays; this task only makes
the resulting drift visible.
