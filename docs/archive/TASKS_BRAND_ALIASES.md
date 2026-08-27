# TASKS_BRAND_ALIASES — the customer's real name is invisible to the detector

**Defect:** `R39` (first paying-customer report affected). Touches `lib/brand.ts`,
`lib/audit-runner.ts`, `lib/geo/*`, schemas and the admin form, so it **needs a Trigger deploy from
`C:\csdeploy`.** If storage needs a new column, apply the migration in the same step (`R23` rule).

## What happened

Audit `63bfd278` (`alahli.com`, 2026-08-25 — the first paid audit) reports "Alahli was named in
**1 of 15** answers". Page 11 of the same report shows an OpenAI answer, verdict **"Not named"**,
whose second list item is:

> "2. **Saudi National Bank (SNB)**: Offers a range of savings accounts…"

The customer's bank, named second, counted as absent. Page 15: "SNB Global Multi-Currency Credit
Card" described in a full paragraph — also "Not named". The engines name the bank by its real
names — SNB, Saudi National Bank — and detection only knows "Alahli".

## Root cause

`resolveBrandEntity` (`lib/brand.ts:117`) accepts a name candidate only if it shares a stem with
the domain token (`isRelated`). "Saudi National Bank" and "SNB" share nothing with `alahli`, so they
are discarded — even though the page title is "Alahli (SNB)" and the ICP text names both. That
heuristic is correct as a *guess* filter; the defect is that **there is no operator input to state
the truth**. Rebrands, initialisms and legal-vs-trade names are common (SNB/AlAhli, SABB/SAB,
NCB/AlAhli); a stem heuristic can never cover them.

`R1` already built the recheck machinery: stored answers are re-scored by the current alias
detector on regenerate/re-render. What is missing is the input.

## Fix

1. **An operator field: brand aliases.** Semicolon-separated names ("Saudi National Bank; SNB; SNB
   AlAhli") on the admin create/edit form, stored with the audit's business context following the
   existing pattern (`business_model`, `target_markets_languages`). Not on the public checkout in
   this task — the operator can collect aliases in conversation; expanding the paid form is a
   separate decision.
2. **Merge operator aliases into the brand entity** after `resolveBrandEntity`, before GEO
   detection: each alias becomes an `alternative_brand_forms` entry with `buildVariants` tokens, so
   mention detection, the "Also detected as" header line and `report.meta` all see them. Operator
   input wins over the heuristic — same principle as `business_model` (`R24`).
3. **Aliases are the brand, everywhere.** A discovered competitor whose normalised form matches an
   operator alias must be dropped from competitor discovery and `competitor_visibility` — the
   customer must never appear as their own competitor.
4. **Recheck must pick aliases up.** Regenerate-with-reuse and re-render re-score stored answers
   with the current alias set (the `R1` machinery). Adding an alias and regenerating with reuse must
   flip previously "Not named" verdicts without new engine calls.
5. **Guardrails, minimal:** trim, dedupe case/punctuation-insensitively, drop empty entries, cap at
   10 aliases. Matching stays exact token-sequence (`textMentions`), never substring — an alias
   "SNB" must not match "snbc". Do not attempt to validate that an alias "belongs" to the brand;
   that is the operator's judgement and the human-review gate's job.

## Acceptance

Each starts as a failing test.

- A fixture with canonical `Alahli`, aliases `Saudi National Bank; SNB`, and a stored answer naming
  "Saudi National Bank (SNB)" scores that answer as named. (Fails today.)
- The same fixture without aliases keeps today's behaviour.
- Competitor discovery over answers naming "SNB" does not emit `SNB` as a competitor when it is an
  operator alias; it still does when it is not.
- Regenerating with `reuseGeoEvidence` after adding an alias flips the stored verdicts; the report
  header lists the aliases under "Also detected as".
- An alias list of 12 entries is rejected with a clear message; `"SNB"` does not match `"snbc"`.
- `npx tsc --noEmit`, `npm run build`, full vitest suite pass.

## Verification after deploy

Set aliases `Saudi National Bank; SNB; SNB AlAhli` on audit `63bfd278` and run **one full
regeneration** (fresh engines — Perplexity answered 3/6 last time and deserves a retry; run it first
thing in the day, within the spend cap). Review by hand: the named count must rise from 1/15, no
alias may appear as a competitor, and if SAB/SABB still shows as two banks, that goes to the
reviewer note (`R19` stays open, deliberately).
