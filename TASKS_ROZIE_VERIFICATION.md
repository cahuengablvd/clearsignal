# Rozie verification — P0/P1/P2 on real output

Owner: Codex (execution) / Claude (review of the result).
Blocker status: if ANY P0 is not confirmed on real output, beta ships nothing.

The point of this task is NOT to read the code again. The code has already been read (see
"Already established" below). The point is to look at a real generated report and a real PDF,
because the temporal false positive passed every test and was only caught by eye.

---

## Already established (do NOT redo)

Verified on `d9251c4`, 2026-07-24:

- Working tree is clean, `main` == `origin/main` == `d9251c4`. `npm test` → 255 passed,
  13 skipped. `npx tsc --noEmit` → clean.
- Trigger.dev was stale: `C:\csdeploy` sat on `4aa690f` (Jul 4), 41 commits behind. It is now
  synced and **deployed as version `20260724.1` (4 tasks) from `d9251c4`**. Generation and the
  site finally run the same code.
- All the mechanisms exist and are wired, not dead files:
  - `lib/temporal-claims.ts` → imported by `lib/prompts.ts` AND `lib/report-validator.ts`;
    test "does not classify 14 July as future for a 22 July report" exists.
  - `lib/client-report.ts` → `buildClientReport` strips `outreach_messages` at the TYPE level;
    `app/audit/[id]/page.tsx:208` uses it; `validateClientReportProjection` is the second net.
  - `lib/industry-profiles/schema-allowlist.ts` → used by `lib/report-validator.ts` (blocking
    `schema_mismatch`) and `lib/quality/critic.ts`; 6 schema-deliverable tests.
  - `lib/audit-label.ts` → single `AUDIT_PRODUCT_LABEL`, used in layout/landing/sample/report.
  - `lib/audit-polling.ts` → `pollAuditStatus`, 5s interval, used by `app/admin/page.tsx`.
  - `tests/fixtures/golden-report-rozie.json` active at `schemaBaseline: 'strict'`.
  - Ligatures off in `app/globals.css` (`.pdf-code` + `@media print` on `.audit-report pre, code`);
    `min-height: 0` in print guards the blank trailing page.
- `STRIPE_PRICE_ID_AUDIT` rename is DONE (health route + checkout). Handoff item closed.

## Two gotchas found on the way (do not re-trigger them)

1. **Never deploy Trigger with `@latest`.** `npx trigger.dev@latest` pulls CLI 4.5.7 while
   `package.json` pins `@trigger.dev/sdk@4.4.6`; the CLI aborts on version mismatch. Use
   `npx trigger.dev@4.4.6 deploy` — i.e. the exact version from `package.json`. A previous
   session worked around this by bumping the SDK inside `C:\csdeploy` and never committing it,
   which silently shipped a worker on an SDK version that does not exist in the repo.
2. **The PDF footer does NOT identify the Trigger build.** The PDF is rendered by the Next app
   on Vercel (`app/api/audit/[id]/pdf/route.ts`), so `footerText()` resolves to the Vercel
   commit, not the worker version. To prove which worker produced a report, read the run in the
   Trigger dashboard — it must say `20260724.1`.

---

## Step 1 — free pass: re-render, then inspect

`POST /api/admin/audits/rerender` (the admin button) calls `rerenderStoredAuditReport`. It runs
on Vercel and rebuilds the report from stored engine answers — **no LLM calls, no cost**. It
exercises the sanitizer, the validator, the client projection and the PDF renderer, which is
where P0-1, P0-2, P0-3, P1-label and all of P2 actually live.

Do this first. Open the client web report (`/audit/[id]?token=...`) and download the PDF, then
inspect BOTH by eye:

| Item | What must be true on the real output |
|---|---|
| P0-1 temporal | No sentence calls a date "future-dated" unless it is strictly after the audit reference date. Check any date near the generation date specifically. |
| P0-2 outreach | No outreach message, no "Rewritten Outreach Messages" heading, no "ahead of reaching out" anywhere in the client web report or the client PDF. They must appear ONLY on `/admin/audits/[id]/operator`. |
| P0-3 schema | Every schema type recommended in the action plan / implementation briefs is present in the attached JSON-LD, and no JSON-LD `@type` falls outside the category allowlist. |
| P1 label | One honest label everywhere: "Expert-reviewed AI Visibility Audit". No page claims fully automated delivery, none claims pure human authorship. |
| P1 polling | After triggering a re-render in /admin, the row reaches its final status and "View Report" becomes usable WITHOUT a manual browser refresh. |
| P2 ligatures | No fused glyphs (fi/ffi/tt) in the PDF, especially inside the JSON-LD code block. |
| P2 blank page | The PDF has no empty trailing page. |

Note the ligature guard is scoped to `pre`/`code` inside `.audit-report`. If a fused glyph
appears in ordinary body prose, that is NOT covered — report it as a finding, do not patch it
without a spec.

## Step 2 — paid pass: one full regeneration

Only after Step 1. Cost ~$1-2 of Anthropic balance. Requires the owner's go-ahead — do not
start it on your own initiative.

This is the only way to test what Step 1 cannot: the prompt-level temporal instruction
(`temporalPrompt` tells the model the reference date) and that worker `20260724.1` runs the
whole pipeline end to end.

Run it ONCE. Re-inspect the same table above on the newly generated output. Record the actual
API cost from the admin cost badge — it doubles as the first cost benchmark on this build.

## Step 3 — report back

For EVERY item in the table return exactly one of:

- `fixed + deployed + verified` — with the quoted line from the real report/PDF that proves it
- `fixed but not deployed` — code is right, live output disagrees
- `still broken` — with the quoted offending text and its field path

Do not summarize. Quote. A verdict without a quote from the real output is not a verdict.

If any P0 comes back anything other than `fixed + deployed + verified`: stop, do not write a
fix, and hand the finding back for a spec. That failure IS the next task.

## Out of scope

Do not touch Radar, do not open new fronts, do not refactor the trust layer, do not "improve"
anything you notice in passing. New defects go to `DEFECTS_BACKLOG.md` with date, field path
and quoted text — they are fixed in a batch, not now.
