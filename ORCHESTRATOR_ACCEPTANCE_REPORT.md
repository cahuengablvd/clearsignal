# Orchestrator acceptance trial

**Date:** 2026-09-02  
**Repository base observed:** `98a0eac Harden pre-delivery GEO measurement semantics`  
**Scope:** local orchestrator only. No deployment, push, Supabase action, production mutation, or founder-owned file modification was performed.

## Verdict

**NOT YET SAFE FOR CONTROLLED REAL CLEARSIGNAL TASKS**

The acceptance trial cannot honestly proceed to a live normal loop from this checkout: `git status --porcelain` is non-empty, including founder-owned changes and an untracked `orchestrator/` directory. This is correctly rejected by the runner's clean-base preflight. More importantly, source inspection and the existing restart test disprove the required recovery contract: `Store.reconcileRunning()` changes every persisted `RUNNING` boundary to `UNKNOWN_FAILURE`, then blocks the task and plan. `runPlan()` has no persisted-phase resume routing; a resumed non-completed task re-enters `executeTask()` at TECH_LEAD rather than continuing at tests or assessment.

## Execution environment

- Main checkout: `C:\Claude Code\clearsignal`.
- Observed base SHA: `98a0eac`.
- No execution worktree was created: clean-base preflight would reject the dirty founder checkout, and no safe, committed isolated execution base containing the current untracked orchestrator exists.
- No production hooks were invoked. No task-generated commit or agent invocation occurred.

## Scenario results

| # | Scenario | Result | Concrete evidence |
|---:|---|---|---|
| 1 | Safe execution environment | PARTIAL | Main checkout dirty at preflight; `runner.mjs` creates a clean-base HumanAction and does not stash, reset, commit, push, or deploy. No disposable worktree/run could be truthfully exercised. |
| 2 | Real normal loop | NOT TESTABLE | Blocked before start by the required clean-base precondition. No task/run ID exists. |
| 3 | Interrupt after implementation | FAIL | `Store.reconcileRunning()` marks the persisted IMPLEMENTER run `UNKNOWN_FAILURE`, task `BLOCKED`, and plan `BLOCKED`; it does not resume at tests. Proven by `orchestrator/test/db.test.mjs` "reconciles restart without repeating a run". |
| 4 | Interrupt after tests | FAIL | The same reconciliation treats a running test/assessment boundary as orphaned and blocks it. `runPlan()` does not branch from persisted `phase` or reuse persisted POST tests. |
| 5 | Interrupt during/around assessment | FAIL | An in-flight TECH_LEAD run is likewise changed to `UNKNOWN_FAILURE`; no durable completed-assessment detection or assessment-only retry route exists. Implementation non-replay is not demonstrated. |
| 6 | FIX_REQUIRED loop | NOT TESTABLE | The code has a bounded three-attempt loop and creates fresh agent runs, but the required live first-fail/fix/pass lifecycle was not executed. |
| 7 | Fable BLOCKED contract | PASS | `orchestrator/test/policy.test.mjs` proves `passAllowed()` rejects both `BLOCKED` and `FIX_REQUIRED`; `runner.mjs` returns `BLOCKED` immediately for a Fable `BLOCKED` result. |
| 8 | One real Fable escalation | NOT TESTABLE | Not run: no clean isolated plan could start. No Anthropic call was made and no secret was accessed or exposed. |
| 9 | HumanAction lifecycle | FAIL | Only `OPEN` and `VERIFIED` are persisted. Failed verification creates an event but retains `OPEN`; there are no persisted `VERIFYING` or `VERIFICATION_FAILED` states required by the trial. Open actions are correctly rejected on Start/Resume. |
| 10 | Pause | FAIL | `POST /pause` immediately writes `PAUSED`; it does not first record `PAUSE_REQUESTED` while an external call remains active. Therefore the dashboard can claim a stopped state before the safe boundary. |
| 11 | Cancel | PARTIAL | Code distinguishes `CANCEL_REQUESTED` and `CANCELLED`, and the runner's cancellation branch does not create a blocker notification. It was not exercised with a live child process or restart. |
| 12 | Lease / duplicate execution | PARTIAL | Unit test rejects a competing `active-plan` lease. `acquireLease()` allows expired-lease takeover, but two actual processes and an observed stale-lease recovery event were not exercised. |
| 13 | Provider failure state machine | PARTIAL | Unit coverage verifies quota classification without invented reset, structured reset handling, and ordinary model prose not producing provider state. All requested injected classes and paused-quota restart were not exercised end-to-end. |
| 14 | Baseline / regression | PARTIAL | Unit coverage distinguishes a new from unchanged stage failure. It does not execute all four requested baseline cases; a reduced internal test count/skipped test is not explicitly detected by the stage-level comparison. |
| 15 | Plan parsing | PASS | `plan-parser.test.mjs` proves preserved plan-level constraints and explicit dependencies. Packets include the stored preamble in `runner.mjs`. |
| 16 | Secret boundary | PARTIAL | `process.test.mjs` proves arbitrary founder shell values are excluded; redaction tests cover bearer/common/project key forms. No isolated live worktree packet/event trail was generated to inspect. |
| 17 | Full three-task plan restart | FAIL | The same restart reconciliation blocks the current task/plan, rather than resuming task 2 from a persisted boundary. No completed-task skip lifecycle was exercised. |
| 18 | Dashboard acceptance | FAIL | The UI exposes controls/state, but required truthful states are not all represented by the state machine: notably no durable `PAUSE_REQUESTED`, `VERIFYING`, or `VERIFICATION_FAILED`. |
| 19 | Event trail | FAIL | Important transitions can occur without an append-only event: the server writes `PAUSED` and `CANCEL_REQUESTED` directly. Thus the trail cannot reconstruct every transition. |
| 20 | Final verification | PASS | `npm run test:orchestrator`: 20/20 passed; `npx tsc --noEmit`: passed; `npm test`: 90 files passed, 1 skipped; 574 passed, 13 skipped; `npm run build`: passed (Next 14.2.35). |

## Verified

- Test, TypeScript, Vitest, and build checks above pass on this checkout.
- A dirty founder checkout is conservatively refused before a worktree/agent run.
- PASS is deterministically denied after failed/missing test stages and after Fable `BLOCKED`/`FIX_REQUIRED`.
- Parser context, child-environment allowlisting, and secret redaction have deterministic unit coverage.
- A competing execution lease is rejected by the Store unit test.

## Unconfirmed

- A real TECH_LEAD -> IMPLEMENTER -> tests -> assessment -> commit lifecycle.
- All real interruption boundaries, correction-loop invocation isolation, real Fable metadata capture, HumanAction verification lifecycle, two-process lease ownership, and a three-task restart.
- Dashboard wording and event reconstruction during a live plan.

## Limitations and blocking findings

1. There is no safe clean execution base for the current untracked orchestrator while the founder checkout is dirty.
2. Restart is intentionally conservative but incompatible with this acceptance brief: all `RUNNING` boundaries become blocked, rather than safely continuing after a completed persisted boundary.
3. HumanAction, pause, and event-trail state semantics do not meet the requested contract.
4. Passing unit/build checks cannot substitute for the required interrupted-execution acceptance scenarios.

No real ClearSignal roadmap task was started. Production deployment remains disabled; destructive external work remains outside this trial and would require HumanActions.
