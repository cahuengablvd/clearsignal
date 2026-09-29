# STATUS — external state

Only what git cannot know. Keep this file under ~120 lines; durable product context is in
`CLAUDE.md`, work rules in `AGENTS.md`, and open defects in `DEFECTS_BACKLOG.md`.

**Last updated:** 2026-09-29 — Engine work is committed and deployed. Vercel `/api/health` reports
`f88b070`; Trigger `20260929.1` is current, sourced from the same clean main commit, with
Node.js `22.16.0`, `git.dirty: false`, and 5 tasks. Previous Trigger `20260924.1` from
`635688a` was newer than the old `STATUS.md` entry `20260904.5`.

## Deploys

- **Vercel** — auto-deploys `main`; production `/api/health` reports `f88b070`.
- **Trigger.dev** — current `20260929.1`, source `f88b07004c852fe8904fe414a96dd93b2d38e47e`,
  runtime Node.js `22.16.0`, `git.dirty: false`, 5 tasks. The prior version was `20260924.1`
  from `635688a`.
- **Supabase** — migration `014_daily_ai_spend_guard.sql` applied 2026-08-21 with RLS enabled.
- Code in `lib/audit-*`, `lib/report-*`, `lib/quality/*`, `lib/geo/*`, `trigger/*` or prompts
  requires a separate Trigger deploy. Keep `AUTO_DELIVER_AUDITS=false`.

## Owner blockers

1. Live Stripe control purchase and refund with a real card; waiting on funds.
2. Legal review of `/terms`, `/privacy`, `/refund` and VAT treatment.

## Agency Pilot 01 — no outreach sent

- Pilot spec and copy are ready. The owner approved the agency-first scope; nothing is sent until
  the owner writes `GO LIVE`.
- Phase 1 Apollo check (2026-09-28): mailbox active/default; 2,550 lead credits; Eastern schedule
  Mon–Fri 10:00–17:00 `America/New_York`, contact timezone and holidays respected. Empty lists:
  Cohort A `6aba26fcb50f0e00145dad1b`, Cohort B `6aba26fde2b71e0014c6230f`.
- Apollo still needs reauthentication with enrichment, contact, custom-field and sequence scopes.
  No ClearSignal contacts or sequences exist; nothing was sent or enrolled, and no LinkedIn action
  occurred. The owner's signature address is `Gaujas iela 5c, Marupe, LV-2167, Latvia`.
- Engine work in `lib/` is committed to `main` and live on Trigger `20260929.1`; it no longer
  blocks Agency Pilot Phase 2–3. Phase 1 still waits for Apollo OAuth reauthentication.
- Owner decisions: 20 new emails/day plus one follow-up, 40/day maximum, first wave 200 prospects;
  working list is `seo_baltics` (`gid=95772132`). Pack price and live Stripe Payment Link remain
  pending for Phase 3; a separate outreach domain is a parallel item.
- Phase 2 pages wait for 3 agency pilot acceptances; Phase 3 automation waits for 3–5 written
  feedbacks. Until then, run pilots manually through `/admin` and collect written feedback.

## Sales test — closed, 0 replies

About 50 Baltic agencies were contacted from the owner's personal Gmail, with LinkedIn requests;
there were no replies. Agency Pilot 01 is the current validation path.

## Other external work

- Site review wording is live: marketing says “reviewed by a person,” the founder section is gone,
  and `/privacy` and `/terms` retain the legally required operator name.
- The dormant `lib/resend.ts` delivery-footer drift is cleared by Trigger `20260929.1`;
  `AUTO_DELIVER_AUDITS` remains false.
- Alahli audit `1e9122fe-4eed-4160-9624-c0cdba82a5ca` remains `awaiting_review`, never delivered.
  Its 30-page PDF passed review; the owner should read the four reviewer notes before delivery.

## Open defects and deferred follow-up

`R13`, `R16`, `R18`, `R19`, `R20`, `R21`, `R22`, `R30` and `R38` remain open, pending customer
priority. Closed items: `docs/archive/DEFECTS_CLOSED.md`.

- Recompute can retain stale per-row `entity_observations` when new resolution finds nothing;
  Trigger Regenerate also lacks the Arabic disclosure.
- Assess free-score (`/score/[id]`) gate/display separately; the paid-report `report_only`
  presentation rollback did not address it.

## Report design lab

- Round 1 is complete but defective and unmerged on `report-design-lab`.
- Round 2 spec `TASKS_REPORT_DESIGN_LAB_R2.md` is ready and not started. New session, one task.

## Cost

A complete audit's measured API spend is `$1.06`. Agent spend is the larger cost; keep implementation
sessions focused and use `npm run codex-usage` when a spend check is needed.
