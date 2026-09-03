# Orchestrator acceptance hardening round 4 report

## Result

The three scoped hardening objectives are complete. No acceptance trial, deploy, push, production mutation, or founder-owned product-file change was performed.

## Safe bases

- Expected starting base: `d5d5a367aff06f39eadde10c8ca4c22e4abe3235`.
- Implementation commit / clean smoke base: `621d065d206475aab35e13a77a94f9016ca11068`.

`d5d5a36` was verified to descend from `9a78ce5`, `f73baef`, and the recovered orchestrator commit. All task commits were new commits; no amend, reset, rebase, force-push, or deploy was used.

## Windows isolated runtime

The prior strategy installed dependencies outside the worktree and attached them through a Windows directory junction. The junction/reparse point was not reliably traversable by Node from a Git worktree on this machine. The replacement is deliberately simple: the fresh isolated worktree runs `npm ci --ignore-scripts --no-audit --fund=false` itself, validated against `package.json` and its own `package-lock.json`.

The full lockfile SHA-256 is written only inside ignored `node_modules/.clearsignal-orchestrator-runtime.json`. A changed lockfile invalidates the marker; a missing executable or failed install raises `RuntimePreparationError` and blocks execution. The founder checkout's `node_modules` and `.env.local` are neither copied nor trusted. Lifecycle scripts remain disabled; a package needing one is an infrastructure blocker rather than silently permitted install code.

Fresh-worktree evidence:

- Worktree: `C:\Users\alexa\AppData\Local\CSO\clearsignal\round4-smoke-621d065`
- Detached clean base: `621d065d206475aab35e13a77a94f9016ca11068`
- Lock fingerprint: `f12c5e602a772f876ccaef523161c8a695939f7dd55adfea4a28c9e5f259c4ca`
- Preparation: isolated-worktree `npm ci`, lifecycle scripts disabled; marker state `RUNTIME_READY`.
- `node node_modules/typescript/bin/tsc --noEmit`: exit 0.
- `node node_modules/vitest/vitest.mjs run tests/health-schema-check.test.ts`: exit 0 (1 file, 1 test).
- `node node_modules/next/dist/bin/next build`: exit 0; build completed and emitted `.next/BUILD_ID`.

## Strict schemas

The provider-facing TECH_LEAD, IMPLEMENTER, and REVIEWER schemas have recursively strict object validation: every object sets `additionalProperties: false`, and every object has an exact `required`/`properties` key match. The generic recursive schema test covers all schema files and nested `human_action` objects (including its `steps` items).

One real minimal read-only TECH_LEAD smoke was performed after local validation:

- Model: `gpt-5.6-terra`.
- Provider/CLI status: completed, process exit 0.
- Latency: 9,578 ms.
- Structured output: parsed successfully with decision `IMPLEMENT`.
- Persisted artifact directory: `C:\Users\alexa\AppData\Local\CSO\clearsignal\round4-techlead-smoke`.
- Worktree porcelain output was empty after the call; no repository change occurred.

## Concurrent HEAD guard

`commitAll` now requires an expected HEAD, stages the reviewed task paths, reads HEAD immediately before `git commit`, and refuses on mismatch. It cannot amend: the autonomous path only invokes a new `git commit`.

On mismatch it persists a first-class `concurrent_repository_changes` record with expected SHA, observed SHA, prevented operation, worktree path, and task/run context. It also emits `CONCURRENT_REPOSITORY_CHANGE`, places the task in `CONCURRENT_REPOSITORY_CHANGE`, places the plan in `HUMAN_ACTION_REQUIRED`, and uses this exact operator message:

> Repository changed while this task was running. No commit was created. Review the new repository state before continuing.

The deterministic adversarial test creates A, advances the repository to B, then attempts a task commit. It proves the commit is refused, B remains HEAD, and the exact SHAs are carried by the error. The matching-HEAD companion test proves a normal new commit succeeds. Store coverage proves persisted SHAs, state, and event emission.

## Verification

- `npm run test:orchestrator`: pass, 34 tests.
- `npx tsc --noEmit`: pass.
- `npm test`: pass.
- `npm run build`: pass.

## Remaining limitations

- Dependency preparation intentionally trades install time for correctness; no runtime cache is used.
- `--ignore-scripts` means packages that require lifecycle scripts cannot run until an explicit reviewed solution is designed.
- The expected-HEAD comparison is an immediate pre-commit check. An external writer after that comparison remains a Git-level concurrent-writer hazard and correctly remains outside autonomous merge/rewrite behavior.

READY TO RE-RUN ORCHESTRATOR ACCEPTANCE TRIAL
