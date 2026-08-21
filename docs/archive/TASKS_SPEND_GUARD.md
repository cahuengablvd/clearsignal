# TASKS_SPEND_GUARD — the cost guard watches one audit and is blind to twenty

**Defect:** `R34`. Touches `lib/ai-observability.ts`, the queue and `trigger/`, so it **needs a
Trigger deploy from `C:\csdeploy`.** A migration may be needed (see step 1); apply it in the same
step, per the `R23` rule.

**This lands before regular generation resumes.** It is a financial safeguard, not a feature.

## What happened

2026-08-20: Anthropic credits ran out during a day of verification regenerations. No alert fired at
any point, and the operator learned about it from the provider, not from us.

`reconcileAuditAiCost` (`lib/ai-observability.ts:84`) alerts when a **single** audit passes
`AUDIT_AI_COST_ALERT_USD` (default `$2.50`) or `AUDIT_AI_CALL_ALERT_COUNT` calls. Every run stayed
near `$1`, so nothing tripped while 15-20 generations accumulated in a day.
`MONTHLY_BUDGET_USD` and `ANTHROPIC_BALANCE_ALERT_THRESHOLD` exist in `lib/anthropic-balance.ts`
but depend on the admin balance API, which is off in production
(`USE_ANTHROPIC_ADMIN_BALANCE=false`).

Two multipliers made that day worse. `R33` re-enqueued queued audits, so some ran twice — fixed.
`trigger/audit-task.ts:33` sets `maxAttempts: 2`, so a deterministic failure generates twice, and
failures land at the action stage, after the scrape and the whole GEO scan: a failed audit costs
nearly a successful one.

## Fix

1. **A daily aggregate spend cap that stops the queue.** Sum `estimated_cost_usd` from
   `audit_ai_call_logs` for the current UTC day. Above the cap, refuse to start a new generation:
   the enqueue path fails closed with a clear reason, the audit stays `queued`, and the operator is
   notified once. A warning that arrives after the money is gone is what we already have.
   - Default the cap from an env var (`DAILY_AI_SPEND_CAP_USD`), with a conservative built-in
     default. Name the default in `DEPLOY.md`.
   - Reads must not scan the whole table on every enqueue; index or filter by day.
2. **Retries count against the same budget.** A second attempt is a second full cost. Whatever
   surface reports spend — the admin row, the health route — must show the audit's true total,
   including recovery and platform retries, not one logical audit's worth.
3. **No retry for known-deterministic errors — classified, not blanket.** Do not lower
   `maxAttempts` blindly: transient provider failures are exactly what it is for. Use the existing
   classifier (`isDeterministicAuditFailure`, `lib/audit-recovery.ts:40`) at the task level and skip
   the retry only for that class.
4. **Surface today's spend where the operator already looks.** One line in `/admin` and in
   `/api/health`: spend today, the cap, and whether the queue is currently blocked.

## Acceptance

Each starts as a failing test.

- With logged spend above the cap, enqueueing a new audit is refused, the audit is not started, and
  the refusal reason names the cap and the current total.
- With spend below the cap, enqueue proceeds unchanged.
- A run that retries once reports the summed cost of both attempts, not one.
- A deterministic failure is not retried at the task level; a transient failure still is.
- `/api/health` reports today's spend and the cap.
- `npx tsc --noEmit`, `npm run build`, full vitest suite pass.

## Out of scope

Per-customer billing, cost prediction, model downgrades, or changing what an audit does. This task
only stops spending money that was not authorised.
