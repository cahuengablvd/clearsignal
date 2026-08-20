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
- The active task spec is a `TASKS_*.md` at the repo root; shipped specs move to `docs/archive/`.
  Never read `docs/archive/` whole — grep it. After changes: `npx tsc --noEmit`, `npm run build`,
  and the vitest suite must pass.
- **Evidence filters must cover the reuse path.** Any filter or validator over evidence has to
  apply identically when a run reuses stored evidence, with its own test over saved data. Three
  defects landed this way (`R24`, `R26`, `R28`): the live path was fixed, the reused path was not,
  and each time the verification run reported "not fixed".
- **`STATUS.md` is the handoff.** Read it before starting; update it at the end of a session when
  external state changed (a Trigger deploy, a verification outcome, work handed to someone else).
  Nothing is emailed or copied between machines — `git pull` carries it.

## Cost discipline (read this before starting anything)

This is a pre-revenue solo project. Two measured incidents, not a style preference:

- 2026-07-24 — one session spent 32 million input tokens across 257 requests to produce 68
  thousand tokens of output: 471 input tokens for every output token, more than the product
  earns per audit.
- 2026-08-04 — one session spent **64.9 million tokens across 521 requests, costing `$49.55`
  in one day**. Six unrelated tasks fed into a single thread with four context compactions,
  averaging 125k tokens of context per request against a 258k window. Across 08-04 to 08-06
  this repo cost **`$74`** — the price of 70 complete audits — and exhausted the Codex weekly
  limit for six days.

The second happened *after* these rules were written. Rule 2 is the one that was broken, and
it is the one that matters most.

**0. Use the cheapest model that can do the job.** `gpt-5.6-sol` costs 125 / 12.5 / 750 credits
per 1M input / cached / output tokens. `gpt-5.6-terra` is half that, `gpt-5.6-luna` a fifth.
From 08-04 to 08-06, Sol accounted for `$117.69` of `$122.48` spent across all projects.
Terra at `medium` is the default for implementation, refactoring, UI work and mechanical
checks. Reserve Sol — and `high` reasoning — for architecture decisions, tangled multi-file
debugging and trust-layer judgment calls. Output is the expensive half of the rate card, so
long generated files cost far more than long reads.

**1. Check the working directory first.** Run `git log --oneline -1`. If it does not print a
commit from this repository, STOP and say so. That session ran from
`C:\Users\alexa\Documents\ClearSignal`, a folder containing nothing but `.git` — every fact
then had to be re-derived the hard way. The repository is `C:\Claude Code\clearsignal`.

**2. One task, one session.** When a task is done, the session ends. Never continue an
unrelated task in the same session: every step resends the entire history, so a long session
costs more per step than a fresh one. A file read once on step 100 of a 600-step session is
paid for 500 more times.

If the user sends a new `ЗАДАЧА:` / `TASK:` brief into a session that already finished one,
**say so and ask them to open a new session** before doing the work. That single sentence is
the highest-value thing in this file. If a session passes ~60 steps without finishing, stop
and report where you are instead of pushing on.

A context compaction is a warning, not a solution — it means the session should have ended
earlier. Two compactions in one session means stop.

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

**Caveat:** Codex moves finished sessions into `~/.codex/archived_sessions`. Any usage script
that reads only `~/.codex/sessions` will silently undercount — on 2026-08-06 that omission hid
`$74` of spend. Read both directories, and note that the model is recorded per turn in
`turn_context.model`, so cost must be computed per turn rather than assumed uniform.
