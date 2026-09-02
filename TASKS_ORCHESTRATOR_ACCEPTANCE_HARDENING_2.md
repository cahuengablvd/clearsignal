# Orchestrator acceptance hardening round 2

## Scope

Repair only the acceptance blockers in the local `orchestrator/`: durable checkpoint recovery, step idempotency, HumanAction verification, truthful pause/cancel states, lifecycle events, and an isolated committed execution base. No deployment, production mutation, or product-code change.

## Completion criteria

- Persisted completed implementation resumes at tests; completed tests resume at assessment.
- An interrupted invocation is retry-required only for that checkpoint and never discards earlier completed checkpoints.
- Completed result payloads are durable and reusable.
- HumanAction persists `OPEN`, `VERIFYING`, `VERIFICATION_FAILED`, and `VERIFIED`; unresolved actions gate resume.
- Pause/cancel request states persist before their safe-boundary terminal state.
- Every task/plan transition has an event record.
- Orchestrator tooling is committed independently of founder-owned changes, making its commit SHA selectable as a clean worktree base.
- Deterministic mocked tests cover the specified restart, HumanAction, pause/cancel, event, and dependent-plan cases.
