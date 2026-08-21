# STATUS — external state

Only what git cannot know: the state of systems outside the repository. Everything else is in the
repo itself (`CLAUDE.md` = what the product is, `AGENTS.md` = how to work, `DEFECTS_BACKLOG.md` =
open defects, `git log` = history).

**Keep this file under ~120 lines.** It is read at the start of every session, so every line here
is paid for on every step of that session. Detail belongs in `docs/archive/`, not here. Update it
at the end of a working session.

---

**Last updated:** 2026-08-20. R28 and R33 are fixed and production-verified; the queued-at migration is applied and both current verification reports are awaiting review.

## Deploys

- **Vercel** — auto-deploys `main`; production health confirmed the R34 code at `8247da2`.
- **Trigger.dev** — version **`20260821.1`**, deployed from `C:\csdeploy` at commit `8247da2`,
  5 tasks. Carries the R34 daily spend guard and deterministic task-retry stop.
- **Supabase** — migration `014_daily_ai_spend_guard.sql` applied 2026-08-21 with RLS enabled.
  Anything touching `lib/audit-*`, `lib/report-*`, `lib/quality/*`, `lib/geo/*`, `trigger/*` or
  prompts needs a Trigger deploy or it is not live.
- Deploy with the CLI pinned to `package.json` (`npx trigger.dev@4.4.6 deploy`); `@latest` aborts
  on a version mismatch. See `DEPLOY.md`.

## Blocked on the owner, not on code

1. **Live Stripe control purchase + refund** with a real card. Waiting on funds. Tests the live
   webhook, generation and delivery end to end. Nobody else can do this.
2. Legal review of `/terms`, `/privacy`, `/refund` and VAT treatment.

## Dated obligations

- **Namecheap Private Email trial ends 2026-08-23, auto-renew on.** If that charge fails the
  mailbox lapses and customer replies vanish silently — nothing in the app would detect it.
  Confirm the renewal went through after 2026-08-23.
- **Codex weekly limit resets 2026-08-10.** Exhausted on 2026-08-04 (see Cost below).

## Sales test — running

**23 emails sent 2026-08-07 (a Friday). Zero replies as of 2026-08-10.** Baltic SEO agencies, top of
`validation/tracking.csv`, from the owner's personal mailbox. The message asks whether an agency
could see itself reselling the audit, not whether they will buy.

Read the silence correctly: two of the three elapsed days were the weekend, so one business day has
passed. Zero at this point carries almost no information. If the true reply rate were the 20% this
plan assumes, zero across the whole batch would be a 0.6% event — decisive by day 7-10, not now.

What to expect: most replies that come at all arrive within 48 hours. One follow-up on day 4, then
`closed_no_reply`. Do not judge the copy or the segment before the batch is complete (23 of 40 sent)
and 4-5 **business** days have passed.

`validation/tracking.csv` still shows `not_sent` with empty `first_message_date` for rows that were
actually mailed. Until those dates are filled in, the day-4 follow-up schedule cannot be run.

The objection to watch for is "why pay when ChatGPT does this free" — the clinic owner raised it and
a handler is written. Three or more agencies raising it means a positioning problem no feature fixes.

## In flight — owner only, no code

- **Two-week sales test.** Kit ready in `validation/` (plan, outreach, agency interview script,
  tracking sheet). Agencies first. Go/no-go criteria in `validation/PLAN.md`.
- First real reader: a clinic owner, personal contact, receiving the `jusukosmetologs.lv` report
  as a gift. Capture his verbatim reaction in `validation/tracking.csv` — especially whether he
  asks *who could implement the fixes*. Repeated implementation questions from service businesses
  would confirm the agency-first strategy on evidence instead of assumption.

## Verification standing

- `vertexspain.com` (audit `beb637a8`) — regenerated on Trigger `20260815.3`; `awaiting_review`, not
  delivered. Four fully described fixes survived and prose passes the deterministic plain-language
  limits (summary: 13.5 words mean, 19 max).
- `snoika.com` (audit `9ba2d5ec`) — final regeneration on Trigger `20260820.3`; `awaiting_review`,
  not delivered. **Five** fully described fixes survived; `Crunchbase` is the only competitor.
- `getclearsignal.io` (audit `28ca503b`) — final regeneration on Trigger `20260820.3`;
  `awaiting_review`, not delivered. **Five** fully described fixes survived; `Brandwatch` and
  `Siftly` are the only competitors. `Google AI` is absent from both visibility and evidence.
- **R28/R33 are production-verified.** Live and reused GEO paths exclude inferred engine aliases,
  while the concurrent verification requeues completed with `recovery_attempts = 0` and no recovery
  note. Across the plain-language measurements, 4/4/5/5/5 fixes survived according to the material;
  the `min(3)` contract works and there is no evidence for widening descriptions beyond 18 words.
- `jusukosmetologs.lv` (audit `5d53a488`) — 18/18 engine coverage, mechanically clean.
  **This is the report to show people:** cited 7x (second in its niche) yet named in only 4 of 18
  answers, while the leader is recommended in 33%. Read by AI, not recommended by it — the exact
  distinction the product exists to surface.
- `salidzini.lv` (audit `7590982c`) — ran against a Cloudflare challenge page. **Not a sample.**
- Rozie verification closed 2026-07-24; report delivery proven end to end (real inbox, not spam,
  token link, PDF, mechanical client-safety scan). One loose end: that run `9r5hcc01` executed on
  Trigger `20260724.1` is visible only in the Trigger dashboard.

Detail for all three is in `docs/archive/STATUS_HISTORY_2026-08-06.md`.

## Open defects

`R13`, `R16`, `R18`, `R19`, `R20`, `R21`, `R22` and `R30` remain open. They wait for real customers
to set their priority. Closed defects are in `docs/archive/DEFECTS_CLOSED.md`.

## Cost

**A complete audit costs `$1.06` in API spend** (control run `dad3447c`, 2026-08-04, 18/18
combinations, first measurement where every engine returned evidence). Against €149 that is ~0.7%
of the ticket. Earlier figures of `$1.89` and `$0.36` were measured on incomplete audits — do not
quote them.

**Agent spend is the real cost problem, and it dwarfs API spend.** Measured from local Codex
transcripts against the published rate card (`gpt-5.6-sol` = 125 / 12.5 / 750 credits per 1M
input / cached / output; 500 credits = $20, so 1 credit = $0.04):

| Date | Requests | Tokens | Avg context | Cost | |
|---|---:|---:|---:|---:|---|
| 2026-08-04 | 521 | 64.9M | 124.5k | **$49.55** | development |
| 2026-08-05 | 278 | 25.0M | 90.0k | $19.54 | development |
| 2026-08-06 | 61 | 3.7M | 60.9k | $4.91 | diagnosing this spend, not development |
| **Total** | **860** | **93.6M** | | **$74.00** | |

For scale: `$74` of agent time against a `$1.06` audit is **70 complete audits** spent on three
days of development. Earlier, on 2026-07-24, one session spent 32M input tokens from a folder
containing only `.git`.

Two things drove the 08-04 figure, in order:

1. **Six unrelated tasks fed into one thread**, with four context compactions. Average context
   reached 124.5k tokens against a 258k window — every step resent half a full window.
2. **`gpt-5.6-sol` at `high` reasoning as the default model.** Across all projects 08-04 to
   08-06, Sol accounted for `$117.69` of `$122.48`; Terra did 135 requests for `$4.78`. Terra
   is ~2x cheaper per token, Luna ~5x.

Note that context is the multiplier: a file read once on step 100 of an 860-step session is
resent on all 760 remaining steps. Trimming the repo's markdown from 290 KB to 38 KB on
2026-08-06 was aimed at exactly this.

Check any day with `npm run codex-usage`, with two caveats found on 2026-08-06:

- Codex archives finished sessions into `~/.codex/archived_sessions`. A script reading only
  `~/.codex/sessions` silently undercounts — that omission hid the entire `$74` above.
- Sessions are attributed by `cwd`, which is where the session *started*, not what it was about.
  On 2026-08-06, 236 requests recorded against `C:\Codex\BLVD` were actually Upwork profile work,
  because those files sat in that folder until they were moved out. Read the thread name, not
  just the path.

**ChatGPT Work spend is not measurable locally at all** — it writes no transcripts to `~/.codex`.
Any figure produced from local logs is a floor for total agent spend, not the total.
