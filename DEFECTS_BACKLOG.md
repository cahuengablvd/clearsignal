# Defects backlog — open

Process: defects found in real audits land here (date, audit/vertical, field path, quoted
text, proposed fix). Fixed in batches — each fix starts with a failing fixture test.

Closed defects (R1–R12, R14, R15, R17, R23–R27, R29, R31, R32) are in `docs/archive/DEFECTS_CLOSED.md`. Do not read that file
unless you are investigating a regression in one of them.

## R13 — target_markets_languages is collected, stored, displayed, and never used

- Seen: 2026-08-05, manual-audit preview for `jusukosmetologs.lv` (a Riga cosmetology clinic).
  The operator entered `Markets/languages: Latvia, Riga - Latvian and Russian`. All six generated
  queries came back in English.
- Root cause: `geoQueriesUserPrompt` (`lib/prompts.ts:81`) is built from brand, page snippet, ICP
  and count only. `target_markets_languages` is never passed to it. The field is defined
  (`lib/schemas.ts:58`), collected on both the paid checkout (`app/checkout/page.tsx:223`) and the
  admin form, persisted, and rendered on the confirmation screen — a complete round trip that ends
  nowhere.
- What actually drives language today: the scraped page snippet. `salidzini.lv` produced Latvian
  queries because its page content is Latvian and the model mirrored it. That is incidental, not
  designed, and it fails for any bilingual market where the site is in one language and buyers
  search in two — which is the normal case in Riga.
- Why it matters commercially: measuring a Riga clinic against English queries measures a race it
  never entered. The report would honestly say "not named in any tested answer" while the tested
  answers belong to a different market. Locality survived only because the operator happened to
  write "in Riga and Latvia" inside the free-text ICP.
- Fix: pass markets/languages into the query-generation prompt, and make the language part
  structured rather than free text so the instruction can be deterministic ("write N queries in
  Latvian and N in Russian") instead of hoping a sentence is interpreted. Country/market can stay
  free text; language is a closed set and belongs in a multi-select.
- Related UX (owner request, 2026-08-05): typing this field on a phone is painful. Structured input
  fixes both the reliability and the typing.
- Acceptance: a fixture specifying two languages produces queries in both; removing the field from
  the input changes the generated queries, proving it is wired.

## R16 — Query-intent taxonomy is English-only, so non-English markets get "Other"

- Seen: 2026-08-05. `salidzini.lv` (6 Latvian queries) reports `Other: 6 queries` — every intent
  bucket empty. `jusukosmetologs.lv` reports `Comparison: 1, Other: 5`.
- Root cause: `classifyQueryIntent` (`lib/geo/query-taxonomy.ts`) matches English regexes only —
  `best|top|recommend`, `vs|versus|compare`, `price|pricing|cost`, `near me|local`. Latvian and
  Russian queries fall through to `other` at line 49.
- Effect: the "Visibility by buyer intent" section — a full report section — degenerates into one
  undifferentiated bucket for exactly the markets ClearSignal sells into first (Latvia, Baltics).
  It is not wrong, it is empty, which is worse in a paid deliverable because it looks like analysis.
- Note this is now load-bearing: `P1.2` asks the generator to cover specific intents, and the
  coverage check that verifies it runs through this same English-only classifier.
- Fix: extend the vocabulary per supported language, or classify from the query-plan slot the
  generator was asked to fill rather than re-deriving it from the text after the fact. The second is
  cheaper and language-proof.
- Acceptance: a Latvian and a Russian query set produce a spread across intents, not a single
  `other` bucket.

## R18 — Proof recommendations do not ask for verifiable proof (quality)

- Seen: 2026-08-05, audit `5d53a488`. The report correctly observes "no patient reviews or
  testimonials appear on the page" and recommends adding "patient social proof". It does not say the
  proof must be independently checkable.
- Why it matters mechanically, not just persuasively: an unlinked testimonial paragraph is a
  first-party claim an engine cannot corroborate. A link to a Google Business, Facebook or
  industry-directory profile is a checkable third-party source an engine can cite. The two have very
  different value for AI visibility, and the current wording treats them as the same action.
- The same principle the trust layer applies to our own report — prefer what can be verified —
  applied to the client's site. It is also the cheap, in-scope half of the deferred `Brand Evidence
  Footprint` idea: we are not crawling third parties, only recommending that proof point at them.
- Fix: in proof-related recommendations and implementation briefs, prefer proof that links to an
  independently verifiable source, and say why. Never instruct the client to manufacture reviews or
  proof - `TASKS_AI_POSITIONING_AND_EVIDENCE.md` already rejects that, and it must stay rejected.
- Acceptance: a proof fix on a fixture with no reviews asks for a linked, checkable source rather
  than testimonial text alone.

## R19 — One competitor counted twice under two name forms (credibility, customer-visible)

- Seen: 2026-08-05, audit `5d53a488`. "Who AI recommends instead" lists `ERA ESTHETIC 33%` and
  `Eraesthetic 11%` as separate rows. Same company: the operator supplied `https://eraesthetic.lv/`
  (pretty-named `Eraesthetic`) and discovery extracted the spaced brand form `ERA ESTHETIC` from the
  answers.
- Root cause: the dedupe in `lib/geo/index.ts:228` compares `sld(name)` and an exact lowercase name
  match. `sld()` resolves the operator's URL to `eraesthetic`, while the discovered plain-text name
  lowercases to `era esthetic` — different string, no match, second entry created.
- Two harms, both visible to the customer: the leader's true share is understated (33% + 11% ≈ 44%)
  and the competitor list looks padded with a duplicate, which is the first thing a reader notices
  and the last thing a paid report should show.
- Fix: normalize both sides before comparing — case-fold and strip non-alphanumerics (so
  `era esthetic`, `ERA-ESTHETIC` and `eraesthetic` collapse), then merge mention counts rather than
  listing separately. Keep the display form that appeared most often in the answers.
- Watch the false merge: two genuinely different brands whose names collapse to the same token must
  not be merged. Prefer merging only when one form is a whitespace/punctuation variant of the other,
  not on fuzzy similarity.
- Acceptance: a fixture with an operator URL plus a spaced brand form of the same company yields one
  row with the combined mention rate.

### R19 addendum — extraction also emits non-names

- Seen: 2026-08-03, rozie audit `a04586b1`. "Who AI recommends instead" lists **`Com` at 15%**,
  ranked equal-first with StayCare Group and Tidy Malta. `Com` is not a company; it is almost
  certainly a fragment of the cited domain `com.mt`.
- Same subsystem as R19 but a different failure: R19 splits one real company across two rows, this
  emits a row that is not a company at all. Both land in the most-read table of the report.
- Fix alongside R19: reject candidates that are bare TLD fragments, single generic tokens, or
  shorter than a plausible brand, and drop any candidate that is a substring of a domain already in
  `cited_domains_ranked`. Prefer dropping a real competitor over printing a fake one — a missing row
  is invisible, a nonsense row is the first thing a reader sees.
- Acceptance: a fixture whose answers mention `com.mt` never yields a competitor named `Com`.

## R20 — The human review is invisible in the deliverable (first real reader feedback)

- Seen: 2026-08-05. First report given to a real business owner (`jusukosmetologs.lv`, a personal
  contact). His unprompted verdict: **"выглядит АИшный документ на 15 страниц. Не человек писал,
  Сгенерировано."** He also said he did not understand it, having never done SEO — he buys Google
  Ads for guaranteed top-3 placement.
- The analysis was not the problem. The report is mechanically clean, the competitor data is real
  and the recommendations are specific. It still read as machine output, because nothing in it shows
  a person was involved.
- This attacks the positioning directly. "Expert-reviewed" is half the differentiation against
  $29/mo scanners, and the deliverable contains no trace of the expert: no name, no signature, no
  sentence a human wrote. The review happens and then leaves no evidence.
- Cheapest fix that would have changed this reader's reaction: an operator note rendered at the TOP
  of the report — three or four sentences the reviewer writes in their own words, saying what they
  looked at and what they would do first. It makes the human-review promise visible, answers the
  "what do I do first" question that a 15-page document buries, and costs one textarea plus a
  render block. `admin_notes` already exists but is internal; this must be a separate, deliberately
  client-facing field.
- Do NOT fix by making the generated prose sound more human. The objection is about evidence of a
  person, not about tone, and faking the tone while nobody actually reviewed it would be worse than
  the current state.
- Related, not a defect: this buyer's mental model is "pay for a guaranteed placement", which
  ClearSignal deliberately does not sell. Second data point in one day that service businesses want
  an outcome and delegate the work — consistent with the agency-first strategy in `CLAUDE.md`.
- Acceptance: a report carrying an operator note renders it above the executive summary, attributed
  to a person; a report without one renders unchanged.

## R21 — /sample is built from fictional data and reads as a mockup (sales asset)

- Seen: 2026-08-05, while finalising agency outreach. `app/sample/page.tsx` is hardcoded with
  `Competitor A`, `Competitor B`, `Example SaaS` and invented percentages.
- It is the single most-linked asset in the sales process — every outreach email points at it — and
  it is the first thing a prospect sees. An SEO agency principal, who produces client reports for a
  living, will read placeholder competitor names as a wireframe rather than a product.
- Real reports are dramatically more convincing precisely because the specifics are checkable: named
  Baltic competitors, actual cited domains with counts, ready-to-paste copy in the client's language.
  A prospect can open ChatGPT and verify the finding themselves.
- Options, cheapest first:
  1. Send a real (permission-cleared, optionally anonymised) PDF on reply, keeping `/sample` as the
     low-friction first-touch link. No code. This is the workaround for the two-week test.
  2. Rebuild `/sample` from a real audit with the business anonymised but the structure and numbers
     intact.
- Do not fix before the first replies come in: if prospects reach a conversation without mentioning
  the sample, it is not the bottleneck and the effort belongs elsewhere. Let the outreach decide.

## R22 — Single-page crawl misses cross-page inconsistency (found by competitive comparison)

- Seen: 2026-08-06. The clinic owner ran his own site through ChatGPT with browsing and sent back the
  result. That document found real problems ClearSignal did not: the address differs between pages,
  prices are stale, the Russian version is outdated, the blog is empty, and there are no dedicated
  pages for named procedures (HIFU, Morpheus8, Lumecca IPL) that buyers search for.
- Cause: ClearSignal scrapes one page. `scrapeUrl(input.url)` fetches the homepage and every on-page
  finding derives from that single document. A model with browsing walked several pages and compared
  them.
- Cross-page consistency is squarely in scope for AI visibility, not a nice-to-have: contradictory
  NAP, prices and service descriptions are exactly the entity-confusion signals the report already
  talks about — it just cannot observe them today.
- Fix direction (not scheduled): fetch a small, bounded set of pages — homepage plus links found in
  the main navigation, capped at perhaps five — and add a consistency check across them for name,
  address, phone, prices and service names. Bounded, because unbounded crawling multiplies Firecrawl
  cost per audit and the current unit cost of $1.06 is a selling point.
- Weigh against `R15`: the same crawl budget also gives a second signal for detecting a site whose
  real content sits behind a challenge page.
- Do not treat this as "ChatGPT is better". It found page-level problems and measured nothing; the
  distinction is in `validation/segment-findings.md`.

## R30 — A third of engine-query combinations failed in one run (observation, unexplained)

- Seen: 2026-08-14, audit `9ba2d5ec`: 12 of 18 combinations successful, 6 failed or skipped. Our own
  `28ca503b` failed 3 of 18 in the same period.
- Not yet diagnosed. The report discloses the count honestly, so this is a coverage-quality issue,
  not a correctness one — but a third of the measurement missing weakens every rate in the report.
- Next step when picked up: identify from the run logs whether one engine drops out systematically
  (rate limit, timeout, provider error) or the failures are spread.

## R35 — The "first action" differs between summary, action plan and ship-first

- Seen: 2026-08-20, human review of `beb637a8` (`vertexspain.com`) before delivery. Three sections
  name a different first step.
- Cause: the plain-language pass requires the executive summary to end with "the single first
  action", and nothing makes that agree with `action.top_fixes[0]` or `ship_first[0]`.
  `lib/report-validator.ts:736` touches the summary only when it is empty; `ship_first` is never
  cross-checked. Before that requirement existed there was nothing to diverge.
- In a deliverable whose promise is "what to fix first", this is the worst inconsistency available.
- Fix: `top_fixes[0]` is the source of truth; dependent sections are verified against it and
  rewritten if they disagree. Never reorder `top_fixes` to match prose.
- Spec: `TASKS_REPORT_COHERENCE.md`.

## R36 — Ready materials claim the category is unknown while the operator confirmed it

- Seen: 2026-08-20, same review. Operator set `local_business` for a Marbella real-estate brokerage;
  the ready copy states the business category was not established, directly under a business-context
  block that states what the business is.
- Cause: `operatorMaterialCategory` (`lib/materials.ts:32`) maps only `gallery`, `marketplace`,
  `moving_service`, `video_production`, `tailoring_atelier`. Everything else falls through to
  `default`, whose copy asserts the category was not established.
- Mirror image of `R24`: there abstention protected the customer from a confident wrong category;
  here it overrides a category a human confirmed.
- Fix: a confirmed `business_model` reaches the generic template in plain words; only a genuinely
  unknown value may produce "not established". Do not add a template per vertical — that is the
  hardcoded-vertical trap `R24` closed.
- Spec: `TASKS_REPORT_COHERENCE.md`.

## R37 — A recommendation contradicts a deterministic finding

- Seen: 2026-08-20, same review. JSON-LD recorded as detected on the page, and elsewhere the report
  tells the client to add JSON-LD because it is missing.
- Cause: the validator maps fixes to `OBS-*` evidence and strips irrelevant links
  (`lib/report-validator.ts:670-692`), but never checks that a fix does not *contradict* the finding
  it sits beside.
- Fix: a contradiction between generated prose and a deterministic finding is a validation error on
  the prose — drop or rewrite the item, never edit the finding. The measurement wins over the
  sentence. Cover JSON-LD, meta description, H1, FAQ structure and primary CTA.
- Spec: `TASKS_REPORT_COHERENCE.md`.

## R38 — A paid audit and a test run share one spend cap and one alert

- Seen: 2026-08-21, reviewing the `R34` implementation. Not yet triggered in production — there are
  no paying customers yet, which is exactly why it should be closed before there are.
- `enqueueAudit` (`lib/audit-queue.ts:22`) calls `enforceDailyAiSpendCap` before anything
  distinguishes who is asking. A customer who has already paid €149 can be refused because the owner
  spent the day's cap on verification regenerations.
- Chain: payment → Stripe webhook → enqueue → cap exceeded → throw → webhook returns 500 → Stripe
  retries. The audit stays `queued`, the customer is told nothing, and the operator gets **one**
  notification per UTC day — possibly already spent on their own morning test run.
- At the `$5.00` default and `$1.06` per audit the cap binds on the fifth run of a day. 2026-08-20
  had roughly fifteen.
- The delivery promise is two business days, so there is slack; the problem is priority, not
  latency. A paying customer and a test regeneration currently queue with equal standing.
- Fix, cheapest first: a blocked **paid** audit alerts every time rather than once per day, and is
  visible in `/admin` as "blocked by spend cap, customer waiting" rather than plain `queued`.
  Preferably paid audits are counted but not refused: the cap exists to catch the owner's
  experiments, not to decline work that is already paid for.
- Do not fix by removing the cap or by raising the default. The guard is correct; only its blast
  radius is wrong.

