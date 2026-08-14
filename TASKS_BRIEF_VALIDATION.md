# TASKS_BRIEF_VALIDATION — one empty list in one brief destroys the whole audit

**Defect:** `R27` (LAUNCH BLOCKER — a paid audit produces no deliverable at all).
Touches `lib/report-validator.ts` and `lib/audit-runner.ts`, so it **needs a Trigger deploy from
`C:\csdeploy`.**

## What happened

2026-08-14, audit of `vertexspain.com` (a real prospect's site, run as a favour):

```
Audit generation failed: Report validation blocked PDF export:
  empty_field at implementation_briefs.4.acceptance_criteria
[10 seconds later, the recovery retry]
Audit generation failed: Report validation blocked PDF export:
  empty_field at implementation_briefs.4.acceptance_criteria
```

No PDF, no web report, no partial delivery. The audit had already spent its API budget. The only
thing missing was the "Done when …" list in the fifth of five implementation briefs.

## Root cause: three rules in the same file disagree

| Location | Rule | Verdict for a brief with steps but no acceptance criteria |
|---|---|---|
| `lib/report-validator.ts:908` | repair keeps a brief with a title **and (steps or acceptance)** | **keeps it** |
| `lib/report-validator.ts:938` | `validateActionUsability` errors only when **both** are empty | **passes** |
| `lib/report-validator.ts:977` | errors whenever `acceptance_criteria.length === 0` | **blocks** |

The repair pass deliberately preserves exactly the shape the strict pass then treats as fatal.
`lib/audit-runner.ts:806` turns that into a thrown error, and the run fails.

The degradation pass (`degradeValidationErrors`, `lib/audit-runner.ts:390`) cannot rescue it either:
the reported path ends in the field name (`…4.acceptance_criteria`), not an array index, so
`removeArrayItemAtPath` does not match and `setFallbackAtPath` cannot turn an empty list into a
valid one. Degradation runs, changes nothing, revalidation fails, the run dies.

The recovery retry (`lib/audit-recovery.ts:41` matches `Report validation blocked`) re-runs the whole
generation and hits the identical deterministic wall — that is the second log line, and it spends the
API budget a second time.

## Why this is a launch blocker

A customer pays €149, generation succeeds, the analysis is complete and usable, and they receive
**nothing**. The trust layer exists to stop us saying something false — not to withhold a correct
report because one of five appendices lacks a checklist. Losing the whole deliverable over a missing
sub-list is a worse outcome, for the customer and for us, than shipping the brief without it.

It also fires on exactly the sites we sell to: thin pages with no reviews, no schema and no
structured proof give the model the least material for verifiable "Done when …" lines. `vertexspain`
is an ordinary small business, not an edge case.

## Fix

1. **Make the three rules agree, in favour of the repair pass.** A brief with a title and at least
   one of `steps` / `acceptance_criteria` is usable. An empty `acceptance_criteria` on such a brief
   is a **warning**, not an error. Remove the unconditional `length === 0` errors at
   `lib/report-validator.ts:974-979` for both `steps` and `acceptance_criteria`; keep
   `validateStringArrayFields`, which still rejects blank strings inside a non-empty list, and keep
   `validateActionUsability`, which still rejects a brief that is empty on both counts.
2. **Render the brief without the missing section** rather than printing an empty heading. A brief
   with steps and no acceptance criteria shows its steps; the "Acceptance criteria" heading is
   omitted entirely. Check both the web report and the PDF.
3. **Never let a repairable shape kill the run.** In `runFullAudit`, a validation error that
   degradation could not repair must not silently mean "throw and lose everything". Keep the throw
   for errors that indicate an unsafe or false claim — that is the trust layer and it stays — but a
   structural emptiness that has already been degraded must fall through to a saved report with the
   failure recorded in `validation_warnings`.
4. **Stop the pointless retry.** `lib/audit-recovery.ts:41` treats every `Report validation blocked`
   as retryable. A deterministic validation failure produces the same result and spends the budget
   again. Retry only errors that are plausibly transient (model/schema parse failures); a validation
   block that repeats identically must not be retried a second time.

Do not fix this by having the model invent acceptance criteria, and do not weaken
`validateStringArrayFields`. The point is to degrade gracefully, never to fabricate content.

## Acceptance

Each starts as a failing test.

- A report whose fifth brief has two steps and `acceptance_criteria: []` validates without errors,
  saves, and exports a PDF. (Fails today.)
- That brief renders its steps, and no "Acceptance criteria" heading appears for it.
- A brief with a title and **no** steps and **no** acceptance criteria is still dropped, as today.
- A brief whose `acceptance_criteria` contains `["", "  "]` still errors — blank strings inside a
  list are a different defect and stay rejected.
- A validation failure that repeats identically after degradation is not retried by recovery.
- The golden report regression and the rest of the trust-layer suite stay green.
- `npx tsc --noEmit`, `npm run build`, full vitest suite pass.

## Verification after deploy

Re-run the `vertexspain.com` audit. It must complete and produce a PDF. If any brief ships without
acceptance criteria, that is expected and appears in `validation_warnings`, not as a failure.
