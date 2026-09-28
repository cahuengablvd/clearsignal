# TASKS — "Reviewed by a person" wording; founder's name off the marketing copy

**Status:** ready 2026-09-28. Owner decisions:

- The product is described as **reviewed by a person**, never "expert-reviewed".
- The founder's name comes off the marketing copy.

Small, Vercel-only, one session. Should be live before the Agency Pilot 01 `GO LIVE`, because
prospects will visit the site after the first email.

## Preflight

`main` holds someone else's uncommitted engine work in five `lib/` files. Never stage, stash,
commit or discard it.

1. **Commit the owner's docs first.** In `C:\Claude Code\clearsignal`, if they are uncommitted,
   commit only these paths and push:
   - `TASKS_AGENCY_PILOT_VALIDATION.md`
   - `TASKS_SITE_REVIEW_WORDING.md`
   - `validation/pilot01/`
   - `STATUS.md`
   - `.gitignore`

   Message: `docs: agency pilot 01 and site wording specs`.
2. **Work in a clean worktree** based on the updated `origin/main`, e.g.
   `git worktree add ../clearsignal-wording origin/main -b site-review-wording`. Run `npm ci` there.
3. **Land the result on `main`** (rebase if `main` moved) and push. Vercel deploys `main`.

## Changes

Match by text; line numbers are approximate.

**Product label and emails**

| File | Old | New |
|---|---|---|
| `lib/audit-label.ts` | `Expert-reviewed AI Visibility Audit` | `AI Visibility Audit, reviewed by a person` |
| `lib/resend.ts`, HTML footer (~l.106) and text footer (~l.159) | `ClearSignal - expert-reviewed AI Visibility Audits.` | `ClearSignal - AI Visibility Audits.` |

In `lib/resend.ts`, keep the sentence that follows: "Every report is checked by a person before it
is sent."

**Score and report pages**

| File | Old | New |
|---|---|---|
| `app/score/[id]/score-pdf-view.tsx` (~l.187) | `…included in the full expert-reviewed audit.` | `…included in the full audit, reviewed by a person.` |
| `app/audit/[id]/page.tsx` (~l.177, ~l.994) | `expert hypothesis` | `hypothesis, not measured` |

**Landing page — `app/page.tsx`**

| Where | Old | New |
|---|---|---|
| ~l.110 (FAQ) | `…an implementation plan reviewed by Alexander Kalinko.` | `…an implementation plan reviewed by a person.` |
| ~l.114 (FAQ) | `…draft implementation materials and expert review before delivery.` | `…draft implementation materials and a review by a person before delivery.` |
| ~l.122 (FAQ) | `Alexander Kalinko reviews the full founding audit before delivery to catch…` | `Every full audit is reviewed by a person before delivery, to catch…` |
| ~l.696 | `Reviewed by Alexander Kalinko before delivery` | `Reviewed by a person before delivery` |
| ~l.769 | `Alexander Kalinko reviews the evidence, factual claims and recommendations before each full report is sent.` | `A person reviews the evidence, factual claims and recommendations before each full report is sent.` |
| ~l.1064 | `One expert-reviewed audit. No subscription required.` | `One audit, reviewed by a person. No subscription required.` |
| ~l.1069 | `Alexander Kalinko reviews the evidence, factual claims and recommendations before every full audit is delivered.` | `A person reviews the evidence, factual claims and recommendations before every full audit is delivered.` |
| ~l.1079 and ~l.1083 | `Expert-reviewed AI visibility and citation-readiness audit.` | `AI visibility and citation-readiness audit, reviewed by a person.` |
| ~l.1102 | `Reviewed before delivery by Alexander Kalinko.` | `Reviewed by a person before delivery.` |
| ~l.1121–1128 | the whole "Who built this" section (name heading and bio) | remove the section |
| ~l.1181 (footer) | `AI visibility audits reviewed by Alexander Kalinko for teams that want…` | `AI visibility audits, reviewed by a person, for teams that want…` |

**Project context — `CLAUDE.md`**

- Old: `An **expert-reviewed AI Visibility Audit**`
- New: `An **AI Visibility Audit, reviewed by a person**`
- Add one line: *Never write "expert-reviewed". The founder's name appears only on `/terms` and
  `/privacy`.*

## Do not change

- `/privacy` and `/terms`. By law they must name the sole trader who is the data controller and the
  operator.
- The `/sample` reviewer note: it is first person and has no name.
- `lib/prompts.ts` — an internal prompt persona, not customer-facing.
- `lib/report-validator.ts` — engine code that also holds the uncommitted work.
- The fixture text in `tests/trust-layer.test.ts`: "Expert-reviewed audit" there is scraped input,
  not our copy.

## Tests

- Update `tests/audit-label.test.ts` and `tests/positioning-copy.test.ts` to the new wording.
- Add one mechanical test (AGENTS.md rule 7):
  - Files covered: `app/page.tsx`, `app/sample/page.tsx`, `app/score/[id]/score-pdf-view.tsx`,
    `app/audit/[id]/page.tsx`, `lib/audit-label.ts`, `lib/resend.ts`.
  - Fails if any of them contains `expert-review` (any case), `expert review`,
    `expert hypothesis` or `Kalinko`.
  - `/privacy` and `/terms` are excluded on purpose.

## Ship

1. Run `npx tsc --noEmit`, `npm run build` (no dev server running) and the full vitest suite, all
   in the clean worktree.
2. Push `main` → Vercel.
3. On production, check:
   - the landing page has no "expert" claim and no founder name;
   - `/privacy` and `/terms` are unchanged;
   - the `/api/health` SHA matches.
4. No Trigger deploy. The only Trigger-bundled file touched is `lib/resend.ts`, and Trigger
   reaches it only when `AUTO_DELIVER_AUDITS=true`, which is off in production. Record this dormant
   drift in STATUS.md; the next regular Trigger deploy clears it.
5. Update STATUS.md (in the worktree, before the final push).
6. Fast-forward the main folder:
   `git -C "C:\Claude Code\clearsignal" pull --ff-only`. The `lib/` work stays untouched.
7. Remove the worktree. End with the Russian owner status (AGENTS.md).

## Acceptance

- On production, none of the old phrases remain on the landing page, the score page or the report
  header.
- The FAQ, pricing block and footer say "reviewed by a person".
- The "Who built this" section is gone.
- The legal pages still name the operator.
- Tests are green, including the new mechanical check.
