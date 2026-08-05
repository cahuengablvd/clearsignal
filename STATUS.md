# STATUS — external state

Everything in this repo is described by the repo itself: `CLAUDE.md` for what the product is,
`AGENTS.md` for how to work, `TASKS_*.md` for current specs, `DEFECTS_BACKLOG.md` for known
defects, `git log` for history. This file holds only what git cannot know — the state of
systems outside the repository.

**Update it at the end of a working session.** A handoff document that duplicates the repo goes
stale and misleads; on 2026-07-24 a session was planned for an hour against a 2026-07-02 summary
that predated the entire paid funnel. Ten accurate lines beat a hundred confident ones.

---

**Last updated:** 2026-08-05, after the input-quality P0 deploy.

## Deploys

- **Vercel** — auto-deploys `main`. Live commit is whatever `main` points at.
- **Trigger.dev** - version **`20260805.1`**, deployed from `C:\csdeploy` at commit `d649b58`,
  5 tasks detected. This release ships `TASKS_INPUT_QUALITY.md` P0: challenge/thin-page guards,
  observational eligibility wording, and the score-derived editable intake draft.
  - Previous production version was `20260804.5` at commit `4c40bc2`. Anything touching
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

## Corporate mailbox

**Verified on 2026-08-05.** Namecheap Private Email is active for `getclearsignal.io` with
`hello@getclearsignal.io` as the mailbox and `reports@`, `support@`, and `dmarc@` as aliases.
Public DNS resolves both Private Email MX records and the root SPF record; Resend remains isolated
on the `send` subdomain. A live Gmail test addressed to `reports@getclearsignal.io` arrived in the
`hello@getclearsignal.io` inbox. Customer replies can now be received.

**Renewal: the Namecheap trial ends 2026-08-23 with auto-renew on.** If that charge fails the
mailbox lapses and customer replies start disappearing again, silently and in exactly the way this
verification just closed. Nothing in the app would detect it. Confirm the renewal went through
after 2026-08-23.

## Blocked on the owner, not on code

1. **Live Stripe control purchase + refund** with a real card. Waiting on funds. Nobody else can
   do this. Tests the live webhook, generation and delivery end to end.
2. Legal review of `/terms`, `/privacy`, `/refund` and VAT treatment.

## In flight

- **Pre-launch verification** - all 12 code items in `TASKS_PRELAUNCH.md` are shipped. Its
  definition of done still requires two fresh paid-path audits in different verticals, one full
  owner read-through, the owner's Stripe control purchase/refund, and legal review.
- **Two-week sales test** — queued behind the sprint. Kit is ready in `validation/` (plan,
  outreach, agency interview script, tracking sheet); agencies first. Go/no-go criteria in
  `validation/PLAN.md`.

## Shipped

- `TASKS_INPUT_QUALITY.md` P0 - commit `d649b58`, Trigger version `20260805.1`. Short challenge
  pages stop before AI stages while substantive pages that mention a WAF remain valid; crawler
  eligibility stays observational; completed free scores prefill an editable business description,
  while cold checkout and unread admin previews cannot proceed without supplied business context.

- `TASKS_PRELAUNCH.md` Batches 1-4 plus R10/R11 - through commit `4c40bc2`, Trigger version
  `20260804.5`. Public engine claims share the execution contract; buyer-intent GEO queries and
  compact evidence now ground action plans; timed-out engine requests are actually aborted;
  engine coverage is review-visible; legacy re-renders remain reviewable; marketplace JSON-LD
  stays grounded in observed page structure.

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

**A complete audit costs `$1.06` in API spend** — `$1.056009` Anthropic, `$1.081492` across all
providers (control run `dad3447c-bfe6-43f8-9956-2a7120a6fd01`, 2026-08-04, 18/18 engine-query
combinations). This is the first measurement taken on a run where every engine actually returned
evidence, so it supersedes the earlier figures. Against €149 that is ~0.7% of the ticket.

The two earlier numbers were both measured on incomplete audits and should not be quoted:

- `$1.89` (run `9r5hcc01`, 2026-07-24) predates the R10/R11 fixes. The R11 coverage panel, applied
  retroactively, shows that run finished **13/18 combinations with 5 failed or skipped** — evidence
  from all three engines, so Claude was timing out intermittently rather than always. The abandoned
  calls were billed but never reached the report; how much of the $1.89 they account for is not
  separable after the fact.
- `$0.362783` (run `51ff451a`, 2026-08-04) was taken after R10 stopped the billing but before R11
  raised the timeout — all six Claude calls aborted, so a third of the engine work simply did not
  happen. Cheap because it was broken.

Net: the product now produces a *complete* audit for less than it used to spend on an incomplete
one.

Codex spent ~32M input tokens over 257 requests in one session on 2026-07-24, largely because it
ran from a folder containing only `.git`. Rules live in `AGENTS.md`; check any day's spend with
`npm run codex-usage`.

## Adjacent, not this repo

ClearSignal Radar lives in its own private repository and runs in GitHub Actions. First live
digest expected Monday 2026-07-27 via Telegram — passive check, no work needed here.
