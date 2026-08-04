# STATUS — external state

Everything in this repo is described by the repo itself: `CLAUDE.md` for what the product is,
`AGENTS.md` for how to work, `TASKS_*.md` for current specs, `DEFECTS_BACKLOG.md` for known
defects, `git log` for history. This file holds only what git cannot know — the state of
systems outside the repository.

**Update it at the end of a working session.** A handoff document that duplicates the repo goes
stale and misleads; on 2026-07-24 a session was planned for an hour against a 2026-07-02 summary
that predated the entire paid funnel. Ten accurate lines beat a hundred confident ones.

---

**Last updated:** 2026-08-04, after the R11 control audit and production deploy.

## Deploys

- **Vercel** — auto-deploys `main`. Live commit is whatever `main` points at.
- **Trigger.dev** - version **`20260804.4`**, deployed from `C:\csdeploy` at commit `5dadd1e`,
  5 tasks detected. This release ships R11: honest engine names in GEO summaries, a measured
  90-second Claude web-search timeout, and engine-coverage warnings in admin review.
  - Previous production version was `20260804.3` at commit `a5c688a`. Anything touching
    `lib/audit-*`, `lib/report-*`, `lib/quality/*`, `lib/geo/*`, `trigger/*` or prompts needs a
    Trigger deploy or it simply is not live.
  - Deploy with the CLI version pinned to `package.json` (`npx trigger.dev@4.4.6 deploy`).
    `@latest` aborts on a version mismatch — see `DEPLOY.md`.

## Batch 3 benchmark

- Fresh from-scratch audit `51ff451a-f8c7-498f-bd62-9a10814fec38` for `attio.com` used
  `reuseGeoEvidence: false` and reached `awaiting_review` in **278.025 seconds (4:38.025)**.
- Admin Anthropic cost was **`$0.362783`**, exactly matching the sum of 16 persisted Anthropic call
  rows. The complete internal breakdown was `$0.389788` including OpenAI (`$0.025239`) and
  Perplexity (`$0.001766`); configured Firecrawl cost is currently `$0`.
- All six Claude GEO calls timed out at 45.013-45.021 seconds and were aborted. A control query
  5:29 after abort still showed 6 failed / 0 succeeded rows, 0 input tokens, 0 output tokens, and
  `$0` cost for those calls. No late usage appeared, closing R10 by production-key observation.

## R11 timing

- One isolated Claude Sonnet 4.6 call using the production key and the paid GEO settings
  (`web_search max_uses: 2`, `max_tokens: 1500`) completed in **59.928 seconds** with two web
  searches and 34,385 input / 2,098 output tokens. This proved the old 45-second timeout was below
  normal completion time and set the data basis for the new 90-second limit.
- Fresh control audit `dad3447c-bfe6-43f8-9956-2a7120a6fd01` for `cal.com` used
  `reuseGeoEvidence: false` and reached `awaiting_review` in **256.163 seconds (4:16.163)**.
  All six parallel Claude calls succeeded in **40.072, 50.477, 54.756, 54.862, 59.800, and
  63.604 seconds**. Coverage was 18/18 combinations across all three engines.
- Admin Anthropic cost was `$1.056009`; the complete internal provider breakdown was `$1.081492`.
  The local admin showed `Engine coverage complete` for the control audit and, for the earlier
  11/18 `attio.com` audit, `Engine coverage gap before approval` plus `No evidence: Claude`.

## Rozie verification (beta quality blocker)

**Closed on 2026-07-24.** All P0/P1/P2 verified on a paid regeneration (run `9r5hcc01`,
`Build: 6bf1b68`, generated `2026-07-24T14:34:35Z`): temporal claims, operator-outreach
exclusion, schema deliverable gate, honest label, admin polling, ligatures, no blank trailing
page. Detail in `TASKS_ROZIE_VERIFICATION.md`.

The audit reached a finished report rather than `failed-validation`, so the blocking schema gate
does not false-positive in the deployed worker — that was the main untested risk.

The delivery half is proven too: the report email arrived in a real inbox (not spam) from
`reports@getclearsignal.io`, the token link opened, the PDF downloaded, and the downloaded file
passed a mechanical client-safety scan — no ligatures, operator outreach, template sentences,
placeholder CTA fragments, future-date claims or foreign-vertical wording.

One confirmation still open: that run `9r5hcc01` executed on Trigger version `20260724.1`
(visible only in the Trigger dashboard).

## Blocked on the owner, not on code

1. **Live Stripe control purchase + refund** with a real card. Waiting on funds. Nobody else can
   do this. Tests the live webhook, generation and delivery end to end.
2. Legal review of `/terms`, `/privacy`, `/refund` and VAT treatment.

## In flight

- **Pre-launch fix sprint** — `TASKS_PRELAUNCH.md` is the finish line: 12 items in 4 batches,
  plus a definition of done. Owner decided on 2026-08-03 not to start selling until the site and
  engine are right. The termination rule matters more than the list: defects found *after* the
  list was agreed go to `DEFECTS_BACKLOG.md`, not into this sprint.
- **Two-week sales test** — queued behind the sprint. Kit is ready in `validation/` (plan,
  outreach, agency interview script, tracking sheet); agencies first. Go/no-go criteria in
  `validation/PLAN.md`.

## Shipped

- `TASKS_PRELAUNCH.md` Batches 1-3 plus R10 - through commit `a5c688a`, Trigger version
  `20260804.3`. Public engine claims share the execution contract; buyer-intent GEO queries and
  compact evidence now ground action plans; timed-out engine requests are actually aborted.
  Batch 4 remains untouched.

- `TASKS_DELIVERY_POLISH.md` — commit `b3f3cf5`. Both transactional emails share a branded
  table-based shell (site palette, text wordmark, dark mode, plain-text alternative, bare
  domain in subjects); the admin queue shows "Needs attention" / "Finished" band headers over
  the unchanged priority sort. Frontend-only, no Trigger deploy needed. Owner still to eyeball
  the email in Gmail + a dark-mode client after the Vercel deploy.

- `TASKS_FUNNEL_INPUT.md` — Vercel commit `764e008`, Trigger version `20260724.3`. Production
  smoke accepted bare `rozie.app`, survived closing and reopening the result URL, was honestly
  `processing` at 40 seconds and reached `done` at roughly 70. The mobile "Load failed" class is
  closed: the browser no longer holds a connection open for the length of the scan.

## Cost

**One audit costs `$1.89` in API spend** (run `9r5hcc01`, admin cost badge, build `6bf1b68`).
Against the €149 founding price that is ~1.2% of the ticket — the unit economics hold even if
generation gets several times more expensive. First real benchmark on this build.

The 2026-08-04 Batch 3/3.5 benchmark recorded `$0.362783` in the Anthropic admin counter and
`$0.389788` in the complete internal provider breakdown. Timed-out Claude GEO calls contributed
zero recorded usage after real aborts.

Codex spent ~32M input tokens over 257 requests in one session on 2026-07-24, largely because it
ran from a folder containing only `.git`. Rules live in `AGENTS.md`; check any day's spend with
`npm run codex-usage`.

## Adjacent, not this repo

ClearSignal Radar lives in its own private repository and runs in GitHub Actions. First live
digest expected Monday 2026-07-27 via Telegram — passive check, no work needed here.
