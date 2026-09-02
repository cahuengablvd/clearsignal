# Orchestrator Git Recovery Analysis

Date: 2026-09-02

## Scope and method

This is Git-record forensics only. No deploy, acceptance run, reset, rebase,
stash, clean, force-push, or production mutation was performed. Existing
working-tree changes are treated as protected external/founder work.

## Recorded state before recovery

`main` pointed to `2db7422028fdbd6264b38e4ec75dbea57992ae71` and tracked
`origin/main` at `f73baef81403860ce683b28180b21ac17769fed2`:

```
56f068f  Close Fable pre-delivery blockers
  \
   1dcae17  Harden orchestrator runtime and schemas
     |\\
     | f73baef  Fix reused GEO citation and competitor narratives  (origin/main)
     |
     2db7422  Fix reused GEO citation and competitor narratives  (local main)
```

Both `f73baef` and `2db7422` have parent
`1dcae17a7eec7df9b7fce31528134e76f18143f6`. `1dcae17` is therefore an
ancestor of `2db7422` (verified with `git merge-base --is-ancestor`, exit 0).

`main` was `[ahead 1, behind 1]` of `origin/main`. The remote-tracking reflog
records `f73baef` as an update by push at 2026-09-02 17:28:56 +03:00.
`git branch -r --contains 2db7422` returned no branch; `git branch -r --contains
1dcae17` included `origin/main`.

## Commit evidence

`1dcae17` (17:19:39 author time; 17:28:14 commit time) is the 13-file,
228-insertion/34-deletion orchestrator runtime/schema hardening commit.

`f73baef` and `2db7422` share author, author timestamp, parent, and subject.
The local `main` reflog records the latter as `commit (amend)` at 17:31:56,
replacing `f73baef`. The commit trees differ only in the two files below.

This establishes that a founder-authored commit was rewritten **locally** from
`f73baef` to `2db7422`; no shared founder history was rewritten: the pushed
remote still names the original `f73baef` object.

## Accidental orchestrator additions in `2db7422`

The two additions were identified by tree and content comparison, not by their
names alone:

| File | `f73baef` blob | `2db7422` blob | Content evidence |
| --- | --- | --- | --- |
| `orchestrator/src/dependency-runtime.mjs` | `cc1418c` | `3d2b5a4` | Replaces Node's `symlinkSync(..., 'junction')` with an awaited PowerShell native directory-junction creation; uses `lstatSync` to preserve an existing target and throws `RuntimePreparationError` when creation fails. |
| `orchestrator/src/git.mjs` | `9ed5dbc` | `7d5a9e2` | Awaits the now-async `attachRuntimeToWorktree` in `prepareWorktree`. |

These lines were **not** present in `1dcae17`: its blobs are exactly the same
as `f73baef` (`cc1418c` and `9ed5dbc`). They are additional isolated-worktree
smoke-derived runtime changes, not duplicated content from the original
hardening commit. They should be preserved, but under a separate
orchestrator-owned commit.

## Founder product content evidence

The original pushed founder commit `f73baef` contains exactly these changes
from `1dcae17`:

- `lib/audit-runner.ts`: on stored-evidence reuse, filters explicit competitor
  inputs to literal name forms before candidate seeding, while still requiring a
  literal answer mention.
- `lib/report-validator.ts`: rebuilds GEO citation statements over
  citation-evaluable non-supplemental evidence and retains their deterministic
  denominators through narrative cleaning.
- `tests/rd-pre-delivery-hardening.test.ts`: covers both the retained citation
  denominator through sanitize/final validation and non-invented explicit
  competitor mentions on reused evidence.

`git diff --exit-code f73baef 2db7422 -- lib/audit-runner.ts
lib/report-validator.ts tests/rd-pre-delivery-hardening.test.ts` exited 0.
The broader comparison excluding the two orchestrator paths also exited 0.
Thus every non-orchestrator tracked byte in `2db7422` equals `f73baef`; founder
product content was not overwritten.

## Working tree

The worktree is not clean. Before recovery it had modified tracked files
`.gitignore`, `CLAUDE.md`, `DEPLOY.md`, `STATUS.md`, `app/page.tsx`,
`lib/sanitize.ts`, and `vitest.config.ts`, plus multiple untracked files and
directories (including `.claude/`, `app/prototype/`, `evals/`, `public/`, and
task/review artifacts). None are part of either recovery target and none will
be staged, reset, restored, stashed, cleaned, or otherwise modified.

## Safest recovery decision

Because `f73baef` is already pushed, it must remain untouched. `2db7422` is a
strictly local amended replacement and is unshared. The minimum safe recovery
is:

1. Move local `main` from `2db7422` back to the already-pushed founder commit
   `f73baef` with a compare-and-swap ref update, without changing the index or
   working tree.
2. Stage and commit only the two verified orchestrator smoke-fix paths, creating
   a new orchestrator-only commit on `f73baef`.
3. Leave every other tracked/untracked working-tree item untouched.
4. Create a separate recovery-record commit for this analysis and the final
   report, never mixing them into the founder or orchestrator commits.

This restores ownership separation while preserving every verified byte of the
founder product change and all valid orchestrator work. It does not rewrite a
remote ref, require a force-push, or affect deployment.

## Required blocker for the next hardening round

This incident exposes a concurrency defect in the orchestrator. Before every
commit, amend, or equivalent history-changing operation, it must read and
compare an expected head:

```
expected_head == current_head
```

If the values differ, it must stop without staging, committing, amending,
resetting, or absorbing new changes, and report
`HUMAN_ACTION_REQUIRED` or `CONCURRENT_REPOSITORY_CHANGE` with both SHAs.

For this incident, the expected HEAD was
`1dcae17a7eec7df9b7fce31528134e76f18143f6`; the observed unexpected founder
HEAD was `f73baef81403860ce683b28180b21ac17769fed2`. The unsafe amend then
created local `2db7422028fdbd6264b38e4ec75dbea57992ae71`. Implementing this
guard is explicitly deferred and is a blocker for the next hardening round.
