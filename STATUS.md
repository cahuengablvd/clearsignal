# STATUS — external state

Everything in this repo is described by the repo itself: `CLAUDE.md` for what the product is,
`AGENTS.md` for how to work, `TASKS_*.md` for current specs, `DEFECTS_BACKLOG.md` for known
defects, `git log` for history. This file holds only what git cannot know — the state of
systems outside the repository.

**Update it at the end of a working session.** A handoff document that duplicates the repo goes
stale and misleads; on 2026-07-24 a session was planned for an hour against a 2026-07-02 summary
that predated the entire paid funnel. Ten accurate lines beat a hundred confident ones.

---

**Last updated:** 2026-08-04, after Trigger deploy from commit `e6555e6`.

## Deploys

- **Vercel** — auto-deploys `main`. Live commit is whatever `main` points at.
- **Trigger.dev** — version **`20260804.1`**, deployed from `C:\csdeploy` at commit `e6555e6`,
  5 tasks detected. This release ships Batch 1 of `TASKS_PRELAUNCH.md`: the shared free/full
  engine contract, measured-only GEO summaries, and synthesis fallback for generic AI fixes.
  - Previous production version was `20260724.3` at commit `764e008`; that deployment closed a
    41-commit worker/site drift. Anything touching `lib/audit-*`, `lib/report-*`, `lib/quality/*`,
    `trigger/*` or prompts needs a Trigger deploy or it simply is not live.
  - Deploy with the CLI version pinned to `package.json` (`npx trigger.dev@4.4.6 deploy`).
    `@latest` aborts on a version mismatch — see `DEPLOY.md`.

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

- `TASKS_PRELAUNCH.md` Batch 1 only — commit `e6555e6`, Trigger version `20260804.1`. The free
  score now says and runs one sampled engine (Claude), while the full audit contract remains
  ChatGPT, Claude and Perplexity. Unmeasured GEO causes and arbitrary GEO evidence links were
  removed; the public engine claim is protected by a code-to-copy contract test.

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

Codex spent ~32M input tokens over 257 requests in one session on 2026-07-24, largely because it
ran from a folder containing only `.git`. Rules live in `AGENTS.md`; check any day's spend with
`npm run codex-usage`.

## Adjacent, not this repo

ClearSignal Radar lives in its own private repository and runs in GitHub Actions. First live
digest expected Monday 2026-07-27 via Telegram — passive check, no work needed here.
