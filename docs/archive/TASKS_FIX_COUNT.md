# TASKS_FIX_COUNT — the report demands five fixes whether or not the evidence supports five

**Defects:** `R31` (a report with four supportable fixes fails generation) and `R32` (an audit that
failed deterministically once can never be retried). Touches `lib/schemas.ts`, `lib/prompts.ts`,
`lib/audit-recovery.ts` and the admin surface, so it **needs a Trigger deploy from `C:\csdeploy`.**

## What happened

Two production regenerations on Trigger `20260815.3`, both failed:

- `9ba2d5ec` (`snoika.com`) — the model returned two `top_fixes` without the required `description`.
  Zod rejected the payload, the run was marked a deterministic failure, the audit is `failed`.
- `28ca503b` (ClearSignal) — recovery stopped at the *previous* deterministic failure marker and
  never called the model at all. Also `failed`.

A third run, `beb637a8` (`vertexspain.com`), survived: there the model emitted
`description: ""`, which passes Zod, and the sanitizer dropped the empty fix. Four fixes shipped.

These are not three events. They are one shortage of evidence taking two different exits.

## Root cause (R31): three requirements that cannot all hold

| Requirement | Where |
|---|---|
| at least five fixes | `lib/schemas.ts:657` — `z.array(actionFixSchema).min(5)` |
| every fix has a non-optional `description` | `lib/schemas.ts:628` |
| every description fits in 18 words | `lib/prompts.ts:508` and the plain-language pass |

When a thin site yields four evidence-backed fixes, the model must invent a fifth. Before the
plain-language pass it padded the fifth with filler and nobody noticed. With filler banned and the
sentence capped, it now returns an empty string (Vertex) or omits the key (snoika).

**The real defect is `min(5)`, not the word limit.** Demanding a fixed number of findings is
demanding invention when the evidence runs out — the one thing this product refuses to do
everywhere else. `docs/archive/TASKS_VERTICAL_TRUTH.md` settled the same argument for business
category: abstain rather than guess. The same rule applies to fix count.

## Root cause (R32): a deterministic failure is permanent

`isDeterministicAuditFailure` (`lib/audit-recovery.ts:39`) correctly refuses to retry a failure that
will repeat. But nothing clears that state after the cause is fixed and deployed, and the admin has
no control to say "the cause is fixed, run it again". `28ca503b` is now stuck: it cannot recover
itself, and the operator cannot release it.

## Fix

1. **Lower the floor to three and stop asking for exactly five.** `min(3).max(10)` in
   `lib/schemas.ts:657`; the prompt asks for "up to 5 fixes, only ones a named finding supports —
   returning three well-evidenced fixes is correct and expected when the evidence stops there."
   Do not lower it to zero: a report with no action at all is a different failure and should still
   be caught.
2. **Make `description` impossible to satisfy with emptiness.** `z.string().min(1)` (trimmed) so an
   empty description fails loudly at parse time rather than silently becoming a dropped fix later.
   With the floor lowered, the model has a legal way to comply: return fewer fixes, each real.
3. **Keep the 18-word cap.** It exposed this; it did not cause it. If a description genuinely needs
   more room, widen to 25 words *for `description` only* — but only after (1) and (2) are in place
   and a regeneration still shows strain. Do not widen preemptively.
4. **R32 — let the operator release a stuck audit.** Add an explicit admin action that clears the
   deterministic-failure marker and requeues one audit, recording who did it and when in
   `admin_notes`. Recovery keeps refusing automatic retries; this is a deliberate human override,
   not a loosening of the rule.

## Acceptance

Each starts as a failing test.

- A generated action block with three fully-described fixes validates and saves. (Fails today.)
- A block with a fix whose `description` is `""` or whitespace fails validation with a message that
  names the field — it must not reach the sanitizer as a droppable item.
- A block with zero fixes still fails.
- An audit whose `admin_notes` carry a deterministic-failure marker is skipped by automatic
  recovery, but the explicit operator action requeues it and the note records the override.
- The `R27` regressions stay green: a brief with steps and no acceptance criteria still saves.
- `npx tsc --noEmit`, `npm run build`, full vitest suite pass.

## Verification after deploy

Requeue `9ba2d5ec` and `28ca503b`. Both must complete. Then confirm the two things they were
regenerated for in the first place, still unverified in production: no answer engine appears in
"Who AI recommends instead" (`R28`), and no cited source is a bare public suffix (`R29`).

Record the surviving fix count for each in `STATUS.md` — that is the second and third data point for
the plain-language watch list.

## Shipped

Implemented in `5f356dc`, deployed as Trigger `20260820.1`, and production-verified on 2026-08-20.
