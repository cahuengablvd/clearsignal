# Trust-layer stabilization plan (Epics A–E)

Context for the implementer: ClearSignal's trust layer currently does word/substring-level
regex rewriting in `lib/sanitize.ts`, then repairs the resulting damage with more regexes in
`lib/report-validator.ts` (`BROKEN_STRINGS`). Three consecutive report versions produced new
defects of the same two classes: (A) redaction eats *measured* numbers ("Mention rate was and
citation rate was"), and (B) placeholder/span deletion leaves dangling fragments ("Get My Free
Quote --.", "a ' HomeStars Star Score'", "We'll be in touch within"). The worst case: the
commercial-claims sanitizer injected a phrase mid-clause inside `geo.source_gap_analysis`
prose, and the validator's BROKEN_STRINGS replaced it with a full sentence pasted mid-clause —
two safety layers *created* the defect and it passed validation because the final text was the
validator's own replacement phrase.

Architectural rules this plan enforces:

1. **No rule may replace a substring inside a sentence with a standalone sentence.**
   Risky sentences are kept, rewritten whole, or dropped.
2. **The LLM never writes counts/percentages about the test run.** All metrics render from
   typed data; `geo.summary` is rebuilt deterministically AFTER all sanitizer passes.
3. **One shared policy module** feeds every system prompt; the sanitizer's detection
   dictionary and the prompt's forbidden-word list come from the same source.
4. **Rules dispatch by content scope** (client claim vs third-party source description vs
   publishable copy vs internal note), not by ad-hoc path lists duplicated in two files.

Execution order: **B first** (smallest, fixes the most visible defect), then **A** (largest),
**C** in parallel with A, **D** after A (uses the scope map), **E** grows with each epic.
Each task lists acceptance criteria; write the tests in the same PR as the change.

---

## Epic B — Deterministic metrics rendering (do first)

### B1. `buildGeoSummary` as the only source of GEO summary text
- Extract the summary-building logic from `deterministicNarrative` in `lib/geo/index.ts` into
  an exported pure function `buildGeoSummary(input: { brand: string; test_counts: GeoTestCounts;
  mention_rate: number; citation_rate: number; ai_visibility_score: number; evidenceReused?: boolean }): string`.
- The LLM narrative call (`GEO_ANALYSIS_SYSTEM`) keeps producing `missing_signals` and
  `recommendations` only. Ignore/remove `summary` from the LLM output path (keep the schema
  field on `GeoResult`; it is now always deterministic).
- The template must state: score, mentions "X of N successfully tested engine-query
  combinations", mention/citation rates with literal percent values, and the reuse disclosure
  ("evidence reused from the previous completed scan") when `evidenceReused` is true. The
  reuse disclosure disappeared in build a537f65 — restore it wherever reuse actually happens.
- Acceptance: unit test rendering with rates 0/0 produces "…mention rate was 0% and citation
  rate was 0%…"; no sanitizer pass runs after it (see B2).

### B2. Rebuild `geo.summary` post-sanitize in the validator
- In `lib/report-validator.ts` `validateReport`, after `mapProse`, add
  `rebuildGeoSummary(report, warn)` mirroring `rebuildReadyMaterials`: recompute
  `report.geo.summary` from `report.geo.test_counts` + rates via `buildGeoSummary` whenever it
  differs; warn `geo: rebuilt summary from metrics`.
- Also add `geo.summary` handling so `sanitizeGeneratedReportValue` and `sanitizeReportProse`
  in `lib/audit-runner.ts` skip it (belt and suspenders; the rebuild makes damage moot).
- Acceptance: golden test asserts `report.geo.summary` contains the literal `%` values and
  matches `buildGeoSummary` output exactly.

### B3. No numeric counts in LLM narrative
- Add to `GEO_ANALYSIS_SYSTEM`, `GAP_SYSTEM`, and `ACTION_SYSTEM` (via the shared policy block,
  see C1): "Do not write numeric counts, percentages, or totals about the test run; metrics are
  rendered separately from typed data."
- Validator: for narrative fields (`geo.missing_signals[]`, `geo.recommendations[]`,
  `gap.ai_search.finding`, `gap.ai_search.missing_signals[]`), any sentence matching
  `/\d+\s*(%|tested|successfully|results?|combinations?|citations?|queries|engines?)/i` is
  **dropped at sentence level** with a warning (never silently, never substring-patched).
  Rationale: a count like "13 results that included citations" is unverifiable at validation
  time even when accidentally correct.
- Acceptance: mutation test injects "not cited in any of the 6 tested combinations across all
  13 results" into `missing_signals`; output contains neither number and the remaining text is
  grammatically complete (ends with terminal punctuation, no dangling connectors).

---

## Epic A — Sentence-level transformation engine

### A1. Sentence segmentation utility
- New `lib/trust/sentences.ts`: `splitSentences(text: string): string[]` where
  `splitSentences(t).join('') === t` (segments include their trailing whitespace).
- Must NOT split on: known abbreviations (`e.g.`, `i.e.`, `vs.`, `etc.`, `Mr.`, `St.`, `No.`),
  decimals (`4.5 stars`), domains/URLs (`az-moving.com`), ellipses, or inside quotes/brackets.
- Unit tests for each of those cases, plus: "Rated 9.8 on HomeStars. Next sentence." splits
  into exactly two.

### A2. Sentence decision engine
- New `lib/trust/decisions.ts`:

```ts
export type Audience = 'client_report' | 'outreach' | 'operator_note'
export type SentenceDecision =
  | { action: 'keep' }
  | { action: 'swap'; text: string }        // grammar-preserving word swap ONLY (whitelist)
  | { action: 'replace'; text: string }     // canonical full-sentence replacement
  | { action: 'drop' }

export function decideSentence(sentence: string, ctx: {
  audience: Audience
  scope: ContentScope            // see D1
  businessContext?: BusinessContext
  mentions?: number
  total?: number
}): SentenceDecision
```

- Migrate every rule from `TONE_REPLACEMENTS`, `UNVERIFIED_RESULT_PATTERNS`,
  `OVERCLAIM_PHRASES`, and `sanitizeUnsupportedCommercialClaims` into this engine as
  *detection* regexes + a decision:
  - Pure adjective/adverb swaps that cannot break grammar stay substring-level via `swap`
    (e.g. `catastrophic → significant`, `hemorrhaging → losing`). Keep this whitelist small;
    when in doubt, escalate to sentence level.
  - Everything that previously replaced a phrase with a clause or sentence becomes
    `replace` (whole sentence → one canonical safe sentence from `REPLACEMENT_SENTENCES`)
    or `drop`.
  - For `audience: 'outreach'`, risky sentences are **dropped**, never replaced — replacement
    templates written for the client's customers ("Ask the team about WSIB status…") must
    never appear in messages addressed to the business owner.
- Canonical replacement sentences live in one exported const `REPLACEMENT_SENTENCES:
  Record<string, string>` — the validator imports the same list (A4).
- Delete from `lib/sanitize.ts` once migrated: the regex-repairing-regex entries (e.g. the
  `every dollar of paid traffic is should be tested carefully` rule), duplicate rules (two
  `no youtube presence` entries), and the dangling-connector cleanup chains — they exist only
  to patch substring surgery that no longer happens.

### A3. Rewire `sanitizeGeneratedProse`
- `sanitizeGeneratedProse` becomes: split into sentences → `decideSentence` per sentence →
  reassemble. `redactPerformanceClaims` / `redactUnverifiedQuantifiedExamples` become
  *detectors* feeding decisions: a sentence containing an invented performance number or an
  unverifiable quantified example is replaced/dropped whole — **never** insert
  `[insert verified data]` into the middle of a sentence again.
- Keep `sanitizeGeneratedReportValue` recursion and skip-lists (replaced by scope map in D1).
- Acceptance: table-driven test — every detection rule has ≥1 synthetic sentence; for each,
  assert (a) the decision fires, (b) output is idempotent (second pass = no-op), (c) output
  passes the incomplete-sentence detector (A4).

### A4. Validator: detect artifacts, stop repairing
- Delete `BROKEN_STRINGS` and `cleanupClientPhrasing` repair chains from
  `lib/report-validator.ts`. Replace with detection that pushes **errors** (blocking):
  1. **Replacement-position check**: every occurrence of a phrase from
     `REPLACEMENT_SENTENCES` must (a) start at a sentence boundary per `splitSentences`, and
     (b) constitute the entire sentence. Otherwise error `artifact: replacement phrase
     embedded mid-sentence at <path>`.
  2. **Incomplete-sentence detector** over all prose fields: a sentence is broken if it ends
     with a preposition/conjunction/article before terminal punctuation
     (`in|within|since|at|for|of|to|and|or|the|a` + `[.?!]`), ends with `[-–—]\s*[.?!]`,
     contains an unmatched quote (`'` / `"` count odd within the sentence), or is empty after
     trimming leftover punctuation.
  3. Existing `CLIENT_ARTIFACTS` list stays for bracketed placeholders, mojibake, clipped
     roles.
- Acceptance: feed the three real-world broken strings from build a537f65 as fixture inputs —
  `…credentials (e.g.Pricing was not confirmed in this audit.`,
  `Suggested: Get My Free Quote --. Request a Quote.`,
  `a ' HomeStars Star Score'` — all three must produce validation errors.

### A5. Runner behavior on artifact errors
- `lib/audit-runner.ts` already throws when `validation.errors.length > 0`. Keep that, but
  before failing, attempt ONE content-repair round-trip: re-ask the model for only the
  offending fields with the violation list (reuse the `callClaudeJSON` repair pattern). If the
  regenerated field still fails, degrade that field to a neutral template (or drop the
  sentence) and continue — a single bad field must not kill a paid audit, but a broken
  sentence must never reach the PDF.

---

## Epic C — Shared policy module

### C1. `lib/policies.ts`
- Move `NO_FABRICATED_NUMBERS`, `EVIDENCE_BOUNDARY`, `CLAIM_LEVELS`, `UNTRUSTED_GUARD` here
  from `lib/prompts.ts`, and add:
  - `REVIEW_SCHEMA_POLICY`: AggregateRating/review markup only when rating AND reviewCount are
    verified, shown on-page, kept current, and allowed by search guidelines; otherwise
    Organization/Service/FAQPage only. (Currently only in `ACTION_SYSTEM` — it leaked into a
    GEO recommendation and an implementation brief in consecutive builds.)
  - `COMMITMENT_CONDITIONALITY`: recommendations requiring the business to publish new
    commitments (pricing pages, response-time SLAs, guarantees, insurance details) must be
    phrased conditionally ("If the business is willing to publish pricing guidance…") and must
    never invent example commitments ("We respond same day").
  - `NO_ASTROTURFING`: community-platform recommendations (Reddit, forums, Facebook groups)
    must describe transparent, disclosed participation; never "establish presence" /
    reputation seeding.
  - `NO_RICH_RESULT_GUARANTEES`: acceptance criteria may require markup to parse without
    critical errors; never promise that Google will display a rich result.
  - `ABSENCE_SCOPING`: external absence claims must be scoped ("was not observed in the tested
    sources"), never absolute ("No evident BBB accreditation").
  - `CLIENT_VS_SOURCE`: facts about third-party cited sources (their pricing content, their
    reviews) are observations about the source, not claims about the client; do not soften or
    verify-gate them.
- Export `SHARED_POLICY_BLOCK` (joined) and append it to EVERY system prompt in
  `lib/prompts.ts`: SCORE, GEO_ANALYSIS, GEO_SOURCES, CLARITY, GAP, ACTION, MATERIALS, BRIEF.
  (GEO_QUERIES/GEO_COMPETITORS may keep the minimal guard only.)
- Generate the forbidden-word list inside `EVIDENCE_BOUNDARY` from the sanitizer's detection
  dictionary (A2) so prompt and sanitizer cannot drift.

### C2. Drift test
- Unit test: every exported `*_SYSTEM` prompt string contains `SHARED_POLICY_BLOCK` (or the
  minimal guard for the two query-generation prompts). Fails when someone adds a new prompt
  without policies.

---

## Epic D — Scoping and structural cleanup

### D1. `ContentScope` map (replaces path lists in two files)
- New `lib/trust/scope.ts`:

```ts
export type ContentScope =
  | 'raw'                            // evidence, urls, json_ld, excerpts — never touched
  | 'client_business_claim'          // clarity/gap findings about the client
  | 'third_party_source_description' // geo.source_gap_analysis.* prose
  | 'recommendation'                 // top_fixes, geo.recommendations, briefs
  | 'publishable_copy'               // ready_materials.*, outreach message bodies
  | 'internal_note'                  // outreach .note, admin-facing text
export function scopeForPath(path: string[]): ContentScope
```

- Single source of truth consumed by `sanitizeGeneratedReportValue`, `validateReport`, and
  `collectClientArtifacts`. Delete `RAW_STRING_KEYS`/`RAW_PATH_PREFIXES` from `lib/sanitize.ts`
  and `RAW_KEYS`/`RAW_PREFIXES`/`isPublishablePath` from `lib/report-validator.ts`.
- Rule dispatch by scope:
  - commercial-claims rules run ONLY on `client_business_claim` and `publishable_copy` —
    **never** on `third_party_source_description` (root cause of the wahi.com defect: "wahi
    publishes pricing data" is a fact about the source, not a client claim).
  - `internal_note` allows operator instructions but still runs the incomplete-sentence
    detector (fixes "Replace and before sending.").
  - `publishable_copy` is strictest: artifacts there are always blocking errors.

### D2. Unique outreach channels
- `lib/schemas.ts` `ActionBlockSchema`: `.refine()` on `outreach_messages` — exactly 3 items,
  channels are a permutation of `{linkedin, email, twitter}`. The existing repair-retry in
  `callClaudeJSON` handles regeneration on violation. (Build a537f65 shipped two `email`
  messages and no `twitter`.)

### D3. Location prose in materials
- `materialsUserPrompt` in `lib/prompts.ts`: pass observed locations with the instruction
  "Name the primary market first and write locations as natural prose; never slash-join."
- Validator: `/(\w[\w ]*\s\/\s){2,}/` in `ready_materials.meta_title|meta_description` →
  warning + rewrite via one repair round-trip (A5 mechanism). (Build a537f65 shipped
  "Toronto / Ontario / Quebec / Canada".)

### D4. Scoped absence claims
- Extend the absence-bounding rules (sentence-level via A2) to cover `No evident X`,
  `No X accreditation`, `No X membership` in geo narrative → canonical scoped sentence
  ("X was not observed in the tested sources."). Contradiction guard: if a technical finding
  or clarity prose says a signal IS present on-page (e.g. BBB seal observed), an absolute
  external absence claim about the same entity becomes a validation warning.

### D5. Admin: empty-context warning
- `app/admin/page.tsx` preview step: when every `business_context` select is `unknown` and
  `verified_facts` is empty, show an amber notice: "Business context is empty — the sanitizer
  will strip credential/pricing/service claims (including ones observed on the page). Fill in
  what the client verified." Non-blocking.

---

## Epic E — Regression harness (grows with each epic)

### E1. Snapshot golden test
- Extend `tests/golden-report.test.ts`: full `expect(validation.report).toMatchSnapshot()`
  (or a committed expected-output JSON compared deeply). Any wording change reviews as a
  diff. Keep the existing invariant checks.

### E2. Rule table tests
- For every detection rule in the A2 engine: synthetic sentence → expected decision →
  idempotence (double pass) → incomplete-sentence detector passes on output. One data table,
  one test.

### E3. Mutation tests
- Fixture-injection suite: insert known-bad content into fields of each ContentScope —
  invented percents, `$5k/mo`, `3x`, `[insert verified data]`, `[Name]`, "AggregateRating
  markup", "one slot open", counts-in-narrative, `Get a Free Quote in 2 Minutes`, WSIB claims
  with empty context — and assert: correct decision per scope, zero validator errors AFTER
  processing, zero incomplete sentences, and third-party source descriptions left intact.

### E4. Multi-vertical fixtures
- After each of the next real audits in a new vertical (B2B SaaS, gallery/portfolio), save the
  PRE-sanitizer raw report as `tests/fixtures/golden-report-<slug>.json` and add it to the
  golden suite. Target: ≥3 verticals before the 20-audit run finishes.
- Re-generation stability check: run sanitize+validate twice over each fixture; results must
  be byte-identical.

---

## Definition of done for the whole plan

1. The three real defects from build a537f65 (wahi fragment, broken CTA suggestion, orphaned
   HomeStars quote) reproduce as failing tests before the fix and pass after.
2. `geo.summary` in the golden report contains literal percent values and matches
   `buildGeoSummary` output.
3. Grep proof of architecture: no rule in the codebase replaces a substring with a string
   containing terminal punctuation (enforce by code review + the A4 position check).
4. `BROKEN_STRINGS` and `cleanupClientPhrasing` are deleted.
5. Every system prompt contains the shared policy block (C2 test green).
