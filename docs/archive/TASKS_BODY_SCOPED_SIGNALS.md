# TASKS_BODY_SCOPED_SIGNALS — body-level checks now match against the whole raw document

Touches `lib/findings.ts`, so it **needs a Trigger deploy from `C:\csdeploy`**.

## The problem

`R25` changed the crawl from Firecrawl's cleaned `html` (main content, no `<head>`) to `rawHtml`
(the complete document). That was correct for head-level checks and is already verified in
production. The side effect was not considered: `computeTechnicalFindings` hands the *same* string
to every check, so body-level detectors now also see `<head>`, `<meta>`/Open Graph tags, inline
`<script>` payloads and framework hydration data.

Two checks match by keyword over that whole string:

- **Social proof** (`lib/findings.ts:280`): `trusted by|testimonial|case stud|customer logos?|rated|
  reviews?|g2|capterra` tested against `html` and `markdown`. An Open Graph description, a JSON blob
  or a script string containing "reviews" now yields `Social proof signals — present — 60%`.
- **FAQ structure** (`lib/findings.ts:306`): the `FAQPage` and `FAQ` patterns are tested against the
  same string, so the same class of match applies.

A false `present` here is a claim about the client's page in a paid report — the trust layer's own
territory. It also silently *removes* a real finding: a page with no proof at all should be told so,
and instead gets a reassuring green row.

Note the direction of harm is the opposite of `R25`: there we wrongly denied signals that existed,
here we may assert signals that do not.

## Fix

1. Derive a body-scoped string once in `computeTechnicalFindings` — the content of `<body>` with
   `<script>`, `<style>`, `<template>` and `<noscript>` blocks removed — and use it for every check
   whose subject is visible page content: CTA, H1, social proof, FAQ language.
2. Head-level checks (`meta_description`, `json_ld`) keep using the full document. JSON-LD is
   legitimately allowed in either `<head>` or `<body>`, so that one must still see both — but it
   must not be satisfied by a `FAQPage` string appearing inside unrelated script data; match the
   `application/ld+json` script element, as it already does, not a bare keyword.
3. Keep the existing three-way outcome shape (`present` / `unknown` / `absent`) and the existing
   confidence values. This task changes *what text is searched*, not how findings are graded.

## Acceptance

- A fixture whose only occurrence of "reviews" is inside an Open Graph tag or an inline script
  yields `social_proof: unknown`, not `present`. Failing test first.
- A fixture with a visible testimonials section still yields `social_proof: present`.
- A fixture whose only occurrence of `FAQPage` is inside unrelated script data does not yield
  `faq_structure: present`; a real `FAQPage` JSON-LD block still does.
- The `R25` regressions stay green: head-level checks still detect meta description and JSON-LD in
  `<head>`, and still report `unknown` when no `<head>` was captured.
- `npx tsc --noEmit`, `npm run build`, full vitest suite pass.

## Verification after deploy

Regenerate audit `28ca503b`. `getclearsignal.io` has no named testimonials, so `Social proof
signals` should stop reporting `present` — it currently does, at 60%, on a page whose own audit
scores Trust & Proof 35/100 for having no proof. Those two statements contradict each other today.
