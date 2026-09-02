# Orchestrator hardening report

**Date:** 2026-09-02  
**Scope:** local `orchestrator/` only. No deployment, production access, push, or founder-owned product-file change was made.

| Fable finding | Implemented fix | Files / proving test |
|---|---|---|
| C1 Windows `.cmd` spawn fails | Fixed Node entry-point commands for TypeScript, Vitest, and Next replace `npm.cmd`/`npx.cmd`. | `src/test-commands.mjs`, `runner.mjs`, `process.test.mjs`; direct Windows smoke: `tsc: 0`, `vitest: 0`; `npm run build` passed. |
| C2 Codex absent from PATH | Discovery locates the current versioned local Codex executable; Start probes `--version` and reports `CONFIGURATION_REQUIRED`/`AUTH_REQUIRED` rather than starting blindly. Config documents an explicit local override. | `config.mjs`, `server.mjs`, `config.example.json`. |
| C3 restart, attempts, unguarded state | Persistent phase fields, run reconciliation, attempt counting, guarded transitions, an execution lease, and committed-task DB recording were added. An in-flight restart becomes an explicit blocker, never an automatic repeat. | `db.mjs`, `runner.mjs`, `db.test.mjs`. |
| C3/C6 stale worktree reuse | Before an implementer is called, retained uncommitted worktree diff is disclosed in the packet and persisted as an artifact; it is never silently reset. | `runner.mjs`, `git.mjs`. |
| C4 tests/Fable can become PASS | Kernel-side PASS policy requires all required test stages and rejects Fable `BLOCKED`/`FIX_REQUIRED` as a PASS route. The Fable interpretation packet includes diff/tests. | `policy.mjs`, `runner.mjs`, `policy.test.mjs`. |
| C7 stale imported base | The effective base commit is read and persisted only after clean-base preflight passes, immediately before worktree creation. | `runner.mjs`. |
| H2 baseline ambiguity | Each task persists three fixed test stages at the approved base and compares post-change outcomes as new, unchanged, resolved, or pre-existing failures. | `db.mjs`, `policy.mjs`, `policy.test.mjs`. |
| C5 transcript failure classification | Codex classification consumes stderr and typed JSONL error fields only; stdout/model prose is excluded. Unknown reset data remains null. | `process.mjs`, `adapters/codex-exec.mjs`, `process.test.mjs`. |
| C6 pause/cancel/HumanAction bypass | Agent/test boundaries check persisted plan state; cancel reaches `CANCELLED`, not `BLOCKED`; Start/Resume reject any OPEN HumanAction. | `runner.mjs`, `server.mjs`, `policy.mjs`, `policy.test.mjs`. |
| H1 context dropped | Parser retains preamble/rules verbatim, parses explicit dependencies, and adds packet truncation markers. | `plan-parser.mjs`, `runner.mjs`, `plan-parser.test.mjs`. |
| H3/H4 secret exposure | Child processes receive a narrow environment allowlist. Redaction covers JWT, `whsec_`, `re_`, Stripe/OpenAI/Anthropic-style keys and secret-bearing names; no environment dump is stored. | `process.mjs`, `redact.mjs`, `process.test.mjs`, `redact.test.mjs`. |

## Verification

- `npm run test:orchestrator`: **20 passed**.
- `npx tsc --noEmit`: **passed**.
- `npm test`: **90 files passed, 1 skipped; 574 tests passed, 13 skipped**.
- `npm run build`: **passed** (Next.js 14.2.35).
- Windows/Node 24 direct fixed-entry smoke: TypeScript and Vitest completed with exit code 0; the configured build entry point is the same local Next JS entry point and its full build passed.
- Syntax checks: `node --check orchestrator/src/runner.mjs` and `server.mjs` passed.

## Remaining MVP limitations

- TECH_LEAD is a fresh session and role, but not a separate model/provider failure domain. Fable remains the independent deep-review path.
- Restart reconciliation intentionally blocks an orphaned in-flight invocation rather than guessing whether it completed; a founder must make the recovery decision from preserved artifacts.
- The baseline comparison is stage-level. It records bounded signatures but does not attempt a fragile per-test-name diff.
- The local dashboard has no automatic retry scheduling when a provider exposes no reset time; it clearly requires manual resume.

NOT READY FOR ORCHESTRATOR ACCEPTANCE TRIAL
