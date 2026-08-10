# Release cut — final sprint before the 20-audit run

Status: the trust-layer architecture from TASKS_TRUST_LAYER.md has landed (sentence engine,
scopes, deterministic GEO metrics, review gate, cost tracking, report versions, GEO reuse,
snapshot test). A 4-vertical run on build 07af736 (az-moving, blvdprod, latvianart,
monokelriga) shows prose is clean of class-A/B artifacts across all four reports. The
remaining defects are concentrated in ONE subsystem — ready-materials fallbacks — plus two
schema/format gaps.

**This is the LAST code sprint before the 20 audits. Scope is fixed: F1–F8 below, nothing
else.** New defects discovered after this sprint go to a backlog and are fixed in weekly
batches, not daily loops (see "Process after freeze" at the bottom). Every task here starts
by adding the failing case to tests (fixtures from the four 07af736 reports).

---

## F1. Vertical misdetection: video-production company got moving-company materials (CRITICAL)

Observed: blvdprod.com (video production) shipped with meta description "Blvdprod provides
residential and commercial moving services", FAQ "How do I request a moving quote from
Blvdprod?", and JSON-LD `MovingCompany` / "Blvdprod moving services".

Root cause: `isMovingBusiness()` in `lib/materials.ts` keyword-sniffs `/\b(moving|movers?|…)\b/`
over brand+url+FAQ prose. Creative-industry copy legitimately contains "moving" (emotionally
moving stories/videos), so a video-production brand triggers the moving fallback.

Fix:
- Vertical selection NEVER comes from single-keyword matches over prose. Use only:
  (1) `business_context.business_model` (operator-selected), then
  (2) `observed_business_context.inferred_business_type` when it is an exact vocabulary match
  (e.g. equals `moving_company`), else no vertical.
- If any inference over text remains as a last resort, it must require compound evidence,
  never a bare ambiguous token: `moving` counts ONLY co-occurring with a strong signal
  (`movers|relocation|packing service|residential move|commercial move|piano moving|moving
  quote|storage unit`). "Emotionally moving", "moving stories", "moving images", "moving
  forward" must never classify. Unit-test exactly those phrases as negatives.
- The default fallback (`neutralMovingMaterials` today) must be industry-agnostic:
  `Organization` JSON-LD, generic contact/inquiry FAQ, no service nouns the page didn't state.
  Rename accordingly; the moving-specific template applies ONLY when the vertical is
  affirmatively `moving`.
- Defense in depth (cheap validators, blocking errors):
  - **Schema allowlist per category**: `moving_service → [MovingCompany, Service, FAQPage,
    Organization]`, `video_production → [ProfessionalService, Organization, Service, FAQPage]`,
    `tailoring_atelier → [LocalBusiness, ProfessionalService, Service, FAQPage]`,
    `art_gallery → [ArtGallery, Organization, VisualArtwork, FAQPage]`, default →
    `[Organization, FAQPage]`. Any JSON-LD @type outside the allowlist = blocking error.
  - **Foreign-industry vocabulary check** on ready_materials + outreach: a small per-category
    stoplist (non-moving business must not contain `moving quote|movers|pickup and drop-off|
    stairs or elevator|inventory size`, etc.). Blocking error.
- Test: blvdprod fixture through `assembleMaterials` produces zero occurrences of
  `moving|movers|MovingCompany` unless the input itself is a moving business.

Note on diagnosis: an external review attributed this defect to cross-audit state leakage /
cached materials / stale job payloads. That is NOT the mechanism — `neutralMovingMaterials`
is a static template triggered by keyword sniffing within a single audit's own data. No
cross-audit isolation work is needed; the validators above are sufficient defense.

## F2. Replacement sentences leak into client text — publishable materials finalized LAST

Observed across THREE of the four 07af736 reports (not only monokelriga):
- monokelriga: meta description is literally "Use verified business data before publishing
  this example."; same sentence as a full FAQ answer, inside JSON-LD, glued to a fix
  description.
- az-moving: source-gap sections contain "Fix: Contact AZ Moving to discuss third-party
  rating details for your move." (×3) and "Fix: Add source-backed proof details in crawlable
  copy." — repair templates as the entire client-facing fix text, applied to THIRD-PARTY
  source descriptions (scope violation: the moving-claims repair fired on
  `source_gap_analysis` prose describing competitors' ratings).
- blvdprod: "Proof-related recommendations should be backed by verified source data." glued
  mid-paragraph into clarity prose AND emitted verbatim as implementation-brief step 2.

Also "arrange your visit the website" appears in the PDF even though `lib/materials.ts`
patches exactly that string — because materials are assembled BEFORE later sanitizer passes
re-damage them.

Fix additions beyond the ordering change below:
- **Blocking artifact check**: export the full `REPLACEMENT_SENTENCES` values list; any
  occurrence in ANY client-visible field that is (a) glued to other text in the same
  sentence/paragraph position, or (b) the entire content of a publishable field
  (meta/FAQ/CTA/brief step/fix text), is a blocking error:
  `expect(clientText).not.toContainGluedOrStandalone(REPLACEMENT_SENTENCES)`.
- **On this error the pipeline BLOCKS, never re-cleans**: PDF is not rendered, the audit is
  marked failed-validation, and the admin UI shows the exact field path + quoted text. No
  code anywhere may strip or rewrite a replacement phrase after the fact — that is how the
  materials.ts:98 whack-a-mole seed appeared. One repair round-trip for the offending field
  (A5 mechanism) is the only permitted recovery; if it fails, the field degrades to its
  neutral template and the block is re-validated.
- **Scope fix**: the moving-claims repair and proof-recommendation replacements must never
  run on `third_party_source_description` paths (`geo.source_gap_analysis.*`) — extend the
  scope exemption in `lib/trust/decisions.ts` to ALL repair families, not only the numeric
  ones. A competitor's "Google Rating 5.0" is an observed fact about the source.
- **Brief steps**: `implementation_briefs[].steps[]` scope = `recommendation`; a replacement
  sentence can never BE a step — if a step matches a replacement sentence, drop the step.

Fix (ordering + policy, no new regexes):
- Move `publishableSafeMaterials` + `buildJsonLd` + neutral-fallback substitution into the
  validator stage, AFTER all sanitize passes (same slot as `rebuildReadyMaterials`). Materials
  are the last thing computed before persistence.
- In `lib/trust/decisions.ts`: for `scope: 'publishable_copy'`, the `replace` action is
  FORBIDDEN — allowed decisions are `keep`, `swap`, `drop`. A dropped meta/FAQ/CTA field falls
  back to its neutral deterministic template (`neutralMetaDescription`, generic FAQ item) or
  the field is omitted.
- Validator rule: any `REPLACEMENT_SENTENCES` value equal to (or contained in) a
  `ready_materials.*` or FAQ/JSON-LD string = blocking error.
- DELETE `lib/materials.ts` line ~98 (`.replace(/\bUse verified business data…/`) and the
  `arrange your visit the website` patch (~line 135). These are repair-the-repair regexes —
  the exact pattern this refactor exists to eliminate. With materials finalized last, they
  have nothing to clean.
- Test: monokelriga fixture → meta description is real copy or the neutral template; no
  replacement sentence anywhere in ready_materials/json_ld.

## F3. Replacement-sentence audit (client-facing wording)

"Use verified business data before publishing this example." is operator-facing language.
Review all `REPLACEMENT_SENTENCES`: each must read as client-appropriate prose for
`client_report` audience. Where no client-appropriate full-sentence replacement exists,
prefer `drop`. Keep the list ≤ 8 entries.

## F4. Outreach channels: enforce exactly 3 unique channels

Observed: latvianart shipped 2 messages (email, email); az-moving and monokelriga shipped
email/linkedin/email. Only blvdprod was correct.

Fix: `ActionBlockSchema.outreach_messages` zod `.refine()`: length === 3 AND channels are a
permutation of {linkedin, email, twitter}. The existing `callClaudeJSON` repair retry handles
regeneration. If the retry also fails, keep whatever unique channels exist and drop
duplicates (validator warning) — never ship two of a kind.

## F5. Locations as prose, not slash-joins

Observed: az-moving meta description "…in Toronto / Ontario / Quebec / Canada."

Root cause moved into the new code: `lib/materials.ts` `observed_location.join(' / ')`
(fallback template) and `neutralMetaDescription` `slice(0,2).join(' / ')`.

Fix: format helper `locationsToProse(list)`: 1 item → "in Riga"; 2 → "in Toronto and across
Ontario"; 3+ → "in <city> and across <region>" (first city + first region, drop the country
when a region is present). Use it in both places. Validator warning on `/\w+ \/ \w+ \/ /` in
ready_materials fields.

## F6. Currency symbols are being stripped from prices

Observed: monokelriga "suits starting from 855 and 1125", "'Made In Italy' (from 1125)" —
the € sign is gone everywhere (including inside FAQ answers), leaving bare numbers.

Root cause: encoding normalization / claim regexes drop `€` (REVENUE_CLAIM knows only `$`).

Fix: in `normalizeEncodingArtifacts` (or wherever the € mojibake dies), map the euro-sign
mojibake to `EUR ` (or `€` if PDF font supports it) instead of deleting; add a unit test
"from €855" → "from €855" / "from EUR 855" (never "from 855"). Note: these are prices
OBSERVED on the target page — they must be preserved, not redacted (same provenance rule as
the HomeStars score).

## F9. Brand alias detection understates the product's core metric (measurement bug)

Observed: monokelriga report marks the Perplexity answer for "best custom tailored suits in
Riga for men" as **Not named**, while the stored answer literally opens with "The best
custom-tailored suits for men in **Riga** are offered by **Monokel Riga**". The headline
AI-visibility number (2 of 14) is therefore WRONG — the client is more visible than the
report claims. This is not cosmetic: it's the metric customers pay for, erring against us
(under-reporting visibility looks like the tool inflates the problem it sells the fix for).

Fix in `lib/geo/detect.ts` `buildVariants`/`textMentions`:
- Generate spacing/casing variants of compound brands: `Monokelriga` → also match
  `Monokel Riga`, `monokel-riga`, `MONOKEL RIGA`; `Az-moving` → `AZ Moving`, `A-Z Moving`,
  `azmoving`; general rule: split camel/compound at existing word boundaries found on the
  page (use `alternative_brand_forms` from `resolveBrandEntity` — it already exists in meta).
- Matching must be case-insensitive and tolerant of hyphens/spaces between tokens.
- **Alias precision — two tiers, to avoid false positives on other brands**:
  - `exact` aliases (multi-token or domain-derived: "Monokel Riga", "monokelriga.lv",
    "AZ Moving") match on their own.
  - `weak` aliases (a single generic token: "Monokel") count as a mention ONLY with
    corroboration in the same answer: the brand domain, the brand's city, or another exact
    alias. Otherwise ignore — a Berlin eyewear brand "Monokel" must not inflate the score.
  - Test both directions: "Monokel Riga" alone → mentioned; bare "Monokel" in an unrelated
    context → not mentioned.
- Recompute is cheap: detection is deterministic over stored evidence, so re-running it on
  stored answers fixes historical reports too (re-render path exists via
  `lib/report-rerender.ts`).
- Test: the monokelriga fixture answer above yields `brand_mentioned: true`; az-moving
  answers containing "AZ Moving" match `Az-moving`.

## F7. Fixtures from the 07af736 four-vertical run

Save the four current raw reports (pre-sanitize if retrievable from report_versions, else
post) as `tests/fixtures/golden-report-{az-moving,blvdprod,latvianart,monokelriga}.json` and
add all four to the snapshot suite. This is the multi-vertical golden set (E4) — it now
exists for free; don't lose it.

Regression assertions to add against these fixtures (merged from external review):

```ts
it('does not leak moving copy into a video-production audit')          // F1
it('does not emit MovingCompany schema for a non-moving business')     // F1
it('recognizes "Monokel Riga" as a mention of Monokelriga')            // F9
it('does not output replacement sentences in client-visible text')     // F2
it('does not sanitize competitor/source facts as client claims')       // F2 scope
it('does not duplicate outreach channels')                             // F4
it('renders locations as prose, never slash-joined lists')             // F5
it('preserves currency on observed prices')                            // F6
it('blocks export on foreign-category FAQ/CTA/schema text')            // F1
```

## F8. Operator checklist in the review gate

The review gate (commit 7669037) is the primary defense from here on. Add a static checklist
panel to the admin review screen (plain HTML, no logic):

1. Meta/FAQ/JSON-LD describe THIS business (right industry, right services)?
2. Prices/scores shown with currency/scale and match the client's page?
3. Outreach: 3 messages, 3 different channels, correct domain, no odd instructions?
4. No sentence reads as an internal instruction or template?
5. GEO summary numbers match the stat blocks?
6. Suggested copy contains no commitments the client hasn't verified (response times,
   guarantees, availability)?

~5 minutes per audit. A defect caught here costs nothing; the same defect in a client's
inbox costs the product's credibility.

---

## Stability gate (between freeze and the 20 audits)

One mandatory check after F1–F9 land, before any external audit ships. Two parts, different
costs:

1. **Determinism check (free)**: re-render all four fixture reports ×3 from stored evidence
   via `lib/report-rerender.ts`. All three renders must be byte-identical per site. Catches
   nondeterminism in sanitize/validate/render.
2. **Generation-variance check (paid, bounded)**: full regeneration ×3 for TWO sites — one
   moving (az-moving) and one non-moving (blvdprod, the F1 victim). Across runs verify:
   industry classification never flips; no replacement phrase appears anywhere; alias
   mention counts stable given the same stored engine answers; no foreign-industry
   vocabulary in ready materials. Cost is now measurable per run via the cost tracker —
   record it; this doubles as the first real cost benchmark.

Gate passes → start the 20 audits. Gate fails → the failure IS the next batch, fixture
first.

## Process after freeze (the actual answer to "this could go on forever")

The loop feels endless because a stochastic system is being tested by hand, one PDF at a
time — every generation is new sampled text, so new edge cases are GUARANTEED. The exit is
not "no defects"; it is:

1. **Defects can't reach clients** — review gate + F8 checklist (already true after this
   sprint).
2. **Every found defect becomes a test in ≤15 minutes** — fixtures + mutation suite (F7).
3. **Defect classes are closed architecturally** — done; remaining findings are instances,
   not classes.

Rules from now on:
- Trust-layer code is FROZEN except for batch fixes. Defects found during the 20 audits go
  to a backlog file (`DEFECTS_BACKLOG.md`: date, audit id, field path, quoted text). Fix in
  ONE weekly batch, each fix preceded by a failing fixture test.
- No more daily regenerate-and-eyeball loops. The snapshot suite + review checklist replace
  them.
- Ship the 20 audits. Feedback from real recipients will reorder every remaining priority
  better than another week of self-review.

---

## Deferred to post-launch backlog (deliberately NOT in this sprint)

Seeded from the external 23-item review. These are real observations but either
over-engineered for a pre-revenue beta, cosmetic, or already mitigated by the F8 operator
checklist. Do not pull them forward.

- **Full provenance model** (`FactProvenance` per fact, typed evidence store shared by all
  analysis modules). The monokelriga "provenance mix-up" was actually the operator pasting
  observed facts into the `verified_facts` free-text field — a workflow issue, not a renderer
  bug. Near-term mitigation: admin-form hint on the verified_facts field ("only facts the
  CLIENT confirmed — observed data is captured automatically") + F8 checklist item.
- **Detector vs narrative reconciliation / contradiction detector** (blvdprod H1 wording
  mismatch, Latvian CTA not detected by findings detectors). Real class; needs detector
  localization and evidence-text plumbing — weekly-batch material, checklist catches it
  meanwhile.
- **Evidence-type compatibility matrix for recommendations** (H1 fix citing OBS-PROOF etc.) —
  category-router refinement in action-confidence; batch material.
- **Observation vs recommendation vs impact confidence split** — display-layer change,
  post-launch.
- **Role matrix and control/probability logic refinements** — cosmetic relative to the rest.
- **`relevanceScore` for source recommendations** (geo × category × attainability ×
  authority) — premature optimization; a one-line prompt nudge ("prefer sources plausibly
  attainable for a business of this size and region") covers 80%.
- **Locale-tagged copy / mixed-language validator** (monokel "Uzvalks, kas šūts tieši Jums.
  Riga's bespoke atelier…") — needs a product decision on report language strategy first.
- **Deterministic executive-summary template** — current summaries vary in quality;
  revisit after real-client feedback.
- **Canonical display-name policy** (`preferredReportName`) — `resolveBrandEntity` already
  produces alternative forms; renderer consistency is polish.

Factual corrections to the external review (do not implement against these claims):
- "Cross-report contamination / state leak" — wrong mechanism; see F1 note. No cross-audit
  data flow exists in the affected path.
- "Monokel/Latvianart briefs contain MovingCompany" — not present in the 07af736 reports;
  monokel briefs use LocalBusiness/Service (appropriate for an atelier). Only blvdprod had
  MovingCompany, and that is F1.
- "Blvdprod business context Unknown despite detailed ICP" — ICP field ≠ business-context
  form; the operator left the form empty. That is the F8/D5 workflow item, not a code bug.
