# Agent context — ClearSignal

**Read `CLAUDE.md` in this folder — it is the single source of project context** (what ClearSignal
is, the stack, the deploy split, the paid funnel, the frozen scope, the trust-layer rules, and the
remaining launch blockers). This file exists so Codex auto-loads the same context; `CLAUDE.md` is
the canonical copy, kept here to avoid drift.

Quick reminders that matter most when implementing:

- **Scope is frozen.** No monitoring, subscriptions, auth, dashboards, white-label, new engines, new
  report sections, redesigns, or audit-engine changes without a clear reason.
- **Trust layer is sacred.** Never invent numbers or promise guaranteed rankings/traffic/revenue.
  Do not weaken `lib/sanitize.ts` or `lib/report-validator.ts`.
- **Deploy split:** Vercel auto-deploys `main`; Trigger.dev must be deployed separately from
  `C:\csdeploy` (see `DEPLOY.md`). Non-ASCII in source uses `\u` escapes (Windows CP1251).
- Task specs live in `TASKS_*.md` at the repo root. After changes: `npx tsc --noEmit`,
  `npm run build`, and the vitest suite must pass.
- **`STATUS.md` is the handoff.** Read it before starting; update it at the end of a session when
  external state changed (a Trigger deploy, a verification outcome, work handed to someone else).
  Nothing is emailed or copied between machines — `git pull` carries it.

## Cost discipline (read this before starting anything)

This is a pre-revenue solo project. On 2026-07-24 a single session spent 32 million input
tokens across 257 requests to produce 68 thousand tokens of output — 471 input tokens for
every output token. That is more than the product earns per audit. These rules exist because
of that measurement, not as a style preference.

**1. Check the working directory first.** Run `git log --oneline -1`. If it does not print a
commit from this repository, STOP and say so. That session ran from
`C:\Users\alexa\Documents\ClearSignal`, a folder containing nothing but `.git` — every fact
then had to be re-derived the hard way. The repository is `C:\Claude Code\clearsignal`.

**2. One task, one session.** When a task is done, the session ends. Never continue an
unrelated task in the same session: every step resends the entire history, so a long session
costs more per step than a fresh one. If a session passes ~60 steps without finishing, stop
and report where you are instead of pushing on.

**3. No visual iteration loops.** Never screenshot, adjust, screenshot again. Composite
before/after comparison images are the single most expensive thing you can produce and they
exist for a human to judge, not you. Design QA is: one pass, one set of screenshots, report,
and the human decides. Note that redesigns are outside the frozen scope anyway.

**4. Do not rasterize documents to look at them.** Reading a 26-page PDF as 26 images costs
more than the entire task around it. Extract text and search it. Reserve images for the two
or three places where layout itself is the question.

**5. Never read a large fixture whole.** `tests/fixtures/*.json` files run to 90 KB. Grep for
the field you need or read a line range. The same goes for lockfiles and build output.

**6. Verify the cheap precondition before the expensive work.** Check the build hash in a
footer before inspecting a report; check that a file is the one you think it is before reading
it. On 2026-07-24 a full seven-item inspection was performed on a PDF downloaded a day
earlier — the whole pass had to be thrown away and repeated.

**7. Mechanical checks belong in code, not in your attention.** Forbidden strings, ligature
codepoints, page counts, footer hashes, schema type consistency — write the check, run it, read
the output. A test that fails is cheaper and more reliable than an agent that looks.

**8. High reasoning effort is for judgment, not mechanics.** Deciding whether a sentence
overclaims deserves it. Counting pages does not.

Spend can be inspected at any time with `npm run codex-usage` (add a `YYYY-MM-DD` argument for
an earlier day). It reads the local Codex transcripts and prints requests, input and output
tokens per project.
