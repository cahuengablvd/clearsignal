# MVP launch pass — architecture review and final plan

Reviewed against `main` @ `675ca61`. Read: `app/api/stripe/checkout/route.ts`,
`app/api/stripe/webhook/route.ts`, `app/success/page.tsx`, `app/checkout/page.tsx`,
`app/api/score/[id]/route.ts`, `lib/schemas.ts`, `lib/business-context.ts`, `lib/notify.ts`,
`supabase/migrations/*`, `tests/`.

## 1. Verdict

The scope freeze is right and the funnel choice is right. **One decision must change: business
data cannot live in Stripe metadata.** That is not a preference, it is a hard API limit that is
already breaking checkout today. Everything else in Codex's plan is sound; Batch 2 should be
dropped until after the first sales.

Codex's findings verified: #1, #2, #3, #4, #5, #6, #9, #10 are all correct. #7 is correct but the
conclusion (build it now) is wrong. #8 is correct and is an argument for deferring, not for
rewriting the privacy page.

What Codex got right and deserves credit for: the webhook is genuinely well built. Duplicate
sessions, the `23505` race, the already-processing guard, and enqueue failure returning 500 so
Stripe retries are all handled correctly. Do not "improve" it beyond what is listed below.

---

## 2. The blocking defect: Stripe metadata cannot hold this data

**Stripe metadata limits: 50 keys, 40 chars per key, 500 chars per value.**

Against our own schema (`lib/schemas.ts`):

| Field | Our schema allows | Stripe allows | Result |
|---|---|---|---|
| `verified_facts` | `.max(2000)` | 500 | session creation **rejected** |
| `target_markets_languages` | `.max(1000)` | 500 | session creation **rejected** |
| `icp_description` | **no cap at all** in `app/api/stripe/checkout/route.ts` | 500 | session creation **rejected** |

This is live today, not hypothetical: a customer who writes more than 500 characters describing
their ICP gets a failed checkout and cannot pay. Adding the proposed business-context fields to
metadata multiplies the failure surface.

**Answer to review question 2: no, metadata is not sufficient. Persist a pending order before
Stripe and put only its UUID in metadata.**

This also fixes a second problem Codex listed separately (customer data loss): today the typed
data exists only inside the Stripe session. If the customer abandons at the Stripe page, it is
gone and they must retype everything.

**No migration is required.** `payment_status` and `audit_status` are plain `text` columns with
defaults (`001_initial.sql:25-26`), with no CHECK constraint, and `stripe_session` is nullable
with a unique index (`011_unique_stripe_session.sql`) — Postgres permits multiple NULLs, so
pending rows coexist.

---

## 3. Answers to the review questions

**Q1. Keep intake before payment?** Yes. Agreed with Codex. A post-payment intake needs a new
`awaiting_intake` state, a signed intake link, reminder emails, and recovery for customers who
paid and vanished. That is a state machine to debug, not a launch step.

**Q2. Pending order or metadata?** Pending order. See section 2. Metadata carries `audit_id` only.

**Q3. Which business-context fields are mandatory?** None of them, and this matters. Every
required field on a €149 checkout from an unknown vendor costs conversions. Required stays
**url + email**. Add the business-context fields as **optional**, well-labelled, with placeholders
— `business_model`, `primary_conversion_goal`, `target_markets_languages`, `verified_facts`. These
four are the ones `businessContextPrompt()` actually feeds to the model
(`lib/business-context.ts:9-17`); the schema already defaults everything else to `'unknown'`.

This is worth doing in Batch 1 for a non-obvious reason: `business_context` is consumed by
`prompts.ts`, `materials.ts`, `report-validator.ts` and `sanitize.ts`. Paid audits currently ship
with **less** context than the manual admin ones, so they are measurably worse reports. It affects
quality, not just tidiness.

**Q4. Verifying `session_id` on `/success`.** Server-side only. Retrieve the session from Stripe
by id and check `payment_status === 'paid'`. Do not trust the URL, and do not look the answer up
in our own DB — the webhook may not have landed yet, and a race would show a false negative to a
customer who genuinely paid. Stripe is the authority here. No `session_id`, or unpaid, or retrieve
fails → render a neutral "we could not confirm this payment, contact us" page, never a green
confirmation.

**Q5. When to send the confirmation email.** Inside the webhook, but **wrapped in try/catch that
swallows the error** and calls `notify()`. Rationale in Q6.

**Q6. Block enqueue until the email is confirmed?** **No, never.** Two reasons. The customer paid
for an audit, not for an email — a Resend outage must not stop the work they bought. And more
subtly: the webhook currently returns 500 on failure so Stripe retries. If an email error escapes
uncaught, it becomes a 500, Stripe retries the whole webhook, and you risk repeating work for a
delivery problem. Email failure must be logged and notified, never fatal.

**Q7. `funnel_events` before the first sale?** Defer. Below roughly 20 customers you can count the
funnel by hand from the admin table. Building it now also drags the privacy page rewrite along
with it (Q10) for data you will not act on.

**Q8. Reliable server-side events.** `free_score_started`, `free_score_completed`,
`payment_completed`, `audit_delivered`. These all pass through our own routes already.

**Q9. Events needing client-side tracking.** `landing_view`, `paid_audit_clicked`,
`checkout_started`. These are precisely the ones that require logging visitor activity, which is
what creates the GDPR obligation.

**Q10. Privacy/Terms conflict.** Real, and it is mine. `/privacy` currently states: "We do not use
analytics, tracking or advertising cookies, and we do not embed third-party tracking scripts."
That was verified true against the codebase when written. First-party visitor event logging would
make it false, so Batch 2 cannot ship without rewriting that section. One more reason to defer.

**Q11. Tests.** Section 7.

**Q12. Other blockers.** Section 4.

---

## 4. Risks that can cost a real customer

Ordered by severity.

| # | Risk | Cause | Consequence |
|---|---|---|---|
| R1 | **Customer cannot pay** | ICP text >500 chars, no cap before Stripe | Failed checkout, lost sale, no error the customer understands |
| R2 | **Paid, never delivered** | `RESEND_FROM` is still `onboarding@resend.dev`, which only delivers to the account owner. `sendReportEmail` throws, `approve` returns 500 | Customer paid, report never arrives, audit never reaches `delivered` |
| R3 | **False confirmation** | `/success` is fully static — anyone opening the URL sees "Payment received!" | A failed payment can look successful |
| R4 | **Promise the product cannot keep** | `/success` says "a few minutes", Terms say "within 2 business days", the FAQ says something else again | Customer waits minutes, gets nothing, opens a chargeback. This is the single most likely first-customer disaster |
| R5 | **Typed data lost** | Data exists only in Stripe metadata until payment completes | Customer abandons at Stripe, returns, retypes everything, or leaves |
| R6 | **Sale goes unnoticed** | `notify.ts` has only failure events, no `paid_audit_received` | With a 2-business-day promise, hours can be lost before you know an order exists |
| R7 | Degraded report quality on paid audits | `business_context` never populated from checkout | Paid audits are weaker than manual ones |

R1–R4 are must-fix. R2 is blocked on the domain (owner's task, not Codex's).

---

## 5. Plan

### Batch 1 — must-have before the first real sale

**M1. Pending order before Stripe (fixes R1 and R5).**
- `app/api/stripe/checkout/route.ts`: validate the full intake with a shared zod schema; insert an
  `audits` row with `payment_status: 'pending'`, `audit_status: 'awaiting_payment'`, all intake
  fields and `business_context`; then create the Stripe session with **`metadata: { audit_id }`**
  only (plus `tier`); then write `stripe_session` back to the row.
- `app/api/stripe/webhook/route.ts`: resolve the audit by `meta.audit_id` first, **falling back to
  the existing `stripe_session` lookup** so in-flight sessions created before the deploy still
  work. On success flip to `payment_status: 'paid'`, `audit_status: 'queued'` and enqueue exactly
  as today. Keep every existing duplicate and already-processing guard untouched.
- Cap `icp_description`, `target_markets_languages` and `verified_facts` in the shared schema so
  the form rejects over-long input with a clear message instead of Stripe rejecting the session.

**M2. Honest `/success` (fixes R3 and R4).**
- Server component. Read `session_id`, `stripe.checkout.sessions.retrieve`, require
  `payment_status === 'paid'`.
- Confirmed → what actually happens next: the audit is generated, **reviewed by a person**, and
  emailed. State the same delivery window as Terms.
- Not confirmed / missing / error → neutral page with a contact route. No green tick.
- Delete "This usually takes a few minutes."

**M3. Confirmation email after payment (fixes R4).**
- `lib/resend.ts`: `sendOrderConfirmationEmail(email, url)` — what was ordered, what happens next,
  human review, the delivery window, and a reply-to for questions.
- Called from the webhook **inside try/catch**; on failure `notify('confirmation_email_failed')`
  and continue. Never block enqueue, never turn into a 500.

**M4. `paid_audit_received` notification (fixes R6).** Add the event to `lib/notify.ts`, fire it in
the webhook after the audit row is confirmed paid.

**M5. One delivery promise everywhere (fixes R4).** Pick one sentence and use it verbatim in: the
landing FAQ, `/terms` section 7, `/success`, and the confirmation email.
**Recommended wording, given there is no measured SLA yet:** *"Most audits are delivered within 2
business days. Every report is reviewed by a person before it reaches you, so we will email you if
it needs longer."* This matches what `/terms` already promises, so Terms need no edit.

**M6. Checkout and success visual alignment.** Bring both onto the landing's design language. This
is the page where money changes hands and it currently looks like a different product. Cosmetic, so
if time runs short it yields to M1–M5, but it is cheap and directly affects trust at the payment
step.

**Files touched in Batch 1:** `app/api/stripe/checkout/route.ts`, `app/api/stripe/webhook/route.ts`,
`app/success/page.tsx`, `app/checkout/page.tsx`, `lib/schemas.ts`, `lib/resend.ts`, `lib/notify.ts`,
`app/page.tsx` (FAQ wording only).

**Migrations: none.**

### Deferred

- All of Batch 2: `funnel_events` migration, `lib/funnel-events.ts`, client-side events, admin
  counts, and the privacy/terms rewrite they force. Revisit after ~20 paid audits.
- Post-payment intake flow.
- Everything already in the scope freeze.

### Owner tasks (cannot be done by Codex)

1. Buy a domain and verify it in Resend, set `RESEND_FROM`. **R2 is unresolved until this is done —
   without it no paying customer receives a report.**
2. Live Stripe: verification, live product at €149, live webhook endpoint, keys scoped
   **Production only** (test keys must remain on Preview/Development).
3. One end-to-end live purchase with a real card, then refund it.
4. Have the legal pages reviewed and confirm VAT treatment.

---

## 6. Implementation order

1. M1 (pending order) — everything else assumes it.
2. M2 (`/success`).
3. M3 + M4 (emails and notification).
4. M5 (one delivery promise).
5. M6 (visual alignment).
6. Owner: Resend domain, live Stripe, live purchase test.

---

## 7. Tests

New, in `tests/`:

- **checkout-intake.test.ts** — long `icp_description` (>500 chars) is accepted and persisted, and
  the Stripe session is created with only `audit_id` in metadata; over-max input is rejected with a
  400 and a readable message; invalid `score_token` returns 403.
- **stripe-webhook.test.ts** — resolves by `audit_id`; falls back to `stripe_session` when
  `audit_id` is absent (backward compatibility); a duplicate `checkout.session.completed` produces
  exactly **one** audit and does not re-enqueue a `processing`/`done` audit; enqueue failure
  returns 500 and leaves the row `queued` for the recovery sweep; **a throwing confirmation email
  still returns 200 and still enqueues.**
- **success-verification.test.ts** — missing `session_id`, unknown session, and `payment_status`
  other than `paid` all render the neutral page; a paid session renders confirmation.

Regression (must keep passing): `audit-recovery.test.ts`, `email-delivery.test.ts`,
`golden-report.test.ts`, `trust-layer.test.ts`, `cost-abuse-guards.test.ts`.

---

## 8. Acceptance criteria

- A checkout with a 1500-character ICP description completes and reaches Stripe.
- The Stripe session metadata contains `audit_id` and `tier`, and no free-text business fields.
- Abandoning the Stripe page and returning to `/checkout` does not require retyping (the pending
  row exists and the customer can resume or start a new session).
- `/success` without a valid paid `session_id` never shows a payment confirmation.
- `/success` does not contain the words "a few minutes".
- The delivery promise sentence is byte-identical in the landing FAQ, `/terms`, `/success` and the
  confirmation email.
- A paid order produces: a customer confirmation email, a `paid_audit_received` notification, and a
  `queued` audit.
- Forcing the confirmation email to fail still yields a 200 webhook and a queued audit.
- Replaying the same `checkout.session.completed` twice yields exactly one audit row.
- `business_context` is populated on audits created through paid checkout.
- `npx tsc --noEmit` and `npm run build` green; full test suite green.

---

## 9. Security, payment and data-loss notes

- **`score_id` / `score_token` are handled correctly.** `app/api/score/[id]/route.ts` returns only
  `id`, `url`, `competitor_1` without a valid token and requires a token or admin session to expose
  `email`; `checkout/route.ts` verifies the token before use. No change needed.
- **Do not weaken the webhook's 500-on-enqueue-failure behaviour.** It is what makes Stripe retry,
  and the recovery sweep depends on the row staying `queued`.
- **Keep the webhook signature check as-is.**
- **Never log full metadata or email bodies** in the new code paths.
- **Live Stripe keys must be scoped to Production only.** With the current `All Environments`
  scoping, promoting live keys would let a preview deploy take real payments.
- Pending `audits` rows accumulate for abandoned checkouts. Harmless at this volume; if it ever
  matters, sweep rows older than 30 days with `payment_status = 'pending'`.
