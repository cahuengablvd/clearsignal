# Orchestrator acceptance hardening round 3

## Scope

Repair only the two Acceptance Trial #2 execution blockers: isolated worktree dependencies and
strict Codex structured-output schemas. Do not redesign the orchestrator, deploy, mutate production,
or include founder-owned changes.

## Acceptance criteria

- A worktree dependency runtime is fingerprinted by `package-lock.json`, verified against
  `package.json`, persisted outside Git worktrees, and has explicit ready/preparing/failed behavior.
- A worktree never reuses founder `node_modules` or copies `.env.local`; a missing/failed runtime
  blocks before any agent invocation.
- TypeScript, Vitest, and Next use fixed Node entry points from a fresh isolated worktree.
- Every Codex structured-output schema recursively declares strict object properties and compatible
  required keys, including `human_action`.
- One minimal live, read-only TECH_LEAD invocation reaches the adapter and yields valid structured output.
- Unit, TypeScript, full test, build, isolated-runtime, and live-schema smoke evidence is recorded.
- No full Acceptance Trial #3 is run in this task.
