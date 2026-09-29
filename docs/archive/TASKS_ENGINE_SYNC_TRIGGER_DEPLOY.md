# TASKS — Engine sync + Trigger deploy (2026-09-29)

One task, one session. Goal: make the production generation engine (Trigger.dev) run the current
`main`, and resolve the uncommitted engine work in `lib/` so Agency Pilot 01 is unblocked
(`STATUS.md`: "Phases 2–3 wait until the uncommitted engine work in `lib/` … is either committed
with a Trigger deploy or dropped").

Read first: `AGENTS.md`, `DEPLOY.md`, `STATUS.md` (Deploys section).

## Facts verified by Claude on 2026-09-29 (re-check, do not trust blindly)

- Vercel production `/api/health` reports `93db2d2` = `origin/main` HEAD. The website is current.
- `STATUS.md` records Trigger `20260904.5` deployed from `319851d`. Since `319851d`, `origin/main`
  has 14 commits touching engine paths (`lib/audit-runner.ts`, `lib/geo/*`, `lib/materials.ts`,
  `lib/report-validator.ts`, `lib/sanitize.ts`, `lib/resend.ts`, ...). If STATUS is right, none of
  them is live in generation.
- Discrepancy: `C:\csdeploy` is checked out at `635688a` (newer than `319851d`). A Trigger deploy
  may have happened without being recorded, or the checkout was only pulled.
- The owner's working copy `C:\Claude Code\clearsignal` is on `main`, **2 commits behind**
  `origin/main` (`2b006a1`, `93db2d2`), with uncommitted changes in:
  `STATUS.md`, `lib/audit-runner.ts`, `lib/geo/entities.ts`, `lib/geo/index.ts`,
  `lib/report-validator.ts`, `lib/sanitize.ts`; untracked
  `CLEARSIGNAL_EXTERNAL_AND_COMPANY_EVIDENCE_REVIEW_2026-09-28.md` and this file.
- `npx vitest run` on that working tree: **1 real failure** —
  `tests/trust-layer.test.ts` › "keeps sanitizeUnsupportedCommercialClaims idempotent" (second
  pass drops "shipping options" and "pricing" from "Ask the business about …"). Cause is almost
  certainly the uncommitted removal of `isInstructionSentence` in `lib/sanitize.ts`.
  Also 8 `orchestrator/test/*.test.mjs` files "fail" under vitest because they are `node:test`
  files (`npm run test:orchestrator`). Check whether this is identical on clean `origin/main`; if
  so it is a pre-existing baseline, not this task.

## What the uncommitted engine work does

1. `observedEntityKind()` in `lib/geo/entities.ts`: `channels_observed[].kind` stops being
   hard-coded `'directory'`; it uses the known-channel kind, else `publisher` for
   `source_or_publisher`, else `unknown`. Used in `lib/geo/index.ts` (fresh) and
   `lib/audit-runner.ts` (recompute) — parity between both paths must hold.
2. `lib/report-validator.ts`:
   - `sanitizeEntityListingRecommendations()` — removes "get listed / profile on X" advice where X
     is a competitor, unknown or unconfirmed entity; keeps it when X is a real directory. A string
     with only bad targets becomes `''`.
   - `repairEntitySummary()` — replaces "no other competitor detected" in the executive summary
     when other named businesses did appear but were not confirmed competitors.
3. `lib/sanitize.ts`: commercial-claim checks now also apply to imperative sentences ("Offer a
   free consultation" must not bypass), and `sanitizeGeneratedProse` runs
   `sanitizeUnsupportedCommercialClaims` when a `businessContext` is passed (except
   `third_party_source_description`).

The intent is sound (trust layer: no advice to list on a competitor, no false "no other
competitors", no unsupported commercial claims). None of it has tests.

## Known defects to fix before this can ship

- **D1 — idempotency failure** above. Fix the sanitizer so a second pass is a no-op, while keeping
  the new rule that imperative client-visible copy is still checked. Do not edit or weaken the
  existing test's expectation to make it pass; if you believe the test's expectation is wrong,
  stop and explain why in your report instead.
- **D2 — blank strings after validation.** In `validateReport`, `validateBlankAcceptanceCriteria`
  runs *before* `sanitizeEntityListingRecommendations`, which can turn steps, acceptance criteria,
  action items or `geo.recommendations` into `''`. Empty entries must be removed (or the whole
  brief/fix handled consistently), and blank acceptance criteria must still be impossible in the
  final report. Check `dropReplacementOnlyBriefSteps` and every consumer that assumes non-empty
  arrays (e.g. a brief with zero acceptance criteria, "Ship first" counts vs Action Plan — see the
  Alahli reviewer note in STATUS about 5 vs 4 items).
- **D3 — grammar residue.** Removing a name from "Get listed on Clutch, CompetitorX and G2" must
  not leave "on , and G2" / "on and". Test with 1, 2 and 3 names, name at start/middle/end, and
  names containing regex characters (`.`, `+`, `(`).
- **D4 — replacement sentence must pass the trust layer** (observational, no invented numbers).

## Required tests (new, vitest)

- `observedEntityKind`: known directory, known social/marketplace channel, publisher, unknown.
- Fresh vs recompute parity for `channels_observed[].kind` (extend the existing parity test style,
  e.g. `tests/a3-reuse-parity.test.ts` / `tests/px2-stale-observations.test.ts`).
- `sanitizeEntityListingRecommendations` via `validateReport`: competitor-only listing advice
  removed; directory kept; mixed sentence cleaned grammatically; no `''` left anywhere; no blank
  acceptance criteria; warning emitted.
- `repairEntitySummary`: triggers only when another competitor-role entity with occurrences > 0
  exists and confirmed competitors exist; untouched otherwise.
- Sanitizer: "Offer a free consultation" (unsupported) is handled; a supported claim from verified
  facts survives; idempotency on imperative sentences.

## Steps

0. **Safety first.** `git status`. Create a backup branch of the current working state before
   anything else (e.g. `git stash push -u` then `git stash branch wip/entity-taxonomy-2026-09-29`,
   or commit it to that branch). Never discard the owner's uncommitted work.
1. **Establish the real Trigger version.** Trigger dashboard
   (`https://cloud.trigger.dev/projects/v3/proj_asmgraqylwwxozdsmmjx/deployments`) or the pinned
   CLI. Record version, source commit, `git.dirty`, runtime. If you cannot access it, say so and
   continue — step 5 deploys regardless.
2. **Sync `main` with `origin/main`** (fast-forward the 2 commits). `STATUS.md` has local edits
   (Agency Pilot Phase 1 notes) and remote edits (site-wording deploy notes): keep both.
3. **Finish the engine work** on the working branch: fix D1–D4, add the tests above.
   **Time-box:** if D1–D4 cannot be fixed cleanly, do NOT ship partial work. Leave it on
   `wip/entity-taxonomy-2026-09-29` (pushed), return `main` to clean `origin/main`, and continue
   with step 5 so the 14 already-committed fixes still go live.
4. **Gates on the final `main`** (no dev server running): `npm test` (vitest; orchestrator
   baseline documented), `npm run test:orchestrator`, `npx tsc --noEmit`, `npm run build`.
   Commit engine work as one focused commit. Commit the untracked review doc
   `CLEARSIGNAL_EXTERNAL_AND_COMPANY_EVIDENCE_REVIEW_2026-09-28.md` and this spec as a separate
   `docs:` commit. Push `main` (normal push, never force). Confirm Vercel `/api/health` shows the
   new commit.
5. **Trigger deploy** exactly per `DEPLOY.md`: in `C:\csdeploy`, confirm `git status` clean,
   `git pull origin main`, confirm HEAD equals pushed `main`, `npx trigger.dev@4.4.6 deploy`
   (version from `package.json`, never `@latest`, never bump the SDK in csdeploy). Record the new
   version; confirm `git.dirty: false`, runtime `node-22`, 5 tasks.
6. **Update `STATUS.md`** Deploys section: Vercel commit, Trigger version + source SHA, date; note
   that the `lib/resend.ts` dormant drift is cleared; update the Agency Pilot line about the
   uncommitted `lib/` work. Keep STATUS under ~120 lines. Commit + push.

## Forbidden

- No new audits, no provider/AI calls, no re-render or regenerate of any audit, no delivery.
  In particular do not touch Alahli (`1e9122fe-…`) — its PDF is approved as rendered.
- No env/secret changes; `AUTO_DELIVER_AUDITS` stays false. No migrations. No prompt changes.
- Do not weaken `lib/sanitize.ts` / `lib/report-validator.ts` checks or existing tests to get
  green. No `--no-verify`, no force push, no `git reset --hard` on unbacked-up work.
- No scope beyond this file (no Agency Pilot / Apollo work, no design lab, no Verified Company
  Context spike).

## Report back

- Real Trigger version found in step 1 (and whether STATUS was stale).
- Outcome of the engine work: shipped, or parked on `wip/…` with the reason.
- Test/tsc/build results (actual numbers), commits pushed, Vercel commit, new Trigger version.
- End with the Russian `[СТАТУС]` block and owner summary required by `CLAUDE.md`.
