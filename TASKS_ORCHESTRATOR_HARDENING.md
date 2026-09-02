# Orchestrator hardening implementation specification

**Source:** Fable red-team review, section 13 (2026-09-02).  **Scope:** the existing local Node/SQLite orchestrator only; no deployment, production access, or architecture redesign.

## Mandatory verified issues

### H1 — Windows-safe test execution (VERIFIED ISSUE: C1)

- **Problem/evidence:** Node 24 rejects direct `npm.cmd`/`npx.cmd` spawns with `spawn EINVAL`; `runner.mjs` therefore blocks every plan before assessment.
- **Affected code:** `orchestrator/src/runner.mjs`, `process.mjs`, `test/process.test.mjs`.
- **Deterministic behavior:** resolve local JavaScript entry points and invoke them with `process.execPath`; command/argument arrays remain kernel-owned.
- **Failure behavior:** a missing entry point or non-zero test result is recorded as `TEST_EXECUTION_ERROR`/`TESTS_FAIL`, never shell-executed or treated as pass.
- **Tests/acceptance:** unit-test the command abstraction and locally execute all configured test stages on Windows/Node 24.
- **Fallback:** no generic shell fallback for model-controlled command text.

### H2 — Codex discovery and preflight (VERIFIED ISSUE: C2)

- **Problem/evidence:** default `codex` is absent from PATH, yielding `ENOENT` and an opaque block.
- **Affected code:** `config.mjs`, `server.mjs`, `process.mjs`, UI, tests.
- **Deterministic behavior:** accept an explicit absolute configured executable or discover the current Codex install under the supported local application location; probe `--version` before Start and retain only the resolved invocation path.
- **Failure behavior:** return `CONFIGURATION_REQUIRED`/`AUTH_REQUIRED` with a clear dashboard message; never pretend the executable is available.
- **Tests/acceptance:** discovery is injectable/testable; an unavailable executable blocks before agent work.
- **Fallback:** documented `config.local.json` absolute path, never a hard-coded machine path in shipped config.

### H3 — Durable boundaries, guarded transitions, and lease (VERIFIED ISSUE: C3; H5)

- **Problem/evidence:** run state is memory-only, updates are unconditional, restart resets attempts, and plans may run concurrently.
- **Affected code:** `db.mjs`, `runner.mjs`, `server.mjs`, tests.
- **Deterministic behavior:** persist attempt/run phase; compare-and-set transitions validate expected prior state; acquire one SQLite global execution lease; startup reconciliation changes orphaned RUNNING executions to explicit safe blocked/recovery state. Resume starts only at the persisted next boundary and never repeats a completed invocation.
- **Failure behavior:** conflict/active lease is rejected; stale lease requires deliberate recovery; unknown in-flight work becomes `BLOCKED`/`UNKNOWN_FAILURE`, not implicitly retried.
- **Tests/acceptance:** restart after implementation and after tests, duplicate lease rejection, and rejected invalid transition.
- **Rollback/fallback:** retained worktree/artifacts disclose any uncommitted diff to the next implementer; no reset/stash/clean.

### H4 — Git base and task-only commits (VERIFIED ISSUE: C3/C7/M1)

- **Problem/evidence:** import captures a stale base before the clean-base HumanAction; `git add -A` can commit pre-existing files.
- **Affected code:** `server.mjs`, `runner.mjs`, `git.mjs`, tests.
- **Deterministic behavior:** establish and persist base commit after clean preflight; worktree is external and branch-isolated; record the generated diff/name list and commit only files changed from the approved base for this task.
- **Failure behavior:** dirty founder checkout remains a HumanAction; base mismatch or unexpected pre-existing worktree changes blocks/discloses rather than silently reusing or committing them.
- **Tests/acceptance:** base captured after verification; task commit excludes pre-existing unrelated changes.
- **Fallback:** preserve diff artifacts and worktree; never alter founder checkout.

### H5 — Hard test and review gates (VERIFIED ISSUE: C4)

- **Problem/evidence:** a TECH_LEAD response may turn failed/missing tests or a Fable `BLOCKED` into PASS.
- **Affected code:** `runner.mjs`, `db.mjs`, tests.
- **Deterministic behavior:** persist `TESTS_PASS`, `TESTS_FAIL`, or `TEST_EXECUTION_ERROR`; PASS requires all required post-change stages to be green unless classified pre-existing baseline failure. Fable `BLOCKED` remains blocked; `FIX_REQUIRED` cannot be interpreted as PASS. Interpretation receives diff and test evidence.
- **Failure behavior:** assessment returns a fix route or terminal blocker; it cannot commit/pass.
- **Tests/acceptance:** PASS impossible after failed/missing tests; Fable BLOCKED cannot pass.

### H6 — Baseline comparison (PLAUSIBLE RISK; mechanism VERIFIED: H2)

- **Problem/evidence:** no baseline test capture means environmental/pre-existing red stages are indistinguishable from regressions.
- **Affected code:** `runner.mjs`, `db.mjs`, tests.
- **Deterministic behavior:** run and persist the three fixed test stages at the approved base before modification, including command, exit code and bounded output signature/count; compare post-change status as `PRE_EXISTING_FAILURE`, `NEW_REGRESSION`, `RESOLVED_FAILURE`, or `UNCHANGED_FAILURE` and surface skipped/disappeared stages.
- **Failure behavior:** a new regression blocks PASS; a baseline failure is transparent to TECH_LEAD and cannot be misreported as new.
- **Tests/acceptance:** deterministic mocked baseline/post-state comparison.

### H7 — Structured failure classification (VERIFIED ISSUE: C5)

- **Problem/evidence:** regexes scan whole model transcripts, turning ordinary words such as “authentication” and “retry count 3” into provider state/reset metadata.
- **Affected code:** `process.mjs`, `adapters/codex-exec.mjs`, tests/UI.
- **Deterministic behavior:** classification uses exit code, structured error payload/stderr, and explicitly typed metadata only; reset is ISO time or structured integer seconds, otherwise `null`.
- **Failure behavior:** unknown reset renders as unavailable; agent prose is never quota/auth evidence.
- **Tests/acceptance:** normal prose false positives do not classify; unknown quota reset stays null.

### H8 — Pause, cancel, and HumanAction gate (VERIFIED ISSUE: C6)

- **Problem/evidence:** pause waits until whole task, cancel becomes BLOCKED, and Resume ignores open HumanActions.
- **Affected code:** `runner.mjs`, `server.mjs`, `db.mjs`, `human-actions.mjs`, UI/tests.
- **Deterministic behavior:** check status before each agent/test boundary; retain distinct `PAUSED`, `CANCEL_REQUESTED`, `CANCELLED`, and `BLOCKED`; only verified HumanActions permit execution.
- **Failure behavior:** an interrupt during an uninterruptible boundary records cancellation requested and stops at the next boundary; cancel never creates a blocker notification.
- **Tests/acceptance:** unresolved action cannot bypass; cancel does not become BLOCKED.

### H9 — Preserve plan context and secrets (VERIFIED ISSUE: H1/H3/H4/M4)

- **Problem/evidence:** parser drops preamble/rules/dependencies and packet truncation is invisible; all child processes inherit secrets and redaction misses project formats.
- **Affected code:** `plan-parser.mjs`, `runner.mjs`, `process.mjs`, `redact.mjs`, adapters, tests.
- **Deterministic behavior:** retain plan preamble/raw unparsed sections and explicit dependency declarations in every packet; visibly mark truncation. Child environment is allowlisted, task context excludes `.env.local`, and logs redact JWT, Stripe, Supabase, Resend, Anthropic/OpenAI patterns without logging full environment values.
- **Failure behavior:** ambiguous parser material is preserved for TECH_LEAD; no secret file is copied into a worktree/context.
- **Tests/acceptance:** real-style preamble preserved and representative secrets redacted.

## Non-mandatory review notes

The reviewer schema/output preference and broader architecture changes are **DESIGN PREFERENCES** and excluded. Same-blocker early stopping, reviewer truncation handling, and global one-plan lock are small hardening additions only where needed to make the mandatory execution guard safe. TECH_LEAD remains a fresh role/session, not an independent model or provider failure domain; Fable remains the independent deep-review escalation path.

## Completion criteria

No deployment or production action occurs. The changed orchestrator has deterministic unit coverage for every mandatory behavior named in the request, and passes orchestrator tests, TypeScript, application build, full Vitest, and a local Windows subprocess smoke test. The final report records exact results and one readiness verdict.
