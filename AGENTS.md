# Agent context — ClearSignal

**Read `CLAUDE.md` in this folder — it is the single source of project context** (what ClearSignal
is, the stack, the deploy split, the paid funnel, the frozen scope, the trust-layer rules, and the
remaining launch blockers). This file exists so Codex auto-loads the same context; `CLAUDE.md` is
the canonical copy, kept here to avoid drift.

Quick reminders that matter most when implementing:

- **Scope is frozen.** No monitoring, subscriptions, auth, dashboards, white-label, new engines, new
  report sections, redesigns, or audit-engine changes without a clear reason.
- **Trust layer is sacred.** Never invent numbers or promise guaranteed rankings/traffic/revenue.
  Do not weaken `lib/sanitize.ts` or `lib/report-validator.ts`.
- **Deploy split:** Vercel auto-deploys `main`; Trigger.dev must be deployed separately from
  `C:\csdeploy` (see `DEPLOY.md`). Non-ASCII in source uses `\u` escapes (Windows CP1251).
- Task specs live in `TASKS_*.md` at the repo root. After changes: `npx tsc --noEmit`,
  `npm run build`, and the vitest suite must pass.
