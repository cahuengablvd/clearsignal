# TASKS_UNCHECKED_WRITES — a failed database write is indistinguishable from a successful one

Touches `lib/audit-*`, so it **needs a Trigger deploy from `C:\csdeploy`**.

## The problem

`@supabase/supabase-js` returns `{ error }` instead of throwing. Every `await supabaseAdmin...` that
ignores the result is a write that can fail in total silence. `lib/resend.ts:178` carries a comment
about exactly this behaviour, so the class is already known here — it just was never swept.

`R14` is the proof it happens: `lib/audit-runner.ts:861` upserts into `audit_insights`, a table that
was declared in `001_initial.sql` and never applied to production. That write has been a no-op for
the life of the project and nothing ever noticed.

The two most consequential writes in the system are in the same shape:

| Where | What it writes | Checked? |
|---|---|---|
| `lib/audit-runner.ts:842` | the finished report + `audit_status: 'awaiting_review'` | **no** |
| `lib/email-delivery.ts:22` | `audit_status: 'delivered'`, `last_delivered_at` | **no** |

If the first fails, generation burns its API spend and the report is lost with no error anywhere. If
the second fails after the email was sent, the customer has their report and our records say
undelivered — and the delivery path may run again.

## Fix

1. Sweep every `supabaseAdmin` `insert`/`update`/`upsert` in `lib/`, `app/api/` and `trigger/`.
   Capture `{ error }` and handle it. Do not blanket-throw: decide per call site.
   - **Writes that carry the product's state** — the report, `audit_status`, payment and delivery
     fields, `report_versions` — must fail loudly: log with the audit id and either throw or return
     a failure the caller already knows how to handle. A generation that could not persist its
     report is a failed generation, not a successful one.
   - **Telemetry-grade writes** — `audit_ai_call_logs`, cost rows, monitoring runs — may swallow the
     error, but must log it with enough context to find later. Never silently.
2. Prefer one small shared helper over 59 hand-written checks, so the next write inherits the
   behaviour instead of re-deciding it. Keep it thin: it should not hide which table failed.
3. Delete the dead `audit_insights` upsert and its block in `001_initial.sql`. Nothing reads that
   table anywhere in the repo. Do not create the table to make the write valid. This closes `R14`.
   (If `TASKS_SCHEMA_DRIFT.md` already removed it, skip this step rather than reverting anything.)

## Acceptance

- A test where the report-persisting update returns an error asserts the audit does **not** end in
  `awaiting_review` and the failure is surfaced. Failing test first.
- A test where the delivery update returns an error asserts the failure is logged and the audit is
  not silently left as delivered.
- A telemetry write that fails does not abort the audit, but does log the table name and audit id.
- `grep -rn audit_insights` returns nothing outside `docs/archive/` and the defect files.
- `npx tsc --noEmit`, `npm run build`, full vitest suite pass.

## Out of scope

Retries, queues, or transactional wrappers. This task is about noticing failure, not recovering from
it. Recovery already exists for audits (`lib/audit-recovery.ts`) and must not be reworked here.
