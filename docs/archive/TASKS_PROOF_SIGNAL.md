# TASKS_PROOF_SIGNAL — the social-proof detector fires on substrings of ordinary words

Touches `lib/findings.ts`, so it **needs a Trigger deploy from `C:\csdeploy`.**

## The failure

`getclearsignal.io` has no testimonials, no client logos, no named references — its own audit scores
Trust & Proof `35/100` for exactly that. The same report says:

> `OBS-PROOF-001 — Social proof signals — detected present — 60%` — evidence: `review`

Run the current pattern (`lib/findings.ts:291`) over the live page body and it matches **29 times**.
The matches:

```
'review'  <- "Expert-reviewed AI Visibility Audit"
'reviews' <- "Alexander Kalinko reviews the evidence"
'review'  <- aria-controls="audience-audit-preview"
```

Two causes, both in the pattern:

1. **No word boundaries.** `reviews?` matches inside `reviewed`, `reviewer`, `preview`.
   `rated` matches inside `generated`, `integrated`, `curated`, `operated` — words that appear on
   almost every commercial page, including ours.
2. **Attribute values are searched.** `aria-controls`, `id` and `class` values are not visible page
   content, but the check reads raw HTML, so `id="audience-audit-preview"` counts as social proof.

The result: nearly any page earns `present`, and on our own page the trigger is our *own* review
claim — a first-party statement, which is the opposite of social proof.

## Why it matters

This is a claim about the client's page in a paid report, in the trust layer's own territory. It is
also self-defeating: a page with no proof should be told so plainly, and instead gets a reassuring
green row while a later section marks proof as the top gap. Two sections of the same report
contradicting each other is worse than either finding alone.

Same family as `R25` and the body-scope fix: a detector asserting something it did not establish.
Third instance, so treat the pattern as the lesson, not this one regex.

## Fix

1. Anchor every keyword on word boundaries. `\breviews?\b` never matches `reviewed`; drop bare
   `rated` in favour of phrases that actually indicate third-party proof
   (`\brated \d`, `\b\d(?:\.\d)?\s*(?:\/|out of)\s*5\b`, `\bstar rating\b` and similar).
2. Search visible text, not markup. Strip tags from the body content before matching so attribute
   values, class names and element ids cannot satisfy the check. `stripTags` already exists in this
   file.
3. Exclude first-party review language from the proof signal. "Expert-reviewed", "reviewed by
   <name>", "we review every report" describe **our** process, not third-party endorsement. A page
   whose only match is first-party must not report `present`.
4. Prefer `unknown` over `present` when the only evidence is a lone keyword. Keep `present` for
   signals that plausibly indicate real proof: a named testimonial pattern, a review-platform name
   (`G2`, `Capterra`, `Trustpilot`, `Clutch`), a star rating, or "trusted by" followed by names.
   The existing three-way shape and confidence values stay as they are.

Do not delete the check. A page with genuine proof should still be credited — `R18` depends on this
signal being meaningful.

## Acceptance

Each starts as a failing test.

- A fixture containing only `Expert-reviewed audit` and `id="audit-preview"` yields
  `social_proof: unknown`, not `present`.
- A fixture containing `generated`, `integrated` and `curated` and nothing else yields
  `social_proof: unknown`.
- A fixture with `"ClearSignal saved us hours" — Jane Doe, Head of SEO at Acme` yields
  `social_proof: present`.
- A fixture naming `G2` or `Trustpilot` in visible text yields `present`.
- Existing `R25` and body-scope regressions stay green.
- `npx tsc --noEmit`, `npm run build`, full vitest suite pass.

## Verification after deploy

Regenerate audit `28ca503b`. `Social proof signals` must stop reporting `present` — the page has
none, and the report's own Trust & Proof section already says so.

## Also check while you are in this file

`faqKeyword` (`\bFAQ\b|frequently asked questions`) is already word-bounded and fine. Confirm no
other detector in `lib/findings.ts` matches an unbounded substring; fix any that do, in the same
pass, with the same rules.
