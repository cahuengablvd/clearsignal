# Orchestrator acceptance hardening round 4

## Expected base

`d5d5a367aff06f39eadde10c8ca4c22e4abe3235` was verified as the committed base containing the recovered orchestrator work.

## Scope

1. Replace unreliable Windows worktree junction runtime reuse with deterministic isolated-worktree dependency preparation.
2. Verify every provider-facing structured schema is recursively strict.
3. Guard autonomous repository commits against a changed expected HEAD, persist the exact conflict evidence, and never amend.

No acceptance trial, deploy, production mutation, or founder-owned product-file modification is permitted.

## Acceptance criteria

- An isolated worktree runs TypeScript, Vitest, and Next build after deterministic dependency preparation.
- Package-lock fingerprints invalidate stale prepared dependencies; provisioning failures block work.
- Nested structured-output objects reject additional properties and required keys match properties.
- A HEAD mismatch prevents a commit and creates durable `CONCURRENT_REPOSITORY_CHANGE` evidence containing both SHAs and worktree context.
- A matching HEAD creates a new commit; autonomous amend is unsupported.
