# TASKS_LANDING_TRUST — the landing page fails the checks the product sells

Landing page only (`app/`). No audit-engine changes, **no Trigger deploy** — Vercel auto-deploys
`main`. Do not start this in the same session as `TASKS_HEAD_SIGNALS.md`.

## Why

Self-audit `28ca503b` (2026-08-10) found, correctly this time:

- No JSON-LD on `getclearsignal.io` (`OBS-SCHEMA-001`, 88% confidence — confirmed by `curl`).
- No canonical URL (`ELIG-CANONICAL-001`, warning — confirmed).
- `Trust & Proof: 35/100` — "expert-reviewed" appears repeatedly and is never anchored to a named
  person, credential, or described process.

The third is the same objection the first real reader raised in `R20`: *"выглядит АИшный документ,
не человек писал"*. Selling structured-data readiness without structured data, and human review
without a visible human, is the cheapest credibility hole we have.

**Scope guard:** this is marketing copy and page metadata, which `CLAUDE.md`'s scope freeze does not
cover. The audit also pushes toward an agency reseller programme, white-label and volume pricing —
**those stay frozen.** Do not build a partner programme, a pricing tier, or a contact/CRM flow.

## Tasks

### 1. Structured data

Add a single JSON-LD block to the landing page with `Organization` + `FAQPage`, following the
`@graph` shape the product itself emits (`lib/materials.ts:439`).

- `Organization`: `name`, `url`, `description` — values must match visible page copy.
- `FAQPage`: build `mainEntity` **only from FAQ questions already rendered on the page**. Never
  invent a Q&A that has no visible equivalent — that is a structured-data/content mismatch and it is
  precisely what our own implementation brief forbids.
- Reuse the existing `description` from `app/layout.tsx:11` rather than writing a second one that
  will drift.

### 2. Canonical

Set `metadata.alternates.canonical` in `app/layout.tsx` (`metadataBase` is already
`https://getclearsignal.io`). Verify the emitted `<link rel="canonical">` resolves to the page's own
URL, not to `/` for every route.

### 3. Name the reviewer

Every place the page claims "expert-reviewed" / "reviewed by a person" must be within sight of who
that person is.

- One sentence next to the primary claim naming the reviewer (Alexander Kalinko) and what the review
  actually consists of.
- A short "who built this" block — two or three sentences plus the name.
- Do **not** invent credentials, client counts, years of experience, testimonials, logos or partner
  references. If it cannot be stated truthfully today, it does not go on the page. Naming a real
  person is the whole point; padding it with unverifiable claims would recreate the problem the
  trust layer exists to prevent.
- `reviewer_note` already exists on the report side; this task is the landing page only.

## Acceptance

- `curl -sL https://getclearsignal.io/` returns a `<script type="application/ld+json">` block that
  passes Google's Rich Results Test with zero critical errors, and every FAQ question in it has a
  visible equivalent on the page.
- The same command returns a `<link rel="canonical">` pointing at the audited URL.
- The reviewer's name appears in the rendered page, within the same viewport section as the
  "expert-reviewed" claim.
- `positioning-copy.test.ts` and the rest of the vitest suite pass; `npx tsc --noEmit` and
  `npm run build` are clean. Non-ASCII in source uses `\u` escapes.
- Re-running the self-audit afterwards flips `OBS-SCHEMA-001` to `present` and
  `ELIG-CANONICAL-001` to `eligible`.

## Explicitly out of scope

Agency/reseller messaging lane, partner CTA, bulk pricing, white-label, replacing the Toronto movers
mock-up in the hero, testimonials, third-party badges. All of these appear in the audit's fix list;
all of them wait for paying customers.
