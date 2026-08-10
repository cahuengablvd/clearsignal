# Intake draft — never let the engine guess the vertical

Fixes `R12` in `DEFECTS_BACKLOG.md`. A customer who skips the optional "describe your ideal
customer" field currently gets buyer questions invented from the domain name. Observed on
`salidzini.lv` (a consumer price-comparison site) on 2026-08-05: all six generated questions were
about banking and lending. With the ICP filled in by hand, the same site produced six correct
Latvian questions about price comparison. The input was the whole problem.

**Owner decision (2026-08-05):** pre-fill a draft description and show whether the site was
actually read. If it was not read, the customer writes the description themselves.

## The rule

Never generate buyer questions from a business we have not read AND cannot have described to us.
One of the two must be true.

## Three states at `/checkout`

| State | When | What the customer sees |
| --- | --- | --- |
| **Read** | Arrived with a `score_id` whose free score completed | Field pre-filled with the draft, clearly marked as our reading, fully editable. A line states we read the site. |
| **Not read** | No `score_id`, or the score never completed | Field empty and **required**. An honest line: we have not read the site yet, so please describe the business. |
| **Read failed** | Manual/admin path where the scrape returned nothing | Confirmation screen states the site could not be read; queries must not be presented as informed. |

A free score that failed to scrape never reaches `done` (`lib/score-runner.ts:51` throws), so a
completed score is itself proof the site was read. Do not add a second scrape to prove it again.

## Where the draft comes from — no new API calls

The free score already sends the scraped markdown to Claude (`lib/score-runner.ts:58`,
`purpose: 'score:clarity'`). Extend `ClearSignalScoreSchema` with one field — a single-sentence
description of who the business serves and what it sells — and ask for it in `SCORE_SYSTEM`. That
costs a few dozen output tokens on a call that already runs. It does **not** justify a second
request, a second model, or a scrape at checkout.

Persist it in the existing `scores` jsonb; expose it from `GET /api/score/[id]` alongside `url` and
`competitor_1`, which checkout already pre-fills (`app/checkout/page.tsx:71`). The plumbing exists —
this extends it by one field.

## Requiredness

`icp_description` is `.optional()` in `lib/schemas.ts:103`. It becomes **conditionally required**:
required when no score-derived draft is available. Enforce this **server-side** in
`CheckoutIntakeSchema`, not only in the form — the API is the boundary, and a client-side-only rule
is not a rule.

Keep the 2000-char cap and the existing "must be text, not a URL" refinement.

## Operator side

The admin confirmation screen (`app/api/admin/audits/preview`) already returns a `scraped` boolean
that nothing renders. Show it. An operator looking at six confident questions currently cannot tell
whether they came from the page or from the domain name — which is exactly how the `salidzini.lv`
run nearly went out.

## Files

`lib/schemas.ts`, `lib/prompts.ts` (`SCORE_SYSTEM`), `lib/score-runner.ts`,
`app/api/score/[id]/route.ts`, `app/checkout/page.tsx`, `app/admin/page.tsx`, plus tests.

## Do not

- Do not add a "scan my site" button. A customer who skips an optional field also skips an optional
  button. Pre-filled beats asking.
- Do not charge for this. It is correctness, not a feature; the scrape is already inside the €149.
  "Pay €5 more and we won't guess wrong" is not a sentence this product can defend to an agency.
- Do not scrape at checkout for direct arrivals. It puts a paid third-party call on a page anyone
  can load, including people who never buy. The "not read" state handles them honestly.
- Do not search third-party sources for a description. That is the deferred `Brand Evidence
  Footprint` (P2 in `TASKS_AI_POSITIONING_AND_EVIDENCE.md`), too slow and costly for intake.
- Do not make the query prompt "try harder". The failure is missing input, not weak wording.

## Tests

- A score whose scrape succeeded yields a draft; `GET /api/score/[id]` returns it.
- Checkout with a `score_id` renders the draft pre-filled and editable.
- Checkout without a `score_id` rejects an empty `icp_description` **at the API**, not just the form.
- The admin confirmation screen renders the scrape state in both directions.
- A fixture reproducing `R12`: empty ICP plus thin scraped content must not yield confident
  wrong-vertical queries.

## Acceptance

A customer arriving from the free score sees a description of their own business already written,
and correcting it takes seconds. A customer arriving cold cannot buy without telling us what the
business does. In neither case does the engine invent a vertical.
