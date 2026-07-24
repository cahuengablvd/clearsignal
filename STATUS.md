# STATUS — external state

Everything in this repo is described by the repo itself: `CLAUDE.md` for what the product is,
`AGENTS.md` for how to work, `TASKS_*.md` for current specs, `DEFECTS_BACKLOG.md` for known
defects, `git log` for history. This file holds only what git cannot know — the state of
systems outside the repository.

**Update it at the end of a working session.** A handoff document that duplicates the repo goes
stale and misleads; on 2026-07-24 a session was planned for an hour against a 2026-07-02 summary
that predated the entire paid funnel. Ten accurate lines beat a hundred confident ones.

---

**Last updated:** 2026-07-24, after commit `764e008`.

## Deploys

- **Vercel** — auto-deploys `main`. Live commit is whatever `main` points at.
- **Trigger.dev** — version **`20260724.3`**, deployed from `C:\csdeploy` at commit `764e008`,
  5 tasks detected. This release adds the durable `run-free-score` task and the funnel URL
  normalization/mobile-resume batch from `TASKS_FUNNEL_INPUT.md`.
  - Before this it sat on `4aa690f` (Jul 4), **41 commits behind** — generation ran July code
    while the site ran July 24 code. Anything touching `lib/audit-*`, `lib/report-*`,
    `lib/quality/*`, `trigger/*` or prompts needs a Trigger deploy or it simply is not live.
  - Deploy with the CLI version pinned to `package.json` (`npx trigger.dev@4.4.6 deploy`).
    `@latest` aborts on a version mismatch — see `DEPLOY.md`.

## Rozie verification (beta quality blocker)

**Closed on 2026-07-24.** All P0/P1/P2 verified on a paid regeneration (run `9r5hcc01`,
`Build: 6bf1b68`, generated `2026-07-24T14:34:35Z`): temporal claims, operator-outreach
exclusion, schema deliverable gate, honest label, admin polling, ligatures, no blank trailing
page. Detail in `TASKS_ROZIE_VERIFICATION.md`.

The audit reached a finished report rather than `failed-validation`, so the blocking schema gate
does not false-positive in the deployed worker — that was the main untested risk.

Two confirmations still open, both needing a login this side of the repo:
- that run `9r5hcc01` executed on Trigger version `20260724.1` (dashboard);
- the run's actual `api_cost_usd` (admin cost badge) — the first cost benchmark on this build.

## Blocked on the owner, not on code

1. **Live Stripe control purchase + refund** with a real card. Waiting on funds. Nobody else can
   do this. Tests the live webhook, generation and delivery end to end.
2. Legal review of `/terms`, `/privacy`, `/refund` and VAT treatment.

## In flight

- `TASKS_FUNNEL_INPUT.md` is deployed in Vercel commit `764e008` and Trigger version
  `20260724.3`. Production smoke accepted bare `rozie.app`, survived closing/reopening the
  result URL, and reached `done`; it was still honestly `processing` at 40 seconds and completed
  at roughly 70 seconds.

## Cost

Codex spent ~32M input tokens over 257 requests in one session on 2026-07-24, largely because it
ran from a folder containing only `.git`. Rules live in `AGENTS.md`; check any day's spend with
`npm run codex-usage`.

## Adjacent, not this repo

ClearSignal Radar lives in its own private repository and runs in GitHub Actions. First live
digest expected Monday 2026-07-27 via Telegram — passive check, no work needed here.
