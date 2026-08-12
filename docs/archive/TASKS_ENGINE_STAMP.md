# TASKS_ENGINE_STAMP — read the engine version from the run context, not an env var

Follow-up to `docs/archive/TASKS_DEPLOY_DRIFT.md`. Touches `lib/audit-runner.ts` and `trigger/`, so
it **needs a Trigger deploy from `C:\csdeploy`.**

## The problem

Generation stores `engine_version` from `process.env.TRIGGER_VERSION` (`lib/audit-runner.ts:748`).
That variable is unset in production, so every report renders:

```
Renderer build: 02c5378 | Generating engine: not recorded
```

The drift indicator in `/admin` has nothing to compare, so the whole `TASKS_DEPLOY_DRIFT` feature is
inert.

**Do not fix this by setting `TRIGGER_VERSION` in the Trigger dashboard.** In this SDK that variable
is not "which version am I" — it is `lockToVersion`:

```js
lockToVersion: item.options?.version ?? scopedEnvVar("TRIGGER_VERSION")
```
`node_modules/@trigger.dev/sdk/dist/commonjs/v3/shared.js:348`

Setting it would pin every task run to one fixed version, and later deploys would silently never
take effect — the exact failure this feature exists to expose.

## The right source

The platform supplies the deployment identity in the run context. Per
`node_modules/@trigger.dev/core/dist/commonjs/v3/schemas/schemas.d.ts:203`, `ctx.deployment` is:

```ts
{ id: string; version: string; shortCode: string; runtime: string; runtimeVersion: string;
  git?: { commitAuthorName?: string; commitMessage?: string; ... } }
```

It is optional — a local `dev` run has no deployment — so absence must be handled, not assumed.

## Fix

1. In the Trigger task (`trigger/`), read `ctx.deployment` and pass the version (and the short code,
   if useful) into `runFullAudit` as an explicit option. **Do not** reach for the context inside
   `lib/` — `lib` must stay runnable outside Trigger, which is what the tests depend on.
2. `runFullAudit` writes the value it was given into `report.meta.engine_version`, exactly as today.
   With no value supplied — local runs, tests — keep the current `not recorded` behaviour rather
   than inventing a placeholder.
3. Remove the `process.env.TRIGGER_VERSION` read and the `TRIGGER_GIT_COMMIT_SHA` /
   `GIT_COMMIT_SHA` fallbacks. They never fire in production, and the first one is a foot-gun that
   invites someone to "fix" it by setting the locking variable.
4. Update `DEPLOY.md`: remove `TRIGGER_VERSION` from the list of environment variables to verify,
   and state plainly that setting it pins task runs to a version and must not be done.
5. If `ctx.deployment.git.commitMessage` or the author is available, storing it alongside the
   version is cheap and makes "which change produced this report" answerable without the dashboard.
   Optional; skip if it complicates the option shape.

## Acceptance

- A test passing a deployment version into `runFullAudit` asserts it lands in
  `report.meta.engine_version`; a test with none asserts the field stays unset. Failing test first.
- `grep -rn "TRIGGER_VERSION" lib app trigger` returns nothing outside comments explaining why it is
  not used.
- The existing `tests/deploy-drift.test.ts` regressions stay green.
- `npx tsc --noEmit`, `npm run build`, full vitest suite pass.

## Verification after deploy

Regenerate audit `28ca503b`. The footer must read `Generating engine: 20260812.x` — the version the
deploy printed — instead of `not recorded`, and `/admin` must show the same value on that row with
no drift highlight.
