# Fable red-team review: ClearSignal local orchestrator

**Date:** 2026-09-02
**Reviewer:** Claude Fable 5.1 (architecture and reliability review)
**Scope:** `ORCHESTRATOR_DESIGN.md`, `orchestrator/README.md`, `orchestrator/src/**`, `orchestrator/test/**`,
plus the live environment (Codex CLI 0.152.1, Node v24.18.0, repo at `24fcccf` with a dirty tree).
Nothing was modified. Line numbers refer to the files as of this date.

Evidence labels used throughout:

- **VERIFIED ISSUE** - observed in code or reproduced on this machine.
- **PLAUSIBLE RISK** - follows from the code but was not reproduced end to end.
- **DESIGN PREFERENCE** - a different choice would be nicer; not a defect.

---

## 1. Executive verdict

**SAFE WITH REQUIRED FIXES FIRST.**

The architecture is the right shape for the goal: one deterministic Node kernel, SQLite state outside
the repo, fresh agent sessions per role, an external worktree per plan, schema-constrained model
output, no push and no deploy. None of that needs to change.

The implementation, however, is a vertical slice that does not yet do what the design document
claims, and in its current state it cannot complete a single task:

- The test stage crashes on every attempt because Node 24 refuses to spawn `npm.cmd`/`npx.cmd`
  without a shell (reproduced: `spawn EINVAL`). So no task can ever reach TECH_LEAD assessment.
- The default `codex` command is not on PATH on this machine, so with the shipped config the first
  Start blocks immediately.
- There is no restart recovery, no compare-and-set transition, no lease, and no baseline; the design
  sections E, F, H, I and P describe these as present.
- The kernel does not enforce "tests green before PASS"; that gate lives only in prose in the
  TECH_LEAD prompt.
- Pause, Cancel and Resume all reach unsafe boundaries (details below).

These are hardening fixes to the existing MVP, not a redesign. Until the items in section 13 land,
this tool must not be pointed at real ClearSignal work unattended. It is fine to run it attended,
on a throwaway plan, to exercise the pipeline.

Note on the "known pre-existing failing tests" premise: on the current dirty working tree,
`npx tsc --noEmit` exits 0 and `vitest run` reports 89 files / 570 tests passed, 13 skipped. The
state at committed `HEAD` in a clean worktree was not exercised (that would have required creating
a worktree, which is a modification). The baseline problem is therefore not a today problem, but
the orchestrator has no mechanism for it either way (section 4 below).

---

## 2. Critical findings (must fix before real ClearSignal work)

### C1. Test pipeline crashes on every attempt - VERIFIED ISSUE

`runner.mjs:37-41` spawns `npx.cmd` and `npm.cmd` through `runProcess` (`process.mjs:5`) with no
`shell` option. Node 24 (v24.18.0 on this machine) throws `spawn EINVAL` synchronously for `.cmd`
and `.bat` files without `shell: true` (the CVE-2024-27980 mitigation). Reproduced:

```
node -e "require('child_process').spawn('npm.cmd',['--version'])"  ->  Error: spawn EINVAL
```

The throw happens inside the Promise executor in `runProcess`, so the promise rejects, `runTests`
rejects, `executeTask` rejects, and `runPlan`'s catch (`runner.mjs:159-162`) marks the plan
`BLOCKED` with an `UNKNOWN_FAILURE` event. Consequence: TECH_LEAD instruction and a full
IMPLEMENTER run (up to 60 minutes of Codex quota) are spent, then the plan blocks before any test
runs and before any assessment. No task can ever PASS. Note `orchestrator/test/process.test.mjs`
only spawns `process.execPath`, so the tests do not catch this.

Fix: invoke the JS entry points directly (`spawn(process.execPath, [<path to vitest.mjs>, 'run'])`,
same for `tsc` and `next`), or use `shell: true` with a fixed, non-interpolated command string.

### C2. `codex` is not on PATH; shipped default blocks on the first Start - VERIFIED ISSUE

`config.mjs:12` defaults `codexCommand` to `codex`; `config.example.json` repeats it. Neither the
user nor the machine `PATH` contains the Codex bin directory (checked via the registry-backed
`[Environment]::GetEnvironmentVariable`). The binary is at
`%LOCALAPPDATA%\OpenAI\Codex\bin\87e5fb3433dabab1\codex.exe` (that hash folder changes on
upgrade). `spawn('codex')` emits an `error` event with `ENOENT`; `runProcess` resolves with
`exitCode: null`, and `classifyFailure` (`process.mjs:16-23`) returns `UNKNOWN_FAILURE`, so the plan
blocks on the first TECH_LEAD call. Visible and cheap, but it means the design's "VERIFIED" Codex
claim was verified from a shell with a different PATH than the orchestrator process will have.

Fix: require an absolute `codexCommand` in config and probe it at server start (`codex --version`)
before accepting Start.

### C3. No restart recovery; a restart repeats completed Codex calls and can commit stale work - VERIFIED ISSUE

The design (sections E, F, P) promises leases, compare-and-set transitions, and conversion of
orphaned `RUNNING` runs into `UNKNOWN_FAILURE`. None exist:

- `active` is an in-memory `Map` (`runner.mjs:11`). After a process restart the DB still says
  plan `RUNNING`, task `IMPLEMENTING`/`TESTING`/`TECH_LEAD_REVIEW`, run `RUNNING`. Nothing
  reconciles them at startup (`server.mjs` opens the store and listens; no recovery pass).
- Pressing Start/Resume after a restart does `setPlan(READY)` (`server.mjs:57`) and re-enters
  `runPlan`, which picks the first non-`COMPLETED` task (`runner.mjs:139`) and starts
  `executeTask` at `attempt = 1` with an empty `fixInstruction` (`runner.mjs:73-74`).
- The worktree is reused as-is (`git.mjs:22`, `if (existsSync(path)) return path`), so the new
  attempt 1 IMPLEMENTER starts on top of whatever half-finished diff the killed attempt left,
  without being told so. Then `commitAll` (`git.mjs:32-38`) does `git add -A` and commits all of it.
- Artifact directories are keyed by `plan/task/attempt` (`runner.mjs:75`) and overwritten, so the
  "immutable artifacts" claim does not hold across restarts; `result.json` from a killed run can be
  read back by the next run if Codex exits 0 without writing (`codex-exec.mjs:18`).
- `setPlan`/`setTask` (`db.mjs:46-49`) are unconditional `UPDATE`s: any code path can move any
  state to any state. There is no expected-prior-state check anywhere.

This is the single largest gap between the design and the code, and the one that most directly
answers "can a completed Codex call be repeated after restart" (yes) and "can state and Git
disagree" (yes: `commitAll` at `runner.mjs:107` and `setTask(COMPLETED)` at `runner.mjs:108` are
two separate writes with no transaction; a crash between them leaves a committed task that will be
re-run from scratch on Resume).

### C4. PASS is not gated on test results; the kernel trusts TECH_LEAD prose - VERIFIED ISSUE

`runner.mjs:106` checks only `decision === 'PASS'`. It never checks
`tests.every(t => t.exitCode === 0)`. The instruction "PASS only if the task and all required tests
pass" exists only in the prompt at `runner.mjs:95`. A TECH_LEAD that rationalizes a red build (or
a red build caused by the environment, see section 4) produces a commit on the plan branch and the
next task builds on it. The design's failure table ("Tests fail -> never mark complete") is not
enforced deterministically. Same for the Fable path: after `DEEP_REVIEW_REQUIRED`, Fable's
`FIX_REQUIRED`/`BLOCKED` is passed through a TECH_LEAD interpretation (`runner.mjs:101-104`) and
the kernel accepts whatever decision that interpretation returns, including `PASS`. That
interpretation prompt does not include the diff or tests, only the spec and Fable's JSON.

Fix: `if (decision === 'PASS' && !testsGreen) decision = 'CODEX_FIX'`, and if the deep review said
`FIX_REQUIRED`/`BLOCKED`, the kernel must not accept `PASS` from the interpreter (map Fable
`BLOCKED` to task `BLOCKED` directly).

### C5. `classifyFailure` matches agent output, and can invent a reset time - VERIFIED ISSUE

`process.mjs:17-21` runs regexes over `stdout + stderr`. For Codex, stdout is the entire JSONL
event stream, including every file the agent read and every sentence it wrote. Consequences:

- Any run that failed for an unrelated reason (timeout, non-zero exit, abort) but whose transcript
  contains the words `authentication`, `401`, `quota`, `usage limit`, `429` or `rate limit` is
  classified as `AUTH_REQUIRED` / `MODEL_QUOTA_EXHAUSTED` / `RATE_LIMITED` and pauses the plan with
  a misleading reason. This repo contains `app/api/admin/auth/route.ts` (which says
  "authentication"), rate-limit code and Upstash usage, so the false-positive surface is real.
- The reset capture `/(?:reset|retry(?: after)?)[^\d]*(\d{4}-...|\d+)/i` takes the first number
  after the word "reset" or "retry" anywhere in the transcript. "retry count 3" yields
  `retryAt = "3"`, which is then persisted on the run row and in the pause event as if it were a
  provider-supplied reset. This violates the "never invent quota reset information" rule. The unit
  test covers only the clean `'usage limit reached'` case.

Fix: classify from `stderr` and from Codex `error`-typed JSONL events only, never from agent prose;
accept a reset only if it parses as an ISO timestamp or an integer that appears in a structured
error field.

### C6. Pause, Cancel and Resume reach unsafe boundaries - VERIFIED ISSUE

- **Pause** only takes effect at the top of the task loop (`runner.mjs:135-136`). `executeTask`
  never reads plan status, so a Pause pressed during attempt 1 lets the task run all three attempts,
  including a commit. The README says "between agent/test steps"; the code says "between tasks".
- **Cancel** sets plan `CANCELLED` and aborts the controller (`server.mjs:56`). The killed child
  produces an `error`/`close` with a non-zero or null exit, `classifyFailure` returns
  `UNKNOWN_FAILURE`, and the result handler at `runner.mjs:148-157` overwrites `CANCELLED` with
  `BLOCKED`, emits `PLAN_BLOCKED` and sends a `task_blocked` webhook. The one path that does check
  the signal (`runner.mjs:92`) returns `status: 'PAUSED'`, which is not in the pause list at
  `runner.mjs:150`, so it also becomes `BLOCKED`.
- **Resume** after any stop restarts the current task at attempt 1 in the same dirty worktree (see
  C3), with no record that a previous attempt's diff is present.
- Resume after a `manual_only` HumanAction silently skips the action: `verifyAction`
  (`human-actions.mjs:7`) always returns `ok:false` for `manual_only`, and Start/Resume
  (`server.mjs:57`) never checks for open actions. So the only way past a manual action is a button
  that ignores it, and the action row stays `OPEN` forever (the dashboard then shows the oldest open
  action, not the current one, `db.mjs:44` + `app.js:12`).

### C7. Plan base is captured at import, not at start; the dirty-tree HumanAction produces a stale base - VERIFIED ISSUE

`server.mjs:48` records `baseCommit: await gitHead(...)` at import time. `runPlan` then refuses a
dirty tree and raises a HumanAction whose steps say "commit the changes that belong in the plan
base, then Verify & continue" (`runner.mjs:128`). After the founder commits, `prepareWorktree`
(`runner.mjs:133`) still uses `plan.base_commit` from import time. The orchestrator therefore
implements against the commit *before* the founder's approved changes, on a branch that can no
longer fast-forward onto `main`. The isolation is safe (nothing is lost) but the work is based on
stale state, which is the failure mode the question asked about.

Fix: re-read `HEAD` at Start after the clean-tree check passes and store it on the plan (or fail
Start if `HEAD != base_commit` and no worktree exists yet).

---

## 3. High-priority findings

### H1. Plan packets drop the plan's global rules and dependency section - VERIFIED ISSUE

`plan-parser.mjs:5` keeps only `## <ID>` headings. Run against the real files:

| File | Kept as tasks | Dropped |
|---|---|---|
| `TASKS_FRONTIER_HORIZON_A_V2_1.md` | PHASE-0, A1, A4, A3, A2, A5A, A5B | the execution rules section, the terminology contract, section "0" (order and dependencies), the scope check, the deploy order |
| `TASKS_SHOWCASE_DEPTH.md` | A0..A5, B1..B4 (10) | all acceptance criteria fall back to the generic default (`plan-parser.mjs:29`) |

The dropped sections are exactly the parts a human tech lead reads first. Dependencies are
"previous heading" (`plan-parser.mjs:30`), so the file's own ordering section is ignored. The
TECH_LEAD normalization pass described in design section G is not implemented; the README admits
this, but the consequence (rules never reach any agent) is not stated.

Fix: include the preamble (everything before the first task heading) in every packet, and either
parse an explicit `Depends on:` line or keep source order but say so in the packet.

### H2. No baseline capture; environment-caused failures become fix loops - PLAUSIBLE RISK (mechanism VERIFIED)

There is no run of the test pipeline at `base_commit` before task 1. Every non-zero exit goes to
TECH_LEAD as prose (`runner.mjs:94-95`) with an 8,000-character tail. If `next build` or a test
fails for a reason unrelated to the task (the worktree has no `.env.local` because it is gitignored;
`node_modules` is a junction to the founder's checkout, `git.mjs:28`; Windows path length;
a flaky test), the loop is: CODEX_FIX -> implementer "fixes" the environment symptom in code ->
repeat, three times, up to ~90 minutes of tests per attempt, then `BLOCKED_REQUIRES_ESCALATION`.
See section 4 for the full analysis.

### H3. Full parent environment is inherited by every child process - VERIFIED ISSUE

`process.mjs:3` defaults `env = process.env` and no caller overrides it. Design section O promises a
"minimal environment allowlist". Anything exported in the founder's shell (including
`ORCHESTRATOR_ANTHROPIC_API_KEY` or `ORCHESTRATOR_NOTIFY_WEBHOOK_URL`, which the README tells the
founder to set as environment variables) is visible to Codex, `npm test` and `next build`.

### H4. Redaction misses this project's actual secret formats - VERIFIED ISSUE

`redact.mjs:3` recognises `sk-`, `sk-ant-`, `xox*`, `gh*` prefixes; `redact.mjs:4` catches
`name=value` only when the name contains `api_key|token|password|secret|cookie|authorization`.
`.env.local` here also holds `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY` (JWTs starting
`eyJ`), `STRIPE_WEBHOOK_SECRET` (`whsec_`, caught by name only), `RESEND_API_KEY` (`re_`), and
Upstash values. The read-only Codex sandbox permits reading anywhere on disk, so a Codex run that
opens `C:\Claude Code\clearsignal\.env.local` (one directory hop from the worktree, and the file is
named in `CLAUDE.md`) writes the service-role JWT unredacted into `agent-events.jsonl` under
`%LOCALAPPDATA%`, and sends it to OpenAI. This is not new exposure relative to the founder's
existing Codex use in the main checkout, but the orchestrator's design claims protection it does not
deliver.

### H5. "One plan at a time" is not enforced - VERIFIED ISSUE

`runPlan` guards only against the same plan running twice (`runner.mjs:120`). Two imported plans can
be started concurrently; both create worktrees and branches in the founder's repo, both run
`next build` against the same junctioned `node_modules`, and both write to `.git` concurrently.

### H6. Any unrecognised TECH_LEAD decision is treated as CODEX_FIX; the same-blocker early stop is missing - VERIFIED ISSUE

`runner.mjs:106-114`: after PASS/HUMAN/BLOCKED are excluded, every other value (`IMPLEMENT`,
`DEEP_REVIEW_REQUIRED` returned twice, `CODEX_FIX`) falls into the fix branch. The design's
"identical blocker fingerprint on consecutive attempts stops early" (section H) is not implemented,
so a reviewer that repeats the same objection burns all three rounds. The initial instruction call
also treats `PASS`/`CODEX_FIX`/`DEEP_REVIEW_REQUIRED` as `IMPLEMENT` (`runner.mjs:80-81` only
handle two values).

### H7. Fable refusal and `max_tokens` truncation are not handled - PLAUSIBLE RISK

`anthropic.mjs:40-43` reads `content` text without checking `stop_reason`. Fable 5.1 can return
`stop_reason: "refusal"` (HTTP 200, empty or partial content) or `max_tokens` (8,192 cap at
`anthropic.mjs:26`, while the prompt can carry a 60,000-character diff plus 24,000 characters of test
tails plus a 22,000-character spec). Either yields `FAILED invalid_output`, which the runner maps to
plan `BLOCKED` (not in the pause list), so a single truncated review blocks the plan. HTTP 529
(overloaded) also maps to `UNKNOWN_FAILURE` -> `BLOCKED` rather than a retry. The request body
itself is valid for Fable 5.1 (`output_config.effort` is the correct GA parameter; thinking is
always on, so omitting `thinking` is correct).

---

## 4. Medium / low findings

- **M1. `git add -N -- .` then `git add -A` commits everything in the worktree** (`git.mjs:15,33`),
  including scratch files Codex leaves behind that are not gitignored at `HEAD` (`tmp/` is
  untracked, not ignored). VERIFIED ISSUE, low impact.
- **M2. Codex trust and Windows sandbox are unprobed for the worktree path.** The worktree lives
  under `%LOCALAPPDATA%\ClearSignalOrchestrator\...`, which is not in the `[projects]` trust list in
  `~/.codex/config.toml`; that config also sets `[windows] sandbox = "elevated"` and a `notify`
  hook that launches `codex-computer-use.exe` after every turn. Whether `-s read-only` is actually
  enforced on Windows, and whether the junctioned `node_modules` counts as inside the writable root
  under `workspace-write`, were not verified. PLAUSIBLE RISK; the acceptance trial must probe both.
- **M3. Reviewer schema is unused.** `schemas/reviewer.schema.json` exists but the Anthropic call
  sends free text and extracts a fenced block by regex (`anthropic.mjs:41`). `output_config.format`
  (structured outputs) would enforce it. DESIGN PREFERENCE, cheap to do.
- **M4. Diff and test truncation are silent.** `runner.mjs:94` slices the diff at 60,000 characters
  and `runner.mjs:50` keeps 8,000-character tails with no marker in the packet. A reviewer cannot
  tell it is looking at a partial diff. VERIFIED ISSUE, low.
- **M5. `retry_at` is stored but never used.** No timer, no display in the UI (`app.js` shows only
  `public_message`). The design's "Paused because the OpenAI/Codex usage limit was reached. Automatic
  reset time is not available" text is not surfaced. VERIFIED, low; manual Resume is acceptable for
  an MVP as long as the UI says so.
- **M6. Start on a `COMPLETED` plan re-completes it and re-sends the completion webhook**
  (`server.mjs:57` -> `runner.mjs:141-143`). Low.
- **M7. Fix instruction is overwritten, not accumulated** (`runner.mjs:114`). Attempt 3's
  implementer never learns what attempt 1 was told. DESIGN PREFERENCE with a plausible oscillation
  risk.
- **M8. The implementer's `summary` becomes the commit subject** (`git.mjs:36`), untrusted model
  text; harmless because it is an argv element, not a shell string.
- **M9. Task status is set to `TECH_LEAD_REVIEW` during the instruction stage too** (`runner.mjs:28`),
  so the dashboard cannot distinguish "writing instruction" from "assessing". Cosmetic.
- **M10. `git` calls have a 120 s cap** (`git.mjs:6`) and no abort signal, so Cancel cannot
  interrupt a Git operation. Consistent with design section P ("finish the atomic Git command").
  Not a defect.

---

## 5. TECH_LEAD independence verdict

**Different session and different prompt: yes. Different model: no. Genuinely independent reviewer: no.**

- `config.mjs:13` sets `implementerModel` and `techLeadModel` both to `gpt-5.6-terra`; the same CLI,
  the same ChatGPT login, the same provider, the same training. The assessment call
  (`runner.mjs:95`) receives the implementer's own self-report (`implementation.output`), the diff
  and the test JSON. It is a second sample from the same distribution with a reviewer prompt.
- That is still worth having: a fresh context does catch sloppy or incomplete output, and the
  read-only sandbox lets it inspect files the diff does not show. It is not a check against
  correlated blind spots (a misunderstanding of the spec, a trust-layer subtlety, a Windows-specific
  assumption) because both roles share them.
- The only model-diverse check is the Fable deep review, and it is (a) discretionary, triggered by
  the TECH_LEAD's own judgment, (b) blind to the repository, it sees a truncated diff and test tails,
  and (c) advisory, because its verdict is re-interpreted by the TECH_LEAD without the diff
  (`runner.mjs:101`) and the kernel accepts the interpretation.
- The deterministic checks that should make model correlation tolerable (tests green, tsc clean,
  build green, forbidden-path policy) are either not enforced (C4) or not implemented (no path
  policy for `lib/sanitize.ts`, `lib/report-validator.ts`, `app/api/stripe/webhook`, migrations).

Minimal fix: keep the current TECH_LEAD transport, but (1) make the test gate deterministic, (2) add
a deterministic forbidden-path check that forces `DEEP_REVIEW_REQUIRED` and a human decision when
touched, (3) make Fable's `FIX_REQUIRED`/`BLOCKED` binding, and (4) when the OpenAI API key is
repaired, run TECH_LEAD on a different model than the implementer by default.

## 6. State-machine verdict

**Not safe for unattended operation.** Concretely:

| Question | Answer | Evidence |
|---|---|---|
| Task marked PASS incorrectly | Yes | C4 |
| Task runs twice | Yes, on any Resume or restart | C3, C6 |
| Completed Codex call repeated after restart | Yes, from attempt 1 | C3 |
| State and Git disagree | Yes, crash between commit and `setTask` | C3 |
| Retries create duplicate work | Yes, same worktree, no notice of prior diff | C3 |
| Infinite loop | No: `max_attempts` bounds the fix loop, and there is no automatic retry timer | `runner.mjs:74` |
| Pause/Resume from an unsafe boundary | Yes | C6 |

There is no state-machine module (`state-machine.mjs` and its test are in the design's file list but
absent). Transitions are ad-hoc `UPDATE`s. The minimal fix is a single `transition(table, id, from[],
to)` helper that throws when the current status is not in `from`, plus a startup reconciliation
that marks orphaned `RUNNING` runs `UNKNOWN_FAILURE` and never auto-resumes them.

## 7. Git / data-safety verdict

**The founder's dirty changes are safe. The orchestrator's own work is not yet safe.**

- Nothing in the code stashes, resets, cleans, checks out or commits in the founder's checkout. The
  only writes to the main repo are `git worktree add` (writes to `.git/worktrees` and a new branch)
  and reads. Verified by reading every `git(...)` call in `git.mjs`. There is no `push` anywhere.
- The refusal on a dirty tree (`runner.mjs:126-130`) is correct and conservative. Its practical cost:
  the founder must commit or relocate 33 untracked paths (images, `tmp/`, `supabase/.temp/`, the
  orchestrator itself) before the tool will start. Expect this to push the founder toward one big
  "commit everything" on `main`, which is a workflow risk rather than a tool defect.
- Stale base at Start (C7), reuse of a dirty worktree across attempts and restarts (C3), and commit of
  all worktree contents (M1) are the real gaps. The junctioned `node_modules` (`git.mjs:28`) is a
  shared mutable surface between the worktree and the founder's checkout; `npm install` or Vite/Next
  cache writes from an agent inside `workspace-write` may land in the founder's `node_modules`.
  PLAUSIBLE RISK.
- Prior detached worktrees (`C:/cs-a1-staged-verify-2`, `C:/cs-a3-verify*`) are already `prunable`
  in `git worktree list`; the orchestrator does not prune, which is correct, but it also never
  checks for stale entries with the same path, so a manual deletion of a worktree folder without
  `git worktree prune` makes the next `worktree add` fail with an unhelpful message.

## 8. HumanAction verdict

**Partially meets the protocol. The one verifiable action (clean Git tree) works; every other
action is unverifiable and can be bypassed.**

- Persisted as a first-class row: yes (`db.mjs:58-64`).
- Stops at the correct point: yes for the Git preflight and for model-raised actions (the runner
  returns immediately). The stop is not transactional with the task's status though: the task keeps
  `IMPLEMENTING`/`TECH_LEAD_REVIEW` while the plan says `HUMAN_ACTION_REQUIRED`.
- Explains what is required: for the Git preflight, yes. For model-raised actions the explanation
  is whatever the model put in `human_action` (`runner.mjs:21-24`), with no schema beyond
  `type: object|null`; an empty object produces the generic fallback text.
- Verifies before continuing: only `command: git` with `expectEmpty` (`human-actions.mjs:9-12`). The
  design's `http`, `database` and `manual_only` verifiers are not implemented; `manual_only` cannot
  be completed at all through the UI.
- Does not trust "Done" blindly: technically true, because there is no Done button. But Start/Resume
  is a Done button that also skips verification (C6).

For Supabase SQL specifically: there is no representation of "SQL to run" as a separate artifact
(design section J says payloads live in an artifact), no `database` verifier, and the implementer's
`workspace-write` sandbox has no route to Supabase, so a migration task will surface as a model-raised
`HUMAN_ACTION_REQUIRED` with prose steps, and the founder will have to press Resume to continue,
after which the next task runs with no evidence the SQL was applied.

Minimal fix: (1) block Start/Resume while any action is `OPEN` unless the founder explicitly marks it
`ACKNOWLEDGED` with a typed reason that is stored; (2) write model-supplied payloads to
`artifacts/.../human-action.md`; (3) add an `http` GET verifier (status code only) since the app has a
health endpoint, and leave `database` for later.

## 9. Quota / restart verdict

**Anthropic side: acceptable. Codex side: unreliable classification, and no restart story.**

- Anthropic: 401/403 -> `AUTH_REQUIRED`; `enforced_spend_limit_reached` or "usage/spend limit" text
  -> `MODEL_QUOTA_EXHAUSTED`; 429 -> `RATE_LIMITED` with `retry-after` honoured only when it is an
  integer (`anthropic.mjs:30-37`). Reset is never invented on this path. Gaps: 529/5xx and network
  errors become `UNKNOWN_FAILURE` and block the plan instead of pausing; refusal/truncation (H7).
  Also note the reviewer uses the product's own `ANTHROPIC_API_KEY` from `.env.local`
  (`anthropic.mjs:18`), so a long review session draws down the same spend cap that production
  audits use. DESIGN PREFERENCE with a real operational consequence; a separate key is the cheap fix.
- Codex: classification is regex-over-transcript (C5). Authentication expiry will most likely
  surface as a non-zero exit with a login message on stderr, which the `AUTH_REQUIRED` regex would
  catch, but so will a transcript that merely mentions authentication. Unfamiliar errors correctly
  fall to `UNKNOWN_FAILURE`, but that then blocks rather than pauses, so an unfamiliar transient
  error costs the founder a manual Resume that restarts the task from attempt 1.
- Nothing is scheduled on `retry_at`; the plan simply sits `PAUSED`. For an MVP that is acceptable
  and honest, provided the UI says "waiting for you" and shows the stored reset (it does not, M5).
- Restart: see C3. There is no lease, no owner id, no startup reconciliation.

## 10. Security verdict

**Loopback dashboard and command construction are sound. Secret handling does not meet the
design's own bar.**

- Good: binds `127.0.0.1` with a Host check (`server.mjs:38`); per-launch CSRF token on all
  non-GET API calls (`server.mjs:40`); every child is spawned with an argv array, no shell; the
  verifier allowlist is `git` only and its args come from rows the kernel wrote; static file serving
  is confined to `ui/`; `safePlanPath` confines plan imports to the repo; model output reaches the
  kernel only through enum fields and is never executed. The UI renders model text with
  `textContent`, not `innerHTML`. Webhook payloads carry ids and statuses only.
- Not good: full environment inheritance (H3); redaction gaps for this project's real secrets (H4);
  agents can read the founder's `.env.local` from the worktree via the read-only sandbox; the API
  key is read from `.env.local` in memory (fine) but the same process passes `process.env` on, so
  if the founder sets `ORCHESTRATOR_ANTHROPIC_API_KEY` as instructed, Codex inherits it.
- Prompt injection from repository files: the attack surface is real (golden JSON under
  `evals/golden/` contains scraped third-party web text; Codex reads whatever it decides to), but the
  blast radius is bounded by the sandbox and by the kernel executing only enum decisions. The
  meaningful injection outcome would be a manipulated `PASS`, which C4 already makes possible without
  injection. Acceptable for MVP once C4 is fixed.
- Accidental production mutation: the worktree has no `.env.local`, tests are mocked, Codex
  `workspace-write` disables network by default, and no code path runs Trigger, Vercel, Supabase or
  `git push`. The residual path is an agent reading the main checkout's `.env.local` and a future
  sandbox mode permitting network. Low today.

## 11. Fable escalation-policy verdict

**Efficient in shape, ungrounded in practice.**

- Fable is invoked only on `DEEP_REVIEW_REQUIRED` (`runner.mjs:98-99`), never for planning or
  normalization, with `effort: 'high'` (`anthropic.mjs:16`) and an 8,192-token output cap. Worst
  case is one Fable call per attempt, three per task, thirty per ten-task plan, with no cap.
- The trigger is one sentence in the TECH_LEAD prompt ("only for architecture, trust, methodology,
  high-risk, or genuinely complex ambiguity"). There is no deterministic trigger for the cases that
  actually warrant it in this repo: diffs touching `lib/sanitize.ts`, `lib/report-validator.ts`,
  `app/api/stripe/**`, `supabase/**`, Trigger task files, or a third attempt on the same task.
- What Fable receives is the weakest possible packet for a deep review: a truncated diff, test
  tails, and the implementer's self-summary; no TECH_LEAD reasoning for why it escalated, no file
  context, no ability to read the repo. Paying Fable rates for a diff-only opinion is the inefficient
  part, not the frequency.
- Fable's verdict is advisory (C4). A binding verdict makes each call worth more.

Minimal policy: deterministic path-based escalation plus "third attempt", a cap of two Fable calls
per task, include the TECH_LEAD's assessment JSON and the full (untruncated, or explicitly marked)
diff, and make `BLOCKED`/`FIX_REQUIRED` binding. Effort `high` is right for these; `xhigh` is not
needed for diff review.

## 12. What Codex implemented particularly well

- **Scope discipline.** No push, no deploy, no Supabase, no stash/reset/clean; refusal on a dirty tree
  instead of guessing. The design's hard "never" list is honoured everywhere it was checked.
- **Command construction.** Every process is argv-based, stdin is explicitly closed with the prompt
  (`process.mjs:12`), and the Codex flags used (`--json`, `--output-schema`, `--output-last-message`,
  `-s`, `-c approval_policy`, `-C`, `-`) all exist in the installed CLI 0.152.1.
- **Loopback server.** Host check, CSRF, path confinement and static-file confinement are all
  present in 77 lines and are correct as far as reviewed.
- **Honest README.** The "Current MVP limits" section states most of the gaps (manual cleanup,
  Git-only verifier, conservative classification). It understates Pause and omits restart.
- **Plan parser fallback.** A file with no ID headings becomes one task named from the filename rather
  than failing, and duplicate IDs are rejected.
- **Anthropic error mapping** distinguishes spend cap from rate limit and only trusts an integer
  `retry-after`.
- **Small, readable code.** Roughly 500 lines of source; every finding above was traceable to a
  single line, which is exactly what makes minimal hardening feasible.

## 13. Minimal required fixes (in order)

Must-do before any real ClearSignal task:

1. **Spawn fix** (C1): invoke `tsc`, `vitest` and `next` through `process.execPath` on their JS entry
   points, or `shell: true` with a constant command string. Add a test that spawns a real `.cmd`.
2. **Absolute `codexCommand` and a startup probe** (C2): fail fast at server start with a clear
   message if `codex --version` does not run.
3. **Deterministic PASS gate** (C4): `PASS` requires all three test stages exit 0; Fable
   `BLOCKED`/`FIX_REQUIRED` cannot be turned into `PASS` by the interpreter.
4. **Startup reconciliation and guarded transitions** (C3): on boot, mark `RUNNING` runs
   `UNKNOWN_FAILURE`, set their task `BLOCKED` and the plan `BLOCKED`; add a `transition()` helper
   with an expected-prior-state check for plan and task; wrap `commitAll` + `setTask(COMPLETED)` in
   one transaction after the commit SHA is known; persist `attempt_count` and start the next attempt
   from `attempt_count + 1`, never from 1.
5. **Worktree state disclosure on retry** (C3/C6): before an implementer run, if `git status` in the
   worktree is non-empty, write the diff to the packet with a line "A previous attempt left these
   uncommitted changes", or reset the worktree to the plan branch head after archiving the diff as an
   artifact. Either is safe; silent reuse is not.
6. **Pause/Cancel semantics** (C6): check plan status before every agent call and every test stage;
   map an aborted run to the plan's existing `PAUSED`/`CANCELLED` status instead of `BLOCKED`; block
   Start/Resume while a HumanAction is `OPEN`.
7. **Base commit at Start** (C7): re-read `HEAD` after the clean-tree check and store it.
8. **Classification from structured evidence only** (C5): drop the transcript regexes; keep
   `retryAt = null` unless an ISO timestamp or integer seconds appears in a structured error.
9. **Baseline run** (H2): run the three test stages once at `base_commit` in the worktree before
   task 1; store per-stage exit codes; a stage that was already red at baseline is reported to
   TECH_LEAD as `PRE_EXISTING` and does not count against PASS for that stage, and a stage that
   flips red is `NEW_REGRESSION`. Do not try to diff individual test names in the MVP.
10. **Include the plan preamble in every packet** (H1) and mark truncation explicitly (M4).
11. **Environment allowlist for children** (H3) and add JWT (`eyJ...`), `whsec_`, `re_` and
    `sk_live_|sk_test_` patterns to `redact.mjs` (H4).

Should-do before leaving it alone for hours:

12. Global "one plan running" lock (H5); same-blocker early stop and explicit handling of
    unexpected decisions (H6); handle `stop_reason` and raise `max_tokens` for the reviewer (H7);
    deterministic Fable escalation on sensitive paths with a per-task cap (section 11).

Not required: a rewrite, a state-machine framework, parallel tasks, the OpenAI Responses adapter,
or the app-server. The existing structure carries all of the above as local edits.

---

### Appendix: unattended ten-task walk-through (as shipped)

1. Founder imports a plan, presses Start. Tree is dirty -> HumanAction. Founder commits 33 paths to
   `main`, presses Verify & continue. Plan starts against the pre-commit `HEAD` (C7).
2. TECH_LEAD instruction call: `spawn codex` -> `ENOENT` -> plan `BLOCKED` within a second (C2).
   Founder sets an absolute path, presses Resume.
3. Instruction call succeeds. Implementer runs up to 60 minutes. `runTests` throws `spawn EINVAL`
   -> plan `BLOCKED` (C1). Quota spent: two Codex sessions. Nothing committed. Founder sees
   "spawn EINVAL" in the event list.
4. With C1 and C2 patched but nothing else: task 1 implementer works in a worktree without
   `.env.local`; if `next build` or a test depends on it, three fix rounds and up to several hours
   pass, then `BLOCKED_REQUIRES_ESCALATION` (H2). If the build is green, TECH_LEAD may PASS on a red
   vitest stage (C4), commit, and task 2 starts on broken code. Later the machine sleeps; on wake the
   Codex child has died, the run stays `RUNNING` forever (C3) until the founder presses Resume,
   which restarts the current task from attempt 1 over the abandoned diff.

Each step above maps to an item in section 13; none requires new architecture.
