# TASKS_SCHEMA_DRIFT — a query against a column that was never migrated still breaks silently

Closes the remainder of `R23`. Admin UI, API and deploy docs. No engine changes, **no Trigger
deploy** — but read the migration rule below, it is the point of the task.

## What is already fixed, and what is not

The visible half of `R23` shipped: `refreshAudits` (`app/admin/page.tsx:325`) now sets `loadError`
and the page renders a red error box with a Retry button instead of "No audits yet". Do not redo it.

Three gaps remain.

### 1. The session check still swallows a server error

`app/admin/page.tsx:568` runs on mount:

```ts
fetch('/api/admin/audits')
  .then((res) => { if (!res.ok) return null; setAuthed(true); return res.json() })
```

A 500 is indistinguishable from a 401 here, so a broken query renders the **login form**. That is
the same defect as `R23` wearing different clothes: the operator is told "you are signed out" when
the truth is "the database rejected the query". Distinguish 401/403 (show login) from every other
failure (show the error, keep the session).

### 2. No test covers the error path

Nothing in `tests/` asserts that a failing `/api/admin/audits` renders an error rather than an empty
state. The fix is one render test away from silently regressing — and it already regressed once.

### 3. Migrations are applied by hand, and nothing notices when they are not

`R23`'s root cause was `012_audit_reviewer_note.sql` sitting in the repo unapplied while the code
selected `reviewer_note`. `R14` is the same story: `audit_insights` is declared in
`001_initial.sql`, was never applied, and `lib/audit-runner.ts:861` has been upserting into a
non-existent table for the life of the project — unchecked, so silent.

Add the cheapest thing that would have caught both:

- A startup or health-route check that verifies the columns the admin query actually selects exist,
  and reports the missing ones by name. `app/api/health/route.ts` already exists and already reports
  the commit — extend it there rather than inventing a new surface.
- A line in `DEPLOY.md`: any change that adds a column to a query applies its migration in the same
  step, before the code ships.
- Delete the dead `audit_insights` upsert (`lib/audit-runner.ts:859-861`) and its block in
  `001_initial.sql`. Nothing reads that table anywhere in `app/`, `lib/`, `trigger/` or `scripts/`.
  Do **not** create the table to make the write valid — a table nobody reads is not worth a
  migration. Closing this closes `R14`.

## Acceptance

- With `/api/admin/audits` returning 500, the admin page shows the error state and **not** the login
  form; with 401 it shows the login form. Both covered by tests that fail against current code.
- With the same route returning 500 after a successful load, the previously loaded list stays on
  screen — an error never erases data the operator was already looking at.
- The health route reports missing expected columns by name when a migration is unapplied.
- `grep -rn audit_insights` returns nothing outside `docs/archive/` and the defect files.
- `npx tsc --noEmit`, `npm run build`, full vitest suite pass.

## Out of scope

Do not add an ORM, a migration runner, or automatic migration-on-boot. Migrations stay reviewed and
applied by hand against production; this task only makes an unapplied one loud instead of silent.
