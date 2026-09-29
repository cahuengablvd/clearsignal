# ClearSignal External + Company Evidence Review

*Research only. No production code, prompts, migrations, report, UI, schema, audit behavior, Trigger
config, or deploy was modified while producing this document. No money was spent, no paid account
was created, and no paid API call was made.*

## Revision 2 — changes from previous version (this pass)

- Closed the primary-source gap on OpenSEO/DataForSEO using the facts the coordinator supplied
  (DataForSEO's own MCP server exists; current DataForSEO pay-as-you-go pricing for the three
  relevant endpoints; OpenSEO's ~28% hosted markup over DataForSEO's own cost). §5 rewritten.
- Fully read `lib/materials.ts` and its tests (`tests/material-category.test.ts`,
  `tests/report-coherence.test.ts`) and located where acceptance criteria are actually produced
  (`lib/prompts.ts`, not `lib/prioritization.ts` — that file is only a priority-score formula).
  Hypothesis H and J in §4 are now resolved with no "NEEDS VERIFICATION" remaining.
- Inspected `evals/`, `tests/fixtures/`, and `validation/` directly. The August plan for five golden
  reports was **not** completed (2 of 5 exist). No human-labeled entity/query/source ground truth
  exists anywhere in the repo — only report-snapshot regression fixtures. §2 and §8 corrected.
- Found real, stored Google Maps citation URLs in `tests/fixtures/golden-report-rozie.json`
  (`https://www.google.com/maps/search/<Business+Name>%2C+<Location>`) and confirmed the pipeline
  retains full citation URLs, not just domains, before `KNOWN_CHANNELS` collapses them to
  `google.com` for role/state classification. §2, §5, §9 updated with this concrete evidence.
  This resolves the previous "is Maps resolution even testable" open question.
- Added a proposed, non-authoritative label set (§ new, inside §8) built strictly from evidence
  already present in checked-in fixtures and `DEFECTS_BACKLOG.md` — explicitly marked as AI-proposed,
  pending human confirmation, not ground truth.
- Re-scoped Experiment A down to a standalone, read-only research script (no audit-path, Trigger, or
  Supabase touch) and re-scoped Experiment B's tooling choice (DataForSEO direct/its own MCP, not
  OpenSEO) in §9.
- Reset success criteria in §10 into hard-safety / research-criterion / indicative-observation tiers,
  removing absolute claims on small N.
- §14 gate changed from "NEED MORE RESEARCH BEFORE CODEX" to a decision, per track.

## 1. Executive conclusion

Idea 2 (Verified Company Context) remains the stronger opportunity and is now ready to spec as a
research spike: acquisition is still homepage-only (`lib/firecrawl.ts`), a self-documented gap
(`R22`, open) a real customer already found by hand, and the existing fact/provenance/safety
machinery (`lib/verified-facts.ts`, `lib/business-context.ts`, `lib/materials.ts`'s explicit
neutral-fallback logic) is mature enough that a bounded multi-page acquisition experiment can be run
as a read-only standalone script with no production-path risk. Idea 1 (external SERP/DataForSEO
corroboration) stays mostly rejected/deferred, with one narrow exception now concretely testable:
ClearSignal's own stored citation evidence already contains full Google Maps search URLs
(`https://www.google.com/maps/search/<name>,<location>`), which map directly onto a DataForSEO Maps
SERP / Business Listings *search* query — so Maps-identity corroboration is genuinely testable from
data already in the repo, not a speculative capability. OpenSEO itself is not needed for that test:
DataForSEO has its own official MCP server, so the wrapper adds a markup and a transformation layer
without adding capability. Fact-grounded material generation (Hypothesis H) turns out to be **already
substantially solved at the safety layer** — `lib/materials.ts` explicitly detects and marks its own
generic-fallback output (`isNeutralGenericMaterials`) and discloses missing facts in-copy ("category
was not established in this audit") rather than inventing detail — the open question is only whether
richer facts would let *more* audits avoid that fallback, which the research spike can measure
directly. Acceptance criteria (Hypothesis J) are free-text LLM output not tied to evidence IDs today;
richer facts would make them more specific without requiring an architecture change. One Codex
research spike is ready to run now (Verified Company Context, §14); Maps corroboration is scoped as a
reviewer-only manual experiment that likely does not need Codex at all and should wait on the owner's
explicit go-ahead to spend the $1 DataForSEO trial credit.

## 2. Current system reality

| Area | Current implementation | Evidence | Remaining gap |
|---|---|---|---|
| Target site acquisition | Single-page scrape via Firecrawl (`scrapeUrl`/`scrapePage` take one `url`, `formats: ['markdown','rawHtml']`, `maxAge: 0` so always fresh) | `lib/firecrawl.ts:59-123` | No multi-page crawl exists. `DEFECTS_BACKLOG.md` R22 (open) documents a real customer finding address drift, stale prices, an outdated language variant, and missing procedure pages that single-page scrape could not see. |
| Business facts / provenance | `lib/verified-facts.ts` builds `VerifiedFact[]` from operator-typed text (regex-matched) plus deterministic `ObservedBusinessContext` (`lib/business-context.ts`: business type from JSON-LD, primary CTA, service category, marketplace structure). `source_type` enum has 5 values. | `lib/verified-facts.ts:1-108`, `lib/business-context.ts:1-263`, `lib/schemas.ts:96` | `official_external_source` is defined in the enum but has zero other references in `lib/`. Acquisition for `ObservedBusinessContext` reads only the single scraped homepage document. |
| Fact-grounded material generation | `lib/materials.ts` (502 lines) is the LLM-copy assembly + deterministic-safety layer. Confirmed by full read (this pass): `publishableSafeMaterials` strips unverified claims (`stripUnsupportedPublishableClaims`), falls back to `movingFallbackMaterials` when moving-specific commercial facts (insurance/WSIB/pricing/etc.) are absent, and falls back to `neutralGenericMaterials` when the business category is unestablished (`hasUnestablishedCategory`). The neutral meta description explicitly states **"The business category was not established in this audit"** rather than inventing one (`neutralMetaDescription`, line ~314). A dedicated function, `isNeutralGenericMaterials`, exists solely to let callers detect that the safety fallback fired. FAQ answers missing sufficient real content fall back to "Contact `{name}` directly to confirm..." (`safeFaqAnswer`). | `lib/materials.ts:184-401`; tests: `tests/material-category.test.ts:61` and `tests/report-coherence.test.ts:131,142` both assert on the literal string `/category was not established/i` | **Resolved this pass (was "NEEDS VERIFICATION"): generic copy IS still generated when facts are missing, but it is (a) explicitly detectable via `isNeutralGenericMaterials`, and (b) discloses the gap in-copy rather than inventing detail.** This already matches the article's "flag the gap, don't fill with assumption" principle at the safety-net level. What is not yet true: the *positive* case — how often richer facts would let audits skip the neutral fallback and get category-specific, business-specific copy instead — is unmeasured. That is the falsifiable question Spike A answers (see §9). |
| Implementation-brief acceptance criteria | Produced by LLM free text, not `lib/prioritization.ts` (that file is only a 44-line `impact × confidence / effort` priority-score formula, no acceptance-criteria logic). The actual prompt is in `lib/prompts.ts:331,356`: "For each fix give 2-5 concrete steps and 1-3 acceptance criteria phrased as verifiable 'Done when ...' conditions... Return ONLY a JSON object: `{ "briefs": [{ "fix_title", "steps", "acceptance_criteria" }] }`." The schema field is `lib/schemas.ts:249-253` (`acceptance_criteria: z.array(z.string())`, comment: "verifiable 'Done when...' conditions"). | `lib/prompts.ts:331,356`; `lib/schemas.ts:249-253`; separately, `evidence_id` linkage exists for *findings* (`lib/findings.ts:371`, `obsIdForFinding`) but was not found wired into `acceptance_criteria` strings themselves. | **Resolved this pass (was "NEEDS VERIFICATION" and file-misidentified): acceptance criteria today are free-form LLM prose, not mechanically tied to an `evidence_id` or to `VerifiedFact`s.** Richer verified facts would make the LLM's prose more specific (e.g., a real price or location instead of a placeholder condition) purely as richer prompt input — no schema/architecture change is required for that improvement. Making criteria *mechanically* evidence-linked (so a tool, not just a person, could check "Done when") would need a schema addition (an `evidence_ids: string[]` field on the brief type) — a small, additive schema change, not a redesign, and out of scope for a research-only spike. |
| Query planning | Fixed 6-slot plan mapped to a 9-value intent taxonomy by English-only regex (`classifyQueryIntent`) | `lib/geo/query-taxonomy.ts:1-60` | R13 (open): `target_markets_languages` collected but never passed to the query-generation prompt. R16 (open): non-English (Latvian/Russian) queries collapse into "Other." No external keyword/SERP data used anywhere in query planning. |
| Entity/competitor resolution | Deterministic role/state machine: `EntityRole` (6 values), `EntityState = accepted \| channel \| unconfirmed \| rejected`, a 27-entry `KNOWN_CHANNELS` dictionary, generic-token rejection | `lib/geo/entities.ts:1-50` | R19/R19-addendum (open) — duplicate entity rows and non-name fragments (`"Com"` from `com.mt`). **Confirmed still present in the checked-in golden fixture** `tests/fixtures/golden-report-rozie.json` (`competitor_visibility` lists `"name": "Com", "mention_rate": 15.4` alongside real names like `StayCare Group`) — this is a precision/extraction bug, independently reproducible from a fixture already in the repo, not a "don't know if X is real" problem SERP data would fix. |
| Google Maps / local identity | `Google Maps` is a `KNOWN_CHANNELS` entry with `domains: ['google.com']` — any Maps/Google Business citation collapses to `google.com` and the generic "Google Maps" channel label at the role/state-classification layer | `lib/geo/entities.ts:13` | Confirmed generic at the *classification* layer. But (new this pass) **the full citation URL is retained upstream, not just the domain** — `tests/fixtures/golden-report-rozie.json`'s stored `cited_urls` include entries like `https://www.google.com/maps/search/StayCare+Group%2C+Malta` and `https://www.google.com/maps/search/Rozie%2C+Malta`. `lib/geo/sources.ts`'s `topCitedUrls` and the evidence pipeline read `e.cited_urls \|\| e.citations`, i.e., the full URL array, before any domain-collapse happens. So the *raw material* for a specific-identity lookup already exists in stored evidence; only the classification step throws the specificity away. |
| Cited-source intelligence | `lib/geo/sources.ts`: per top-cited-domain page scrape (first-party via Firecrawl, not SERP), deterministic signal taxonomy extracted for source and target, gap computed deterministically | `lib/geo/sources.ts:1-150` | Already does most of what Hypothesis D proposes using first-party evidence; no organic-rank/domain-authority/backlink signal used; no causal claims made. |
| Human review | `admin_notes` exists (internal). R20 (open): human review is otherwise invisible in the delivered report. No dedicated reviewer-correction-of-extracted-facts UI/schema found. | `DEFECTS_BACKLOG.md` R20 | A reviewer-facing fact-confirmation step does not exist; would be additive to the existing review gate, not a new subsystem. |
| Evals / golden corpus | See §8 (fully re-verified this pass; corrects the previous pass's understatement). | `evals/golden/vertex.json`, `tests/fixtures/*`, `tests/fixtures/README.md` | The August plan for five golden reports (az-moving, blvdprod, latvianart, monokelriga, rozie) produced **2 of 5** (`az-moving`, `rozie`); the other three were never added. No human-labeled ground truth exists for entities, queries, or sources anywhere in the repo. |

**Old-document drift:** none of the frontier/horizon documents named in the task brief
(`CURRENT_STATE_2026-08-21.md` etc.) exist in the current repo root; `STATUS.md` and
`DEFECTS_BACKLOG.md` (both current, 2026-09-28) remain the authoritative sources used throughout.

## 3. What the two articles actually contribute

*(Unchanged from Revision 1 — no new evidence this pass affects this section's conclusions.)*

### OpenSEO article (SOURCE A)

- **Article claim, now cross-checked against the coordinator-supplied primary-source facts:**
  OpenSEO wraps DataForSEO exclusively; self-hosting still requires the user's own DataForSEO key;
  the *hosted* OpenSEO product charges **~28% above DataForSEO's own request cost**, plus a $10/mo
  base. This is now a **primary-source-grounded fact** (README + MCP docs, per the coordinator), not
  merely an article claim — see §5.
- **Whether ClearSignal already has it:** the "AI Visibility" feature OpenSEO exposes is
  conceptually the same category as ClearSignal's own core measurement — the strongest argument
  against deeper OpenSEO integration: it would duplicate, at a markup, something ClearSignal already
  builds with tighter trust-layer discipline.
- **Does it change the architecture:** only the narrow pieces retained in §4 (entity corroboration,
  Maps identity) would touch the architecture, and only as optional, cacheable, reviewer-gated
  corroboration — never a replacement measurement engine.

### Company/About workflow article (SOURCE B)

- **Bounded page set** (homepage + about + services + pricing + cases + FAQ + contact): ClearSignal
  does not have this (§2); this is the single most directly actionable idea from either article, and
  it is independently confirmed by R22, not manufactured from the article.
- **Fact table with source/status per claim:** ClearSignal has a narrower version already
  (`VerifiedFact`: `id, claim, source_type, confidence, requires_operator_confirmation,
  allowed_outputs`). It lacks a source URL/page-type field, a supporting excerpt, and an explicit
  "conflicting" status — an extension, not a new subsystem.
- **"Only from agreed facts; missing fact is flagged, never assumed":** ClearSignal already enforces
  a version of this — confirmed and strengthened by this pass's full read of `lib/materials.ts`
  (§2). The article's version is broader (applies to all commercial facts, not just the fixed
  categories `business-context.ts` currently guards); whether broader application changes *how often*
  the fallback fires is exactly what Spike A measures.
- **Human confirms the fact table before generation:** matches `requires_operator_confirmation` on
  `VerifiedFact` in spirit; no dedicated reviewer UI for *correcting extracted facts* exists — the one
  genuinely new process piece the article contributes.

## 4. Hypothesis matrix

| Hypothesis | Current problem still exists? | External/new evidence available? | Incremental value | Complexity | Decision |
|---|---|---|---|---|---|
| A. Competitor corroboration via SERP/domain/keyword data | Partially — R19/R19-addendum are extraction/normalization bugs, reproducible today in a checked-in fixture, not "don't know if it's real" bugs | Yes (DataForSEO Competitors/Domain Overview) | Low-medium; a deterministic dedupe/fragment-rejection fix would close more of R19 than SERP corroboration would, at far lower cost | Medium (new provider, caching, cost/audit, market/location mapping) | DEFER — fix the deterministic bug first; it is fully specified in the backlog and cheaper |
| B. Google Maps/local entity resolution | Yes — confirmed generic `google.com` collapse at classification, but full search-query-bearing URLs are retained upstream (§2, new this pass) | Yes — and now concretely testable: DataForSEO Business Listings/Maps SERP accepts name+location search queries, which is exactly what the stored URL encodes | Medium for local-business audits | Low as a reviewer-only manual test (no new code); medium-high for any future production integration | TEST — Experiment B (§9), manual/reviewer-only, no Codex required |
| C. Query sanity corroboration | Yes, adjacent — R13/R16 are real, deterministic, already-scoped plumbing bugs; external data would not have caught either | Yes (DataForSEO keyword/category data) | Low — R13/R16 fixes are cheaper and more certain to help | Medium | DEFER — fix R13/R16 first |
| D. Cited-source opportunity intelligence | No material gap found — existing deterministic first-party signal-gap engine already avoids causal claims | Yes, but marginal | Low — current design is more defensible than adding authority/backlink scores | Medium | REJECT for now |
| E. Targeted business-fact acquisition (3-8 pages) | Yes — confirmed homepage-only acquisition, R22 open with real-world harm evidence | N/A (first-party) | High — most directly fixes a documented, customer-discovered gap, and is now the lever for reducing how often `lib/materials.ts`'s neutral fallback fires (§2) | Low-medium, and now scoped as a standalone read-only script (§9), not an audit-path change | TEST — Spike A (§9, §14), READY FOR CODEX |
| F. "Company Facts Ledger" | Partially exists already (`VerifiedFact`) | N/A | Medium — extension of an existing type (source URL, page type, excerpt, conflicting status), not a new concept | Low (schema extension, no new subsystem; not touched by the research spike itself) | TEST as part of Spike A's *output design* (research only — the spike outputs a proposed shape, does not change `lib/schemas.ts`) |
| G. Cross-page consistency detection | Directly named in R22 as the missed defect category | N/A (first-party, deterministic comparison once E exists) | High — this is literally what R22's real-world tester found | Low once pages are acquired; meaningless before that | TEST, gated behind Spike A's acquisition step — Spike A's output includes a naive cross-page comparison as its research deliverable |
| H. Fact-grounded material generation | **RESOLVED this pass.** Generic fallback still fires when facts are missing, but it is explicit, detectable (`isNeutralGenericMaterials`), and discloses the gap in-copy rather than inventing detail. What is unmeasured: how often richer facts would avoid the fallback entirely. | N/A (first-party) | High if Spike A shows richer facts meaningfully reduce fallback frequency | Low — no architecture change, `lib/materials.ts`'s fallback logic already the right shape to feed richer facts into | ALREADY SOLVED at the safety layer; TEST the *frequency* question via Spike A |
| I. Conditional canonical company page | No evidence ClearSignal currently recommends this universally or at all | N/A | Speculative — only relevant once E/F/G surface a specific "no page defines this entity" finding | Low (a recommendation template gated on specific evidence) | DEFER — no current trigger condition implemented; downstream of E/F/G |
| J. Fact-grounded acceptance criteria | **RESOLVED this pass.** Acceptance criteria are free-text LLM output (`lib/prompts.ts:331,356`, `lib/schemas.ts:249-253`), not tied to `evidence_id`. Richer facts improve them as prompt input alone; mechanical evidence-linkage would need one additive schema field, not a redesign. | N/A (first-party) | Medium — prompt-input improvement is essentially free once Spike A produces richer facts; the schema addition for mechanical linkage is separate, small, deferred | Low (prompt input) / Low-medium (schema field, deferred) | DEFER the schema change; the prompt-input improvement is a natural side-effect of Spike A and needs no separate decision now |

## 5. External evidence architecture

Now grounded in the coordinator-supplied primary-source facts, with discrepancies noted:

- **OpenSEO (primary-source, per coordinator, treated as verified):** GitHub README confirms
  DataForSEO-only backend; self-hosting requires the user's own DataForSEO key; hosted OpenSEO is
  $10/month and charges **~28% above the underlying DataForSEO request cost**; exposes MCP and Agent
  Skills for Claude Code and Codex. **Discrepancy with Revision 1's WebFetch-derived numbers:** the
  earlier pass's per-call sample costs (~$0.05/keyword, ~$0.08/backlink, ~$1.09/ChatGPT brand check)
  were article-derived and are **not** re-confirmed here as primary-source facts — treat those specific
  numbers as still article-level, not verified, until checked directly against OpenSEO's current
  pricing page.
- **DataForSEO's own MCP server (new fact this pass, primary-source per coordinator):**
  `dataforseo/mcp-server-typescript` exists and is officially maintained by DataForSEO. This is the
  single most decision-relevant new fact: **OpenSEO is not required to get MCP access to DataForSEO
  from Claude Code or Codex.** Using DataForSEO's own MCP (or its plain REST API) removes the 28%
  markup, removes a transformation/wrapper layer between the raw provider response and what the
  reviewer sees, and removes an extra vendor relationship and its own maturity risk (OpenSEO is
  early, v0.1.x per Revision 1's unverified article read — still not independently re-checked here).
- **DataForSEO pricing (primary-source, per coordinator, current as of the 2026-07-01 pay-as-you-go
  update):** Business Listings live search $0.012/task + $0.00036/returned item; Google Business
  Profile / Business Info live $0.0054/profile; Google Maps SERP live $0.002/SERP page. New accounts
  get a **$1 test credit**; minimum subsequent top-up is $50.
- **What the $1 trial credit alone could buy (estimate, for the owner to authorize separately — not
  spent in this review):** at $0.002/SERP page, roughly 500 Maps SERP page lookups; at
  $0.012+$0.00036×items/task for Business Listings, roughly 60-80 lookups depending on result-list
  size; at $0.0054/profile for Business Info, roughly 185 profile lookups. Testing the 8 Maps
  citation URLs found in `golden-report-rozie.json` (§2, §9) against Maps SERP + Business Info would
  cost on the order of **$0.02-0.06 total** — comfortably inside the $1 trial credit, with no top-up
  needed. This is an estimate for the owner's authorization, not an executed or committed spend.
- **Reliability/provenance:** any stored external-evidence field must record DataForSEO (the actual
  provider) as the source, not OpenSEO, regardless of which tool a human reviewer uses to query it —
  this keeps provenance stable if the wrapper choice changes later.

## 6. Verified Company Context architecture

*(Unchanged from Revision 1 in substance; the research-script re-scoping in §9 is the operative
change — this section describes the target *shape*, which the spike does not implement, only
proposes.)*

**Existing structures to build on (do not duplicate):** `VerifiedFact` (`lib/schemas.ts` ~line 96),
`buildVerifiedFactsLayer` (`lib/verified-facts.ts`), `ObservedBusinessContext` +
`inferObservedBusinessContext` (`lib/business-context.ts`, fully deterministic, no LLM), and the
separate `claim_level` enum (`observed/inferred/recommended`) used on report-level claims
(`lib/schemas.ts` ~line 605/740) — a second provenance vocabulary that should eventually be
reconciled with `source_type`, not duplicated further (§7).

**Minimum useful extension (not a new model):** add `source_url`, `source_page_type`,
`supporting_fragment`, and a `conflicting` status to `VerifiedFact` (or a lightweight companion
record). This is schema extension, storable in the existing `report_only` JSON without a migration —
but this review does not make that change; Spike A's output is a proposal for this shape, produced by
a standalone script, not a `lib/schemas.ts` edit.

**Acquisition scope:** bounded to homepage (already scraped) + about + services/products + pricing +
FAQ + contact (+ cases/team/locations if present), capped at 5 additional pages, matching R22's own
suggested cap.

## 7. Combined provenance model

*(Unchanged — see Revision 1's table; §5/§6 of this revision add detail but do not change the
mapping.)* `official_external_source` remains the natural, currently-unpopulated slot for any
DataForSEO-sourced Maps corroboration signal from Experiment B — populate that value if/when a
production decision is ever made, rather than adding a new enum member.

## 8. Existing audit test cases — and the corrected eval/golden reality

**Eval/golden reality (fully re-verified this pass — corrects Revision 1's understatement):**

- **Stored audits (raw generated reports checked into the repo as JSON, usable for research):**
  `evals/golden/vertex.json` (1 file, `vertexspain.com`), plus `tests/fixtures/golden-report-az-moving.json`
  and `tests/fixtures/golden-report-rozie.json` (2 files) = **3 distinct stored audit reports** in the
  repo. `tests/fixtures/golden-report-az-moving.snapshot.json` is a derived snapshot of the az-moving
  report for regression testing, not a fourth independent audit.
- **Golden fixtures per the repo's own convention:** `tests/fixtures/README.md` names an intended set
  of five (`az-moving`, `blvdprod`, `latvianart`, `monokelriga`, `rozie`); **only 2 of 5 exist**
  (`az-moving`, `rozie`). The August plan was **not completed**. `blvdprod`, `latvianart`, and
  `monokelriga` are absent.
- **Additional small fixtures:** `tests/fixtures/plain-report/{golden.json, marketplace.json,
  service-business.json}` and `tests/fixtures/provider-responses/*.json` (6 files, raw
  Claude/OpenAI/Perplexity API response shapes for provider-integration tests) — these are
  mechanical/API-shape fixtures, not audit content fixtures.
- **Human-approved labels:** **none exist.** No file in `evals/`, `tests/fixtures/`, or `validation/`
  contains a field marking a competitor/entity/source as human-confirmed-correct or
  human-confirmed-wrong. `evals/golden/vertex.json`'s `"expected_combinations": 18` is a coverage
  count, not an entity/query/source correctness label.
- **Entity labels:** 0. **Query labels:** 0. **Source/citation labels:** 0.
- **`validation/`:** confirmed to contain only sales/outreach process documents
  (`interview-agency.md`, `outreach.md`, `PLAN.md`, `segment-findings.md`, `tracking.csv`,
  `pilot01/COPY.md`, `pilot01/FEEDBACK_EMAILS.md`, `pilot01/REPLY_PLAYBOOK.md`) — no audit data, no
  labels.
- **Sufficiency for the experiments:** the 3 stored audits are sufficient as **input data** for
  Spike A (bounded acquisition, cross-page comparison) and for the Maps-URL corroboration test in
  Experiment B, since both only need real stored evidence to run against, not ground-truth labels.
  Neither experiment can produce a statistically defensible precision number (e.g., "entity precision
  improved from X% to Y%") because there is no labeled ground truth to score against — this is why
  §10 uses indicative/pilot-level criteria, not population-level precision claims, and why Task 3's
  labels below are explicitly proposed, not authoritative.

**Test cases, corrected against what evidence actually exists:**

1. **`golden-report-rozie.json`** — Malta cleaning service, local business. Tests Hypothesis B
   directly: 8 distinct Maps search-URL citations with real business names are already stored
   (`StayCare Group, Malta`; `Tidy Malta, Malta`; `Maids In Malta, Malta`; etc. — §2, §9). Also
   contains the reproducible `"Com"` non-name fragment (R19-addendum) for Hypothesis A's
   deterministic-fix-first argument.
2. **`golden-report-az-moving.json`** — required baseline fixture, US moving company. Tests
   Hypothesis A/channel-vs-competitor distinction directly: `cited_domains_ranked` mixes clear
   channels (`reddit.com`, `yelp.com`, `thumbtack.com`, `facebook.com`) with clear competitor domains
   (`unitedvanlines.com`, `nationalvanlines.com`, `blacktiemoving.com`, `twomenandatruck.com`), and
   `competitor_visibility` lists named entities (`CARGO CABBIE`, `Rent-a-Son`, `My Ninja Movers`,
   `Six Moving`, `Tower Moving Company`, `SafeNestMovers`). Good fixture for Spike A's cross-page
   consistency work too, since it is the one both required and richest fixture.
3. **`evals/golden/vertex.json`** (`vertexspain.com`) — real-estate/B2B-adjacent Spain listing site
   with rich narrative gap findings (schema markup, FAQ, about-page factual anchors already called
   out by the LLM as missing — e.g. "founding year, team size, languages spoken"). Directly usable as
   a before/after fixture for Hypothesis H/E: it already names the specific facts a richer about-page
   crawl would need to supply.
4. No fourth or fifth local/B2B-SaaS stored audit with sufficient richness was found beyond these
   three; `STATUS.md` narratively describes other audits (`jusukosmetologs.lv`, `snoika.com`,
   `getclearsignal.io`, Alahli) but **no corresponding JSON fixture for them is checked into the
   repo** — those can only be used if pulled fresh from Supabase (a live-data action outside this
   research-only pass), not from files present in the working tree today.

### Proposed label set (research data only — AI-proposed, pending human confirmation, NOT ground truth)

Built strictly from evidence in the three stored fixtures above and from `DEFECTS_BACKLOG.md`'s own
text where no fixture JSON was available. Placed directly in this review rather than as a new
`evals/` file, since no existing repo convention for hand/AI-labeled ground truth was found (only the
golden-*report* convention in `tests/fixtures/README.md`, which is a different artifact type) —
inventing a new `evals/` convention unilaterally seemed riskier than keeping this data visibly
provisional inside the review that produced it.

| # | Audit / fixture | Target evidence | Proposed label | Rationale | Certainty | Provenance |
|---|---|---|---|---|---|---|
| L1 | `golden-report-rozie.json` | `competitor_visibility` entry `"Com"`, 15.4% | Not a company — reject as extraction noise | Matches `DEFECTS_BACKLOG.md` R19-addendum exactly: `com.mt` is the actual cleaning-directory domain cited nearby; "Com" is almost certainly a fragment of that domain, not a brand | Clear | Stored fixture + open backlog defect text |
| L2 | `golden-report-rozie.json` | `cited_domains_ranked`: `yelp.com`, `com.mt` (directory-style) | Channel/directory, not competitor | Yelp is a `KNOWN_CHANNELS` dictionary entry (`lib/geo/entities.ts:13`); `com.mt` reads as a Malta business-directory TLD pattern, not a single operating business | Clear (yelp.com) / Ambiguous (`com.mt` — directory vs. aggregator distinction not independently confirmed) | Stored fixture + code |
| L3 | `golden-report-rozie.json` | Maps citation `https://www.google.com/maps/search/StayCare+Group%2C+Malta` | Likely resolvable to a specific Maps business listing for "StayCare Group" in Malta | The URL already encodes a clean name+location search query suitable for a DataForSEO Maps SERP lookup | Ambiguous (not verified against DataForSEO in this pass — no paid call made) | Stored fixture only; resolution unconfirmed |
| L4 | `golden-report-rozie.json` | Maps citation `https://www.google.com/maps/search/Rozie%2C+Malta` | This is the audited business's own brand, not a competitor | "Rozie" is the audit target per `STATUS.md`'s Rozie verification entries | Clear | Stored fixture + STATUS.md cross-reference |
| L5 | `golden-report-az-moving.json` | `cited_domains_ranked`: `thumbtack.com`, `facebook.com` | Channel/marketplace, not competitor | Both are `KNOWN_CHANNELS` dictionary entries (marketplace/social kinds) | Clear | Stored fixture + code |
| L6 | `golden-report-az-moving.json` | `cited_domains_ranked`: `unitedvanlines.com`, `nationalvanlines.com` | Likely genuine national-moving-company competitors | Domain names directly match well-known US moving-company brands; not in `KNOWN_CHANNELS` | Clear (public-knowledge brand match; not independently verified against a business registry in this pass) | Stored fixture; public-knowledge inference, not primary-source-verified |
| L7 | `golden-report-az-moving.json` | `competitor_visibility`: `"CARGO CABBIE"`, `"Rent-a-Son"` | Plausible small/regional mover brands, not obviously noise | Both are multi-word, non-generic, non-TLD-fragment names, unlike the `"Com"` case in L1 | Ambiguous — no independent confirmation these are real, currently operating businesses | Stored fixture only |
| L8 | `evals/golden/vertex.json` | `gap.ai_search.missing_signals` calling out "no FAQ," "no schema markup cues," "no founding year/team size/languages" | Confirms the about-page-fact gap the article-derived idea targets | The report's own LLM-authored gap analysis already names exactly the fact categories a bounded about-page crawl (Spike A) would try to fill | Clear (as a gap description); the *fix* is untested | Stored fixture |

## 9. Smallest useful experiments

**Spike A — Verified Company Context, reduced to a standalone research script (re-scoped this pass).**

- **No audit-path change.** `lib/firecrawl.ts`'s exported functions (`scrapeUrl`, `scrapePage`) and
  `lib/business-context.ts`'s exported functions (`inferObservedBusinessContext` and its helpers) are
  confirmed pure/side-effect-free beyond the Firecrawl HTTP call itself — `firecrawl.ts` only imports
  the `@mendable/firecrawl-js` SDK and reads `process.env.FIRECRAWL_API_KEY`; `business-context.ts`
  only imports `zod`-typed shapes from `./schemas`. Neither imports Next.js, Supabase, Trigger, or any
  audit-orchestration code. They can be imported directly into a standalone script.
- **Feasibility of running it:** the repo has no `tsx`/`ts-node` devDependency and `scripts/` today
  only contains a plain `.mjs` file (`codex-usage.mjs`, run via `npm run codex-usage`). A new
  TypeScript research script can be run with **`npx tsx scripts/research/spike-a-bounded-crawl.ts`**
  without adding anything to `package.json` (npx fetches `tsx` ad hoc) — keeping the change footprint
  to exactly one new file under a new `scripts/research/` path.
- **Shape:** input URL list (fixed to the 3 stored-audit target domains in §8, plus optionally
  `getclearsignal.io` as a 4th, owner-controlled ground-truth site) → fetch homepage (reuse
  `scrapePage`) → deterministically discover up to 5 same-origin internal links matching
  about/services/pricing/FAQ/contact/cases path or anchor-text patterns → fetch each (reuse
  `scrapePage`) → run `inferObservedBusinessContext`-equivalent extraction per page → assemble a
  proposed richer-fact JSON (the `source_url`/`source_page_type`/`supporting_fragment`/`conflicting`
  shape from §6, as *data*, not a schema change) → run a naive deterministic cross-page comparator
  (same name/address/phone/price/category field, different value across two pages → flag) → print a
  homepage-only-vs-multi-page diff.
- **Cost:** Firecrawl calls only (same provider already in production use), capped at 6
  pages/domain × 4 domains = 24 scrapes, well inside normal per-audit Firecrawl usage.

**Experiment B — Google Maps identity resolution (re-scoped this pass: DataForSEO direct, not
OpenSEO; reviewer-only, likely no Codex needed).**

- **Tooling decision (Task 4 analysis, §11 detail):** use DataForSEO's own MCP server or plain REST
  directly. OpenSEO adds a ~28% markup and a transformation layer for zero additional capability once
  DataForSEO's own MCP exists — OpenSEO is not needed for this experiment.
- **Input:** the 8 real, already-stored Maps citation URLs in `golden-report-rozie.json` (§2, §8,
  L3/L4). Each already decodes cleanly to a `<business name>, <location>` string
  (`https://www.google.com/maps/search/StayCare+Group%2C+Malta` → `StayCare Group, Malta`).
- **Procedure:** a human reviewer (or a Codex session operating only as a manual research assistant,
  not touching the audit path) queries DataForSEO Business Listings/Maps SERP/Business Info for each
  decoded name+location string and records whether a specific, resolvable listing (name, category,
  place identity) comes back, and whether it's unambiguous.
- **Cost, per §5:** at published per-call pricing, testing all 8 URLs against Maps SERP + Business
  Info costs on the order of **$0.02-0.06 total**, inside the $1 free trial credit — **no top-up
  required** if the owner authorizes creating a DataForSEO account and spending the trial credit. No
  such account or spend was made in producing this review.

## 10. Success criteria (reset this pass into tiers, per Task 7)

**Spike A**
- *Hard safety condition:* no page-level fact is silently merged or auto-resolved when two pages
  disagree — every detected conflict is retained and printed, never picked-and-discarded.
- *Research success criterion (pilot threshold, HYPOTHESIS):* the bounded multi-page acquisition
  surfaces at least one materially new, correctly-extracted fact (beyond what homepage-only extraction
  already produces) on at least 2 of the 3-4 test domains. "Materially new" = a fact category
  (location, service, price, category) present on a non-homepage page and absent from the homepage's
  own extraction.
- *Indicative observation (not a pass/fail gate):* whether `lib/materials.ts`'s neutral/moving
  fallback would plausibly have been avoided on a given fixture if these new facts had been available
  as `VerifiedFact`s — assessed by manual inspection of the diff, not automated, since no ground truth
  exists to score it against (§8).
- *Explicitly dropped from Revision 1:* the previous "comparator false-positive rate must be zero"
  population claim — with N=3-4 domains, zero-false-positive is not a meaningful population statistic;
  the hard-safety condition above (no silent auto-resolution) is what actually matters at this stage.

**Experiment B**
- *Hard safety condition:* an ambiguous or common-name listing is never presented as a confirmed
  identity — every result is labeled resolved/ambiguous/not-found, and "ambiguous" is the default
  when more than one plausible listing is returned.
- *Research success criterion (pilot threshold, HYPOTHESIS):* a specific, correct listing identity
  (name + category, at minimum, cross-checked by the human reviewer against what's independently
  knowable about the business) is recovered for a meaningful fraction of the 8 test URLs — no
  specific percentage is asserted here as a pass bar; the deliverable is the raw hit/ambiguous/miss
  table itself, which the owner and reviewer can judge.
- *Indicative observation:* whether the recovered identity is more specific than what URL text alone
  already gives (which, per §2/§9, is already "business name + location" — so the bar for DataForSEO
  to add value is recovering category/rating-context/place-uniqueness beyond the name string itself,
  not merely re-confirming the name).

## 11. Production architecture if experiments succeed

- **OpenSEO as a production dependency (Strategy A):** reject, unchanged from Revision 1, now on
  firmer footing — DataForSEO's own MCP (§5) removes the one reason (MCP access) OpenSEO might have
  been convenient for, leaving only the 28% markup and an extra wrapper-maturity risk.
- **DataForSEO's own MCP, reviewer/research only (Strategy B, revised from "OpenSEO MCP"):** this is
  the correct vehicle for Experiment B — zero audit-engine risk, official provenance, no markup.
- **Direct DataForSEO REST integration (Strategy C):** the only strategy worth considering for
  eventual production use, and only for Maps-identity corroboration specifically, called conditionally
  (only audits with Maps citations present), with a hard fail-open to "unknown, reviewer required."
- **Own targeted crawling / reuse existing Firecrawl (Strategy D, for Verified Company Context):**
  confirmed feasible and now the concrete recommendation for Spike A — no new provider, reuses
  `lib/firecrawl.ts` exactly as it already works for the homepage.
- **No implementation (Strategy E):** remains correct for Hypotheses A, C, D, I (§4) — cheaper,
  already-backlogged deterministic fixes (R13, R16, R19, R19-addendum) address the same
  customer-visible symptoms more directly than any external data source would.

## 12. Explicitly rejected scope

*(Unchanged from Revision 1 — no new evidence this pass affects these conclusions.)* Generic
keyword/backlink dashboard; rank tracker; SEO/technical-site monitoring; customer GSC/GA dashboard;
generic keyword research UI; full-site crawler; content factory / generic About Page Generator;
universal "every business needs a better About page"; external domain-authority score presented as
truth; a new arbitrary 0-100 score; duplicating OpenSEO's own AI-visibility feature; adding AI
engines just because OpenSEO exposes them; generic link-building advice; causal
backlink→AI-citation claims.

## 13. Risks

*(Carried forward from Revision 1, updated where this pass changes the picture.)*

- **Scope creep / SEO-suite drift:** mitigated by Spike A's read-only-script scoping and Experiment
  B's reviewer-only, DataForSEO-direct scoping (§9, §11) — neither touches the audit path.
- **Duplicated provenance models:** the `source_type`/`claim_level` dual-vocabulary issue (§7) remains
  real and unaddressed; flagged, not fixed, by this review.
- **Extra provider dependency:** now more precisely scoped — DataForSEO direct, not OpenSEO, and only
  if Experiment B's manual test shows real value; must fail open per §10/§11.
- **Cost:** now quantified (§5) — Experiment B is estimated at $0.02-0.06 against a $1 free trial
  credit; Spike A has zero new provider cost (reuses existing Firecrawl usage patterns).
- **Latency:** Spike A adds wall-clock time only to its own standalone script run, not to the
  production audit pipeline, since it is not wired into `lib/audit-runner.ts` or any Trigger task.
- **Stale external evidence / false competitor confirmation / wrong Maps identity:** addressed by
  §10's hard-safety conditions (no silent auto-resolution; ambiguous is the default, never confirmed).
- **LLM extraction errors:** Spike A reuses the existing deterministic (non-LLM) extraction in
  `inferObservedBusinessContext`; no new LLM extraction risk is introduced by the spike itself.
- **Business-fact conflicts:** Spike A's hard-safety condition (§10) requires conflicts to be
  retained and surfaced, not resolved.
- **Reviewer complexity:** unchanged risk — a fact-confirmation UI remains out of scope for both
  research-only experiments; deferred until customer evidence justifies building it.
- **Eval debt:** materially worse than Revision 1 suggested — only 2 of the planned 5 golden fixtures
  exist, and zero human-labeled ground truth exists anywhere (§8). Every precision-style claim in this
  document is either explicitly marked HYPOTHESIS/pilot-threshold or replaced with a
  hit/ambiguous/miss table design that does not require ground truth to be informative (§10).
- **Privacy/data:** unchanged — no personal data implicated; DataForSEO calls in Experiment B would
  pass business names/locations already present in ClearSignal's own stored, already-generated
  reports, not new customer PII.

## 14. Decision gate

# READY FOR CODEX RESEARCH SPIKE (Spike A only) — Experiment B is REJECT FOR CODEX / OWNER-GATED MANUAL TEST

Two tracks, decided separately per the coordinator's framing:

### Track A — Verified Company Context bounded-acquisition research spike: READY FOR CODEX

- **Research question:** does fetching a small, deterministically-selected set of additional
  first-party pages (about/services/pricing/FAQ/contact, capped at 5) surface materially new,
  correctly-extracted business facts beyond what today's homepage-only scrape captures, and would
  those facts plausibly let `lib/materials.ts`'s neutral-fallback path fire less often?
- **Files the spike may add:** exactly one new script tree, e.g. `scripts/research/spike-a-bounded-crawl.ts`
  and a `scripts/research/README.md` explaining how to run it; output written to a local, gitignored
  or explicitly-temporary JSON file (e.g. `scripts/research/output/*.json`), not to any production
  table or fixture path.
- **Existing modules it may import (read-only use):** `lib/firecrawl.ts` (`scrapePage`/`scrapeUrl`),
  `lib/business-context.ts` (`inferObservedBusinessContext` and its exported helpers),
  `lib/verified-facts.ts` (`buildVerifiedFactsLayer`, for shape reference only, read-only).
- **Files it must NOT modify:** anything under `app/`, `trigger/`, `lib/audit-runner.ts`,
  `lib/audit-queue.ts`, `lib/schemas.ts`, `lib/materials.ts`, `lib/business-context.ts`,
  `lib/firecrawl.ts`, any `supabase/` migration, any prompt file, `next.config.js`, `trigger.config.ts`,
  or any deploy configuration. No `npm run build`, no Trigger deploy, no Supabase write.
- **Fixed test domains:** the 3 domains already backing stored fixtures in the repo —
  `az-moving` (from `tests/fixtures/golden-report-az-moving.json`), the Rozie domain (from
  `tests/fixtures/golden-report-rozie.json`), and `vertexspain.com` (from `evals/golden/vertex.json`)
  — plus, only if the owner separately approves, `getclearsignal.io` as a 4th, owner-controlled
  ground-truth domain. Do not scrape any other live domain.
- **Inputs:** the fixed domain list above; no other input required.
- **Outputs:** a JSON diff report per domain: homepage-only facts vs. multi-page facts, any detected
  cross-page conflicts, and a plain-language note on which `lib/materials.ts` fallback path each
  fact set would plausibly have hit (manual/documented judgment, not code that touches
  `materials.ts`).
- **Test/eval method:** manual review by the coordinator/owner against §8's proposed labels and the
  hard-safety/research-criterion/indicative-observation tiers in §10 — no automated pass/fail script
  is required for a research spike.
- **API/crawl cost cap:** ≤ 6 pages per domain × 4 domains = 24 Firecrawl scrapes total, using the
  existing `FIRECRAWL_API_KEY` already configured for the project (no new provider account).
- **Success criteria / failure criteria:** as stated in §10 under "Spike A."
- **Cleanup/rollback:** the spike's output directory and script are disposable; if the findings do
  not justify further work, delete `scripts/research/` entirely — nothing else in the repo is touched.
- **NO PRODUCTION DEPLOY.** This is a research-spike spec for a separate Codex session, not an
  implementation task, and produces no change to any file Codex is listed above as forbidden to touch.

### Track B — Google Maps identity resolution: REJECT FOR CODEX AS A PRODUCTION FEATURE; DEFER TO AN
OWNER-AUTHORIZED MANUAL EXPERIMENT, NOT A CODEX SPIKE

- This track does not need Codex. It needs: (1) the owner's explicit authorization to create a
  DataForSEO account and spend the ~$0.02-0.06 estimated in §5/§9 from the free $1 trial credit (no
  top-up needed), and (2) a human (or a Claude Code session acting purely as a manual research
  assistant with a DataForSEO MCP/REST credential attached locally, never committed to the repo,
  never wired into the audit path) to run the 8 lookups in §9's Experiment B and fill in §8's L3/L4
  rows and the rest of the table with actual results.
- This is deliberately **not** specced as a Codex research-spike file-change task, because it
  requires no code, no script, and no repo change to execute — only manual queries and a results
  table, which is why it is separated from Track A rather than folded into "READY FOR CODEX."
- Remains gated on the owner's spend authorization per the standing purchase-confirmation rule; this
  review does not authorize or perform that spend.

### What remains explicitly deferred until paying-customer evidence

Hypotheses A, C, D, I (§4) — competitor SERP corroboration, query-sanity corroboration, external
source-authority scoring, and a canonical-company-page recommendation template — all stay deferred.
None of them has a customer-visible failure mode today that isn't already better addressed by a
cheaper, already-scoped, already-backlogged deterministic fix (R13, R16, R19, R19-addendum). Revisit
only if paying-customer feedback specifically surfaces a gap none of those fixes closes.
