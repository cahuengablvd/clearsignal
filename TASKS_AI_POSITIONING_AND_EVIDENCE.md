# AI positioning and evidence - decision memo

**Status:** Codex code/architecture review complete. No product code has been changed. Claude must
review the product/trust decisions in this memo before implementation starts.

**Input status:** The podcast-derived ideas are treated as practitioner hypotheses, not causal facts.
The supplied product proposal is the product/trust position being challenged here; this memo does not
pretend that a separate Claude review has already happened.

## 1. Executive decision

The strategic direction is right, but it does not justify a new product or report architecture.
ClearSignal already measures most of the useful foundation:

- buyer-intent questions across ChatGPT/OpenAI, Claude and Perplexity in the paid audit;
- deterministic brand mention, brand citation, first-mention position and share of voice;
- deterministic query-intent grouping;
- competitors extracted from the tested answers;
- the pages actually cited by those answers, with target-vs-source signal comparison;
- technical eligibility, website clarity, proof and implementation recommendations;
- evidence IDs, claim levels, confidence, a sanitizer, a validator and human review.

The most important immediate work is therefore **truthful naming and evidence linkage**, not a new
"Brand Evidence Footprint" section.

Decision on category language:

1. Keep the canonical product label **Expert-reviewed AI Visibility Audit** for MVP.
2. Keep the hero question: **"When buyers ask AI who to choose, does it recommend you, or your
   competitor?"** It is clear buyer language and a question, not a measurement claim.
3. Use **AI recommendation visibility diagnostic** as explanatory language, not as the formal product
   name yet.
4. Do not rename to **AI Recommendation Visibility Audit** until the engine can distinguish a
   recommendation from a neutral mention.
5. Do not rename to **AI Visibility & Brand Evidence Audit** until ClearSignal investigates public
   corroboration beyond the pages cited in the tested answers.

This preserves the established `AI visibility` category/search language while making the commercial
story recommendation-led.

## 2. Current-state findings

### 2.1 Queries and buyer intent

- Paid audits request 6 generated buyer questions by default (`lib/audit-runner.ts`), or use up to 8
  operator-confirmed questions.
- `GEO_QUERIES_SYSTEM` excludes the brand name and asks for comparison, problem-first and
  alternatives/vs questions (`lib/prompts.ts`).
- The engine classifies every saved question deterministically into category discovery, comparison,
  alternatives, problem, local, trust, pricing, use case or other (`lib/geo/query-taxonomy.ts`).
- The paid web report already renders **Visibility by buyer intent** (`app/audit/[id]/page.tsx`).
- The taxonomy is post-hoc: generation does not guarantee coverage of the most important intent
  classes for each business.

### 2.2 Engine evidence and competitor detection

- Every successful engine/query pair stores the query, answer excerpt, citations, brand mention,
  brand citation, first-mention position, competitors mentioned and cited domains (`lib/schemas.ts`).
- Brand and competitor status is deterministic string/domain matching, not an LLM judgment
  (`lib/geo/detect.ts`, `lib/geo/index.ts`).
- Candidate competitors are the submitted competitor URLs plus names extracted from the actual
  answers. Their visibility metric is a **mention rate**.
- There is no recommendation classifier. The pipeline cannot currently distinguish "listed in the
  market" from "recommended for this use case."

### 2.3 Citations, website evidence and third-party evidence

- Paid audits scrape the target homepage, submitted competitor homepages and up to 6 non-brand pages
  actually cited in the tested answers (`lib/audit-runner.ts`, `lib/geo/sources.ts`).
- Cited-source analysis compares a fixed signal set: comparison page, FAQ structure, category
  language, competitors named, proof, ICP language, pricing/use cases and third-party authority.
- Technical findings and access eligibility are deterministic. Clarity and competitive messaging are
  LLM analyses bounded by the trust prompts.
- `verified_facts_layer` currently contains operator-verified facts and facts observed on the target
  site. Its schema permits official external sources, but the current builder does not populate a
  general third-party corroboration layer (`lib/verified-facts.ts`).
- ClearSignal does **not** search the wider web for every important business claim. Current external
  evidence is limited mainly to sources surfaced by the tested AI answers.

### 2.4 Recommendations

- GEO recommendations are generated from measured GEO evidence and then assigned stages: ACCESS,
  RETRIEVAL, CITATION, ENTITY, AUTHORITY, PROMINENCE or MEASUREMENT.
- The main action plan is generated from clarity + homepage competitor analysis **before** `geoPromise`
  is awaited. The action prompt does not receive GEO evidence (`lib/audit-runner.ts`).
- `attachActionConfidence` later attaches the first three GEO evidence IDs to any generic
  `ai_search` fix. Those IDs are real, but their semantic relevance to that fix is not proven
  (`lib/action-confidence.ts`).
- This is the main missing connection between the product story (AI evidence) and the final action
  plan.

### 2.5 Scoring

`ai_visibility_score` is deterministic:

| Signal | Weight |
| --- | ---: |
| Mention rate | 40% |
| Citation rate | 25% |
| First-mention position | 20% |
| Share of voice | 15% |

The score is reproducible and printed in the report. It is not a recommendation score, a universal
ranking, or a causal model. No weight should change in this batch.

### 2.6 Trust layer

- `lib/sanitize.ts` bounds absolute visibility claims and removes unsupported results.
- `lib/report-validator.ts` rebuilds GEO counts, query taxonomy and summary; validates evidence IDs;
  softens several causal phrases; validates schema deliverables; and can block export.
- Human review remains mandatory.
- The current deterministic summary still appends unmeasured causal boilerplate about "limited
  owned-page answer density" and "stronger third-party source visibility" whenever a brand domain is
  present (`buildGeoSummary` in `lib/geo/index.ts`). Because the validator rebuilds the summary with
  the same function, this claim survives the trust layer.

## 3. What already exists vs what is actually missing

### 3.1 Podcast-derived hypotheses and disposition

1. **Recommendation visibility matters more than citation visibility:** strong positioning hypothesis,
   but the current engine measures mentions and citations. Lead with the buyer question; do not rename
   a mention metric.
2. **AI visibility is not only on-site:** supported by the current cited-source evidence, but current
   scope is not a general web-wide investigation.
3. **Independent corroboration may matter:** plausible and useful as a P2 research/mechanic hypothesis;
   not proven and not currently measured claim by claim.
4. **Competitor delta should be evidence-oriented:** partly implemented through competitor mentions,
   cited domains and source-gap analysis. The missing piece is safe evidence-to-action linkage.
5. **ClearSignal should not look like an SEO scanner:** supported. Position it as a complementary
   recommendation-visibility diagnostic while keeping the established AI visibility category label.

| Proposal | Current reality | Decision |
| --- | --- | --- |
| Buyer-intent queries | Exists; 6 default, up to 8 confirmed | Improve coverage, do not rebuild |
| Query intent classes | Exists and is rendered | Keep; make generation align with it |
| Competitor delta | Mention delta exists | Rename measured outputs honestly; deepen action linkage |
| Third-party evidence | AI-cited pages are scraped and compared | Position as cited-source evidence, not web-wide corroboration |
| Brand evidence footprint | No claim-level corroboration ledger | P2; no new report section now |
| Recommendation vs mention | Mention/citation only | P2 mechanic; P0 wording correction now |
| Recommendation classes | Seven stage classes already exist | Re-label for buyers/agencies; do not add another taxonomy |
| Trustworthy recommendations | Guards and evidence IDs exist | Fix false/generic evidence linkage |
| Human review | Exists and is mandatory | Preserve |
| Agency diagnostic | Product supports it; copy is weak | P1 copy only |

## 4. P0 - truth and correctness

Implement only after Claude signs off.

### P0.1 Make public labels match measured facts

**Problem:** several pages use "recommends" where the data is only a mention, imply causation, or
describe functionality that is not present.

Changes:

- `app/audit/[id]/page.tsx`
  - `Who AI recommends instead` -> `Competitors mentioned in the tested answers`.
  - `Why these sources get cited (and you don't)` -> `What the cited sources contained compared with
    your site`.
  - Replace the causal description with: `These pages appeared as citations in the tested answers.
    The comparison below shows observed page characteristics; it does not prove why an engine cited
    them.`
  - `AI Visibility (GEO / AEO)` -> `AI visibility in the tested answers`; keep GEO/AEO terminology in
    explanatory/FAQ copy, not the primary report heading.
- `app/score/[id]/page.tsx`
  - Keep `Competitors AI mentioned`; do not call this recommendation visibility.
  - `Potential citation factors` -> `Observed characteristics of cited sources` when source data is
    present.
  - `10 prioritized fixes` -> `prioritized fixes` (the schema permits 5-10).
- `app/page.tsx`
  - Remove `because`, `why competitors are chosen`, `why competitors appear` and equivalent causal
    claims from preview/demo copy.
  - Do not advertise 14/16/18 buyer questions when production defaults to 6. Use `6 buyer questions x
    3 engines` for a full-audit example or label the numbers explicitly illustrative.
  - `PDF report + web dashboard` -> `Web report + PDF`; this is a one-time report, not a dashboard.
  - Remove the non-functional `Weekly monitoring is coming soon` waitlist claim. Monitoring is outside
    frozen MVP scope.
  - Remove the claim that white-label and multi-client workflows are being tested.
- `app/score/page.tsx`
  - The free score currently runs 4 questions against Claude only, without web search. Replace `See
    whether ChatGPT, Claude and Perplexity...` with accurate one-engine snapshot copy.
- `app/checkout/page.tsx`, `app/sample/page.tsx`, `app/layout.tsx`
  - Use `web report`, `mentioned`, `cited-source evidence` and observational headings consistently.

### P0.2 Remove unmeasured causality from the deterministic GEO summary

**Files:** `lib/geo/index.ts`, `lib/report-validator.ts`, `tests/golden-report.test.ts`,
`tests/trust-layer.test.ts`.

- Remove `domainClause` from `buildGeoSummary`. It asserts factors that are not inputs to the
  function.
- The summary must contain only successful combinations, engines, mention/citation rates, score and
  evidence-reuse disclosure.
- Keep possible contributing factors in a separately labelled evidence comparison, never in the
  deterministic measurement sentence.

### P0.3 Stop treating "third-party authority" as something missing from the brand's own page

**Files:** `lib/geo/sources.ts`, `lib/prompts.ts`, `app/audit/[id]/page.tsx`,
`app/sample/page.tsx`, targeted tests in `tests/geo-measurement-v2.test.ts`.

- A first-party site cannot itself be an independent third party. Exclude `third_party_authority`
  from `target_missing_signals`.
- Render source independence as context (`Independent/editorial source`), not as a defect the target
  page should "match".
- Change the prompt from explaining why a source gets cited to describing observed characteristics
  that may be relevant.
- Preserve validate-first language for directories, reviews, communities and roundups.

### P0.4 Remove arbitrary GEO evidence linkage

**Files:** `lib/action-confidence.ts`, `lib/report-validator.ts`, `tests/trust-layer.test.ts`.

- Do not attach the first three GEO evidence IDs merely because a fix category is `ai_search`.
- Until P1.3 supplies explicit evidence selection, use the existing synthesis fallback:
  `Based on audit synthesis; no single direct evidence item.`
- Validator must continue rejecting nonexistent IDs and should not imply semantic linkage from ID
  existence alone.

## 5. P1 - contained MVP improvements

### P1.1 Recommendation-led positioning without a rename

**Files:** `app/page.tsx`, `app/layout.tsx`, `app/checkout/page.tsx`,
`app/score/[id]/page.tsx`, `lib/audit-label.ts` (label remains unchanged).

- Keep the current hero.
- Make the subheadline explain the chain: tested buyer questions -> competitors that appear -> cited
  source/page differences -> expert-reviewed priorities.
- Add a complementary SEO FAQ answer; do not attack SEO.
- Agency copy should say: ClearSignal diagnoses the visibility/evidence problem; the agency owns the
  implementation. Do not mention dashboards, accounts, white-label or reseller infrastructure.
- Keep `AI visibility` in title/meta/category language for clarity and search intent. Use
  `recommendation visibility` in descriptive prose.

### P1.2 Align generated questions with the existing intent taxonomy

**Files:** `lib/prompts.ts`, `lib/geo/index.ts`, `lib/geo/query-taxonomy.ts`,
`tests/geo-measurement-v2.test.ts`.

For the default 6-question paid set, request:

1. category/discovery;
2. problem/need;
3. comparison or alternatives;
4. ICP/use case;
5. trust or pricing, whichever fits the business;
6. local if geography is material, otherwise a second decision/use-case question.

Do not add a second LLM call or silently regenerate operator-confirmed questions. The report must say
visibility is dependent on this query set.

### P1.3 Feed compact GEO evidence into the action plan

**Files:** `lib/audit-runner.ts`, `lib/prompts.ts`, `lib/schemas.ts`,
`lib/action-confidence.ts`, `lib/report-validator.ts`, `tests/audit-execution.test.ts`,
`tests/trust-layer.test.ts`.

- Await `geoPromise` before the action stage, after clarity/gap work has run in parallel with GEO.
- Give `ACTION_SYSTEM` a compact evidence catalog only: query-intent coverage, top competitors with
  measured mention counts/rates, cited domains, source-gap observations, and stable evidence IDs.
  Do not resend full raw answers.
- Permit a fix to select only IDs present in that catalog. Drop invalid or irrelevant IDs.
- Require each AI-visibility fix to separate:
  - **Observed:** measured answer/source/page fact;
  - **Inferred:** possible relevance, explicitly non-causal;
  - **Recommended:** controlled next action and a lower-control alternative when applicable.
- Keep the human review gate and existing sanitizer/validator.

### P1.4 Translate internal recommendation stages for clients/agencies

**Files:** `lib/geo/recommendation-stages.ts`, `app/audit/[id]/page.tsx`, targeted rendering tests.

Keep stored enum values for compatibility; display friendlier labels:

| Stored stage | Client label |
| --- | --- |
| ACCESS | Technical access |
| RETRIEVAL | First-party clarity/content |
| CITATION | Cited-source opportunity |
| ENTITY | Business facts/entity |
| AUTHORITY | Proof/third-party evidence |
| PROMINENCE | Messaging/comparison presence |
| MEASUREMENT | Re-test the same query set |

## 6. P2 - document only, post-MVP

### P2.1 Recommendation vs mention classification

Add an optional, conservative semantic classification only after real client examples establish what
counts as a recommendation. It must not change the score initially. Required classes should be closer
to `mentioned`, `presented_as_option`, `explicitly_recommended`, `cited_only`, `not_present`, with
confidence and the exact supporting sentence. Human review is required.

Reason for deferral: multilingual/model-specific prose makes regex classification unreliable, while
an LLM classifier adds cost and nondeterminism.

### P2.2 Claim-level public corroboration / Brand Evidence Footprint

Potential future data model:

- claim;
- first-party evidence URL;
- independent evidence URLs;
- source types and dates;
- conflict/consistency status;
- whether the claim appeared in the tested AI answers;
- explicit audit search scope.

This requires new discovery, deduplication, claim matching and source-quality rules. Do not present
`No evidence found` without `within the reviewed sources/search scope`.

### P2.3 ClearSignal AI Visibility Study

After enough consented audits, evaluate anonymized aggregates: engine overlap, visibility by query
intent, cited-source types and common observable traits. Do not build analytics infrastructure now.
Before using customer reports, define consent, anonymization, minimum cohort sizes and retention.

## 7. Reject for MVP

- A new Brand Evidence Footprint report section now.
- Reweighting the score toward "recommendation" before recommendation is measured.
- Claiming that corroboration, backlinks, reviews, schema or third-party mentions caused an AI result.
- A rule such as "repeat the same claim on N websites."
- Broad crawling of directories, forums, media and communities for every audit.
- Manufactured reviews, Reddit discussions, comparison sites or fake independent validation.
- Mass content generation or backlink quotas.
- Renaming the product to AI Visibility & Brand Evidence Audit now.
- Monitoring, subscriptions, auth, dashboards, agency accounts or white-label infrastructure.
- Claiming ClearSignal replaces SEO.

## 8. Positioning proposal

### Canonical label

Keep:

> Expert-reviewed AI Visibility Audit

Use as a descriptor:

> An AI recommendation visibility diagnostic for the buyer questions that matter.

### Hero

Keep:

> When buyers ask AI who to choose, does it recommend you, or your competitor?

Proposed supporting copy:

> ClearSignal tests real buyer questions across ChatGPT, Claude and Perplexity, shows which brands
> appear in the tested answers, and compares the cited sources and website evidence surrounding
> those results. Every full report is reviewed by a person before delivery.

This avoids saying the evidence difference caused the result.

### SEO distinction

> SEO helps pages become discoverable in search. ClearSignal examines a different, complementary
> question: when buyers ask AI systems for recommendations, comparisons or solutions, which brands
> appear in the tested answers, which sources are cited, and what observable evidence gaps should be
> investigated first?

### Agency angle

> **A diagnostic your clients can act on.** Show clients where their brand appears in tested AI
> answers, which competitors appear instead, and which website or cited-source gaps your agency can
> prioritize next.

Supporting sentence:

> ClearSignal provides the diagnosis and evidence; your agency decides and implements the client
> work.

## 9. BEFORE / AFTER examples

### Landing

**Before**

> See where you appear, why competitors are chosen, and what your team should improve first.

**After**

> See where your brand appears in the tested answers, which competitors appear instead, and which
> observed website or cited-source differences your team should investigate first.

**Before**

> Three competitors appear more often because they have clearer case studies, third-party proof and
> category-focused pages.

**After**

> Three competitors appeared more often in this example. Their reviewed pages showed clearer case
> studies, third-party proof and category-focused content; these are observed differences, not proven
> causes.

### Report

**Before**

> Who AI recommends instead

**After**

> Competitors mentioned in the tested answers

**Before**

> Why these sources get cited (and you don't)

**After**

> What the cited sources contained compared with your site

**Before**

> Likely contributing factors include limited owned-page answer density, limited citations of
> example.com, and stronger third-party source visibility for competitors.

**After (measurement summary)**

> Example was named in 3 of 18 successfully tested engine-query combinations across Claude,
> Perplexity and OpenAI. The measured AI visibility score was 24/100; mention rate was 16.7% and
> citation rate was 5.6%.

**After (separate evidence/action fragment)**

> **Observed:** Competitor A was mentioned more often in the tested category and use-case answers.
> Source B, which appeared as a citation in those answers, contained category language, customer proof
> and a comparison structure that were not detected on the reviewed target page.
>
> **Interpretation:** These differences may be relevant, but this audit does not prove they caused the
> engine result.
>
> **Recommended:** Add verifiable customer proof and a buyer-focused comparison page on the owned
> site. Treat third-party inclusion as lower-control work and prioritize only sources that surfaced in
> the tested answers and are relevant to the business.

## 10. Challenges and provisional resolutions

This section satisfies the challenge requirement without fabricating a Claude response. Claude must
accept or amend each resolution before Phase 4.

| Required challenge | Product proposal | Codex challenge | Provisional resolution |
| --- | --- | --- | --- |
| Positioning | Rename toward AI Recommendation Visibility Audit | The engine measures mentions/citations, not recommendation semantics | Keep AI Visibility Audit; use recommendation-led descriptor |
| Audit mechanic | Add recommendation vs mention now | Semantic classification is nondeterministic and not ready for scoring | Correct labels now; defer optional classifier to P2 |
| Unnecessary scope | Add Brand Evidence Footprint | It requires broad claim discovery and a new report/data model | No new section; improve existing source-gap/action sections |
| Unprovable claim | Independent corroboration helps brands get recommended | Current evidence can show correlation/differences, not causation | Say `observed in reviewed scope` and `may be relevant`; never `because` |
| Positioning | AI Visibility & Brand Evidence Audit | "Brand evidence" overstates current cited-source-only coverage | Defer name until general corroboration exists |
| Audit mechanic | Competitor appears because it has more third-party proof | Current pipeline does not estimate causal contribution | Separate measured appearance from observed evidence differences |
| Unnecessary scope | Build agency tooling to support the positioning | Agencies can use the existing report and PDF | Copy change only; no accounts/dashboard/white-label |
| Unprovable claim | A cited page is cited because it is quotable/authoritative | The page was cited, but the reason is inferred by an LLM | Render characteristics, not a causal explanation |

## 11. Risks

1. **Measurement/marketing mismatch:** calling a mention a recommendation would weaken trust.
2. **Causal overreach:** public evidence differences are observable; model decision logic is not.
3. **Free/full mismatch:** free score is Claude-only while current copy promises three engines.
4. **Latency:** waiting for GEO before the action stage may lengthen paid generation; measure the
   critical path before release.
5. **Cost:** do not add another classifier or broad source discovery in P0/P1.
6. **Historical reports:** schema changes must be optional/backward-compatible and re-render safe.
7. **Source quality:** citations may contain forums, directories or marketing claims; prominence is not
   verification.
8. **Agency clarity:** `web dashboard`, monitoring and white-label language imply products outside MVP.
9. **Deploy split:** changes under `lib/audit-*`, `lib/geo/*`, `lib/prompts.ts`, schemas or Trigger tasks
   require both Vercel `main` and a separate Trigger.dev deploy from `C:\csdeploy`.

### Exact files affected

| Area | Files |
| --- | --- |
| Public positioning | `app/page.tsx`, `app/layout.tsx`, `app/checkout/page.tsx`, `app/score/page.tsx`, `app/score/[id]/page.tsx`, `app/sample/page.tsx` |
| Paid report labels | `app/audit/[id]/page.tsx`, `lib/geo/recommendation-stages.ts` |
| Measurement truth | `lib/geo/index.ts`, `lib/geo/sources.ts`, `lib/geo/query-taxonomy.ts` |
| Prompt/action linkage | `lib/prompts.ts`, `lib/audit-runner.ts`, `lib/action-confidence.ts` |
| Schema and validation | `lib/schemas.ts`, `lib/sanitize.ts`, `lib/report-validator.ts` |
| Tests | `tests/geo-measurement-v2.test.ts`, `tests/golden-report.test.ts`, `tests/trust-layer.test.ts`, `tests/audit-execution.test.ts`, plus a focused public-copy regression test |

`lib/audit-label.ts` is reviewed but its canonical label should remain unchanged.

## 12. Tests and verification required

### Targeted automated tests

- Public-copy regression: no `Who AI recommends instead`, `Why these sources get cited`, causal
  `because they have`, `web dashboard`, non-functional monitoring waitlist or white-label promise.
- Free score copy names the actual one-engine scope; full audit copy names three engines.
- `buildGeoSummary` contains only typed metrics and reuse disclosure.
- `third_party_authority` never appears in `target_missing_signals` for the brand's own page.
- Generic `ai_search` fixes do not receive arbitrary GEO IDs.
- Explicit action evidence IDs must exist in the supplied catalog.
- Six-query generation prompt contains the required intent mix; operator-confirmed queries remain
  untouched.
- Query taxonomy/count rebuild and historical report parsing continue to pass.
- Sanitizer/validator preserve sample bounds and reject unsupported causal wording in generated GEO
  explanation paths.
- Report UI renders `mentioned`, `cited` and `not named` exactly from typed evidence.

### Standard verification

Run:

```text
npx tsc --noEmit
npm run build
npm test
```

### Representative report comparison

Use existing fixtures first; do not incur live API cost merely to compare prose:

1. Rozie-style high-visibility local marketplace fixture.
2. AZ Moving-style low-visibility local service fixture.
3. A compact synthetic B2B/SaaS fixture added to tests.

Mechanically compare old/new JSON fields and forbidden strings. Produce one human review package,
not screenshot iteration loops. A new paid audit or regeneration requires explicit owner approval.

Human inspection questions:

- Does every recommendation name its observed basis or explicitly say it is synthesis?
- Is mention kept distinct from recommendation and citation?
- Are evidence differences presented as differences rather than causes?
- Can an agency see what it can implement without ClearSignal promising agency tooling?
- Does the report remain useful when no third-party cited page can be scraped?

## 13. Implementation order and commit boundaries

Only after Claude sign-off:

1. **Commit 1 - P0 measurement truth:** summary, source comparison semantics, evidence linkage and
   targeted tests.
2. **Commit 2 - P0/P1 public copy:** landing, free score, result, checkout, sample and report labels.
3. **Commit 3 - P1 query coverage:** prompt/taxonomy tests only; no extra LLM call.
4. **Commit 4 - P1 evidence-aware actions:** compact GEO catalog, validated evidence selection and
   action tests.
5. Run the full verification suite.
6. Deploy Vercel through `main`; if commits 1, 3 or 4 affect worker code, deploy Trigger separately
   from `C:\csdeploy` following `DEPLOY.md`.

Do not implement P2 or rejected items in this batch.

## 14. Acceptance criteria

- A visitor can understand within seconds that ClearSignal tests buyer questions, shows who appears,
  compares cited/public evidence within a defined scope and prioritizes next actions.
- A measured mention is never labelled as a recommendation.
- No deterministic summary states an unmeasured cause.
- The free-score promise matches its actual Claude-only execution; the paid promise matches the
  three-engine pipeline.
- Existing buyer-intent, source-gap, staging, trust validation and human review capabilities are
  reused rather than duplicated.
- Agencies see a diagnosis-to-implementation handoff without any new agency product surface.
- No new monitoring, auth, dashboard, white-label, engine, report section or speculative score is
  introduced.

---

# 15. Claude product/trust review

Reviewed against the code, not against the memo. Verdict: **the three measurement-truth findings are
real and one of them is a live false claim on a public page.** Ship those. Defer the engine work.

## 15.1 Confirmed by code

| Finding | Verified at | Assessment |
| --- | --- | --- |
| P0.1 free score is Claude-only | `lib/score-runner.ts:79` (`engines: ['claude']`) vs `app/score/page.tsx:89` ("whether ChatGPT, Claude and Perplexity understand and recommend your business") | **Most serious item in the memo.** A public page states a measurement the code does not perform |
| P0.2 unmeasured causality | `lib/geo/index.ts:86-88` appends "Likely contributing factors include limited owned-page answer density, limited citations of {domain}, and stronger third-party source visibility" | Confirmed. `buildGeoSummary` receives counts, rates and a score - owned-page answer density is not among its inputs, so the sentence asserts what the function never measured |
| P0.4 arbitrary evidence linkage | `lib/action-confidence.ts:211-217` takes `geo.evidence.slice(0, 3)` for any `ai_search` fix and renders "Based on: GEO-QUERY-001, ..." | Confirmed, and it is the worst kind: a *specific-looking* citation that carries no semantic link to the fix. Fabricated precision reads as more trustworthy than honest vagueness, which is exactly why it is more damaging |

**Correction for the implementer:** P0.3 lists `lib/geo/sources.ts` as the home of
`third_party_authority`. It is not there - the token lives in `lib/prompts.ts:182,193,210`. Re-locate
before editing, and re-verify the "appears in `target_missing_signals`" claim at the real site; this
review confirms the string's location, not the memo's reading of its effect.

## 15.2 Challenges

**Positioning (P1.1).** The memo keeps `AI visibility` as the label while using `recommendation
visibility` in prose. Two vocabularies for one thing on one page is how a skimming buyer gets
confused - and agencies skim. Pick one register per surface: the label and the prose on a given page
must agree. Keeping `AI visibility` overall is right, but for the buyer's reason (it is the term
agencies already use), not the memo's stated search-intent reason - optimizing the category name for
Google sits oddly in a product whose thesis is that buyers no longer start at Google.

**Mechanic (P1.3).** This is the highest-risk item in the memo and it is classified P1. It touches
five core files including the prompt chain (`lib/prompts.ts`, `lib/schemas.ts`,
`lib/audit-runner.ts`, `lib/action-confidence.ts`, `lib/report-validator.ts`), and it *serializes*
GEO before the action stage, which today runs in parallel with clarity/gap work. `runFullAudit` sits
under `maxDuration: 600`; lengthening the critical path buys a timeout class of failure for a
quality improvement. R7 in `DEFECTS_BACKLOG.md` is precisely "a prompt edit contradicted the schema
and every generation failed in production." Defer P1.3 until after the sales test.

**Scope.** Eight changes across roughly fifteen files during a declared scope freeze, days before
outreach starts. The memo is disciplined about *what* it rejects and undisciplined about *how much*
it accepts at once.

**Unprovable claim (P0.2's proposed fix).** The memo removes the causal sentence from the
deterministic summary and relocates "possible contributing factors" to "a separately labelled
evidence comparison." Moving an unmeasured claim does not measure it; a label does not convert an
assertion into an observation. Delete the sentence. The "why" is already carried by the one part of
the pipeline that genuinely observes it - the cited-source comparison, which scrapes the pages the
engines actually cited. Say less, from evidence, rather than the same thing behind a hedge.

## 15.3 Recommended cut

**Ship before outreach begins** (truth fixes, no engine changes):

1. P0.1 - reconcile free-score copy with Claude-only execution.
2. P0.2 - delete `domainClause`; do not relocate it.
3. P0.4 - drop the `slice(0, 3)` linkage; fall back to the existing synthesis basis.
4. A contract test asserting that public engine claims match the engines each path configures. This
   class of defect - marketing copy drifting from measurement - has no test today, which is why it
   survived to production. It is the R7 pattern applied to the public surface.

**Ship if the above lands cleanly:** P0.3 (contained), P1.1 (copy only), P1.4 (display labels only).

**Defer until after the two-week sales test:** P1.2 (changes which questions get asked, shifts every
golden fixture), P1.3 (see challenge above).

## 15.4 Turn P0.1 into a funnel improvement, not just a retraction

The honest fix is not simply deleting two engine names from the free-score page. Framed correctly it
strengthens the upgrade path:

> The free score samples one engine (Claude) on a handful of buyer questions. The full audit tests
> ChatGPT, Claude and Perplexity across your buyer question set and has a person review the result.

That is true, it explains what the money buys, and it stops the free tier from cannibalizing the
paid claim. Preferred over a bare copy deletion.

## 15.5 Why the timing argument favours doing this now

The standing advice in this repo is that strategy documents do not move the business toward a paying
customer and outreach does. P0.1 is the exception: the owner is about to point roughly forty
agencies at `/score`. An agency that notices the page claims three engines while the scan runs one
does not file a defect - it silently stops replying. Fix the false claim *before* the traffic, and
leave the engine work until after.
