# ClearSignal — project context

This file is loaded automatically at the start of every session opened in this folder. It exists so
a new chat does not have to be re-briefed. Keep it short and current; update it when a fact below
changes.

## What ClearSignal is

An **expert-reviewed AI Visibility Audit**, sold as a one-time product (not a subscription, not a
monitoring dashboard). It tests how ChatGPT, Claude and Perplexity answer buyer-intent questions
about a business, shows who appears instead of them, and turns the evidence into a prioritized,
stage-aware implementation plan. A person reviews every report before delivery.

- **Positioning:** "Deeper than a scanner. Cheaper than an agency." The empty slot between $29–99/mo
  monitoring tools (Otterly, Peec, Semrush, Ahrefs) and $3–10k/mo agencies.
- **Price:** €149 founding offer (first 20), regular €399. Free score is the top-of-funnel entry.
- **Buyer (in priority order):** marketing/SEO agencies first (they resell the work), then B2B/SaaS,
  then service businesses (only via agencies).
- **Status:** pre-revenue, solo founder (Alexander Kalinko, Latvia). Engine works end to end; not
  yet taking real money.

## Stack & topology

- Next.js 14 (App Router) + Tailwind + shadcn, Supabase (DB, region Stockholm), Stripe (checkout),
  Resend (email), Trigger.dev (background audit generation), Vercel (hosting). Tests: vitest.
- **Deploy split — read `DEPLOY.md`:** Vercel auto-deploys `main` (frontend + API). Trigger.dev runs
  the generation code and must be deployed **separately** from `C:\csdeploy` (a no-space clone — the
  space in `C:\Claude Code` breaks the Trigger CLI). Drift between the two causes silent failures.
- Windows machine, CP1251 console: **use `\u` escapes for non-ASCII in source**, and pass
  `-Encoding UTF8` in PowerShell text ops. Never run `npm run build` while a dev server is running
  (both write `.next` and the prod build corrupts the dev artifacts).

## Paid funnel (working as of commit f5d4e8d)

`Landing → free score (/score) → result (/score/[id]) → /checkout (collects url, email, competitors,
ICP, business context) → POST /api/stripe/checkout (creates a PENDING audit row, then a Stripe
session carrying only audit_id) → Stripe → /api/stripe/webhook (marks paid, enqueues) → Trigger
generates → admin human-review gate (/admin) → Resend delivers web report + PDF.`

- Business data lives in **our DB**, not Stripe metadata (metadata caps values at 500 chars).
- Webhook is hardened: duplicate sessions, races, enqueue-failure-returns-500-so-Stripe-retries.
- `/success` verifies the session with Stripe before showing confirmation.
- One shared `DELIVERY_PROMISE` string (2 business days) is used in landing FAQ, Terms, /success, email.

## Non-negotiable product principles

- **Trust layer:** never invent numbers, never promise guaranteed rankings/citations/traffic/revenue.
  Findings are point-in-time and scoped to the tested query set. Report language is observational
  ("was observed"), not asserting. `lib/sanitize.ts` + `lib/report-validator.ts` enforce this; do not
  weaken them. See `TASKS_TRUST_LAYER.md`.
- **Human review before delivery** (`AUTO_DELIVER_AUDITS` stays false in prod).
- **Scope is frozen.** Do NOT add: monitoring, subscriptions, auth, investor/agency dashboards,
  white-label, new AI engines, new report sections, redesigns, or audit-engine changes without a
  clear reason. The thing that unfreezes scope is paying customers, not an interesting idea.

## Remaining launch blockers (owner tasks, not code)

1. **Domain** — keep the name "ClearSignal"; buy any free variant (.io/.co/.app/get-/use-). Needed
   for #2.
2. **Resend sender domain** — until a verified domain replaces `onboarding@resend.dev`, report emails
   reach only the account owner, so **no paying customer receives their report**. This is the #1
   blocker.
3. **Live Stripe** — verification, live €149 product, live webhook, keys scoped **Production only**
   (test keys stay on Preview/Dev). Then one real-card purchase + refund as an end-to-end check.
4. Legal review of `/terms`, `/privacy`, `/refund` and VAT treatment (accountant).
5. `next` has DoS-class advisories; the fix is a major upgrade (14→15/16), so it's a deferred batch,
   not a launch blocker.

## How work happens here

- The user directs; **Claude (this assistant) reviews and writes specs, Codex implements.** Specs go
  in `TASKS_*.md` at the repo root. Claude verifies Codex's work against the code and tests, not the
  report.
- When reviewing or planning, be direct about risks (payment, data-loss, false claims) and separate
  must-do-before-first-sale from nice-to-have.

## Key docs

- `DECISION_MEMO.md` — strategy, real competitor pricing, 60-day plan, kill criteria.
- `DEPLOY.md` — the Vercel + Trigger deploy procedure (the C:\csdeploy rule).
- `TASKS_LAUNCH_PASS.md` — the paid-funnel launch review.
- `TASKS_TRUST_LAYER.md` — the sanitizer/validator architecture.
- `Downloads/ClearSignal-Investor-Deck.pptx` — investor deck (feedback, not fundraise).
