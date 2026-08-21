# Defects backlog — closed (archive)

Shipped and verified. Kept for regression investigation only.

## R1 — Re-render does not recompute GEO detection over stored evidence (DO NOW: unmet F9)

- Seen: 2026-07-03, monokelriga re-render on e2554b2. Evidence header says "best custom
  tailored suits in Riga for men / perplexity / **Not named**" while the stored answer
  literally opens with "The best custom-tailored suits for men in **Riga** are offered by
  **Monokel Riga**". Score stuck at 2/14 — the alias fix (da54fbf) never applied to this
  report.
- Root cause: `rebuildReusedGeoNarrative` (lib/audit-runner.ts) rebuilds narrative/summary
  from the STORED `brand_mentioned` flags; nothing recomputes detection with the new
  alias-aware `buildVariants`.
- Fix: in the re-render path (and anywhere reused GEO evidence flows into a report), first
  recompute per-evidence `brand_mentioned`, `brand_cited`, `brand_position`,
  `competitors_mentioned` from stored `answer_excerpt` + `citations` using current
  `buildVariants` (with `alternative_brand_forms` from meta), then recompute mention/citation
  rates, share of voice, position score, `ai_visibility_score`, and only then rebuild the
  narrative. Document the caveat: recompute runs over the 700-char excerpt, so it can only
  ADD mentions relative to stored flags, never prove absence beyond the excerpt.
- Acceptance: monokelriga fixture re-render flips the Riga query to Named; mention count
  >= 3 of 14; evidence header shows Named; summary/score/stat blocks all agree.

## R2 — Neutral meta fallback produces "Monokelriga provides services."

- Seen: 2026-07-03, monokelriga e2554b2 ready materials: "Monokelriga provides services.
  Contact the business to discuss options, availability, and next steps." Empty observed
  context degraded the fallback to filler copy — while the operator's verified_facts contain
  "Business type: bespoke menswear atelier" and locations include Riga.
- Fix: `neutralMetaDescription` inputs must include the verified-facts business type and the
  material category (lib/verified-facts.ts already parses these). Never emit the bare
  "provides services" — when no category is resolvable, fall back to brand + conversion
  action only ("Monokelriga — contact the atelier to book a consultation.").
- Acceptance: mono fixture → meta description names the business type or drops the
  "provides X" clause entirely; the literal string "provides services." never appears.

## R3 — Brief schema guidance suggests MovingCompany to non-moving businesses

- Seen: 2026-07-03, monokelriga + latvianart briefs: "Use Organization, Service,
  LocalBusiness/MovingCompany, or FAQPage schema unless verified review-source data is
  supplied." — an atelier and an art gallery being told about MovingCompany.
- Root cause: the AggregateRating replacement text in report-validator.ts is a hardcoded
  string with a moving-flavored schema list.
- Fix: build the replacement from the F1 schema allowlist for
  `materialCategoryForContext(...)`: gallery → "ArtGallery, Organization, VisualArtwork, or
  FAQPage", atelier → "LocalBusiness, ProfessionalService, Service, or FAQPage", etc.
- Acceptance: no `MovingCompany` token in any non-moving report (extend the F1 vocabulary
  test to cover brief text).

## R5 — Recovery sweep retries deterministic failures forever (DO NOW: burns money)

- Seen: 2026-07-03 ~15:00-15:20. The prompt/schema contradiction (fixed in 0f7071a) made
  every full generation fail after ~6 min. `audit-recovery-sweep` (cron, every 10 min)
  re-enqueued the failed audits each cycle: 2 failed runs + 1 executing + 3 queued before
  ops intervention (runs canceled, statuses reset by hand). Left alone this loop burns
  LLM + Trigger money indefinitely — each cycle a full audit's worth of API calls, forever.
- Fix in `lib/audit-recovery.ts`:
  1. Attempt budget: add `recovery_attempts` counter (or count report_versions/notes marks);
     after N=2 re-enqueues an audit goes to `failed` (not swept) + `notify` escalation.
  2. Staleness must key off a `processing_started_at` timestamp, not `created_at` — any
     old audit re-entering processing is instantly "stale" today.
  3. The sweep must never re-enqueue an audit whose latest run failed with a validation
    /schema error (deterministic — retry cannot help); only crash/timeout classes retry.
- Acceptance: unit test — an audit whose run failed twice with a zod error is NOT
  re-enqueued and lands in `failed` with an escalation notify.

## R6 — Successful runs must clear stale failure text from admin_notes

- Seen: 2026-07-03. After the 14:46 re-render SUCCEEDED, the old "Report validation
  blocked re-render: replacement_phrase..." text stayed in admin_notes — the operator
  (reasonably) read it as a fresh failure and re-triggered generation, feeding the R5 loop.
- Fix: on successful re-render/generation, append a timestamped "OK: re-render succeeded,
  N warnings" line (or clear resolved failure lines). admin_notes must always end with the
  latest outcome.

## R7 — Prompt/schema drift guard (partially done in 0f7071a)

- The class: prompt instructions and zod constraints evolve independently; F4 hardened the
  schema (exactly 3 unique outreach channels) while a later prompt edit relaxed the wording
  ("only messages that fit") — every generation then failed schema validation.
- Done: contract-guard tests for outreach count + repair-prompt-restates-request.
- Remaining for Codex: extend the same contract tests to every enum the prompts promise
  (top_fixes.category, impact, effort, channel; materials FAQ counts) so a prompt edit that
  contradicts the schema fails CI, not production.

## R4 — Legacy reports left with 1-2 outreach channels after dedupe (warning only)

- Seen: 2026-07-03: latvianart shows 1 channel (email), monokelriga and az-moving show 2.
  The F4 dedupe removes duplicates from legacy reports but cannot invent the missing
  channels without an LLM call.
- Decision: for legacy re-renders this is acceptable — add a validator WARNING
  ("outreach: N of 3 channels after legacy dedupe") so it surfaces in admin review, and an
  operator-checklist line. New generations already enforce 3 unique channels via schema.
- Do not add an LLM top-up call for legacy reports; not worth the cost before launch.

## R11 — Claude timed out on 6 of 6 queries; the summary still names it (DO NOW: false claim, paid side)

- Seen: 2026-08-04, benchmark audit `51ff451a-f8c7-498f-bd62-9a10814fec38` (attio.com, fresh, no
  GEO reuse). All six Claude GEO calls aborted at 45.013-45.021s. `succeeded: 0, failed: 6`. The
  audit still reached `awaiting_review` on OpenAI + Perplexity evidence alone.
- **The false claim:** `buildGeoSummary` is passed `engines` — the REQUESTED list from
  `lib/geo/index.ts:173` (`opts.engines ?? availableEngines()`) — not the list that returned
  anything. The customer-facing sentence therefore reads "across ChatGPT, Claude and Perplexity"
  when Claude contributed zero rows. The same object already computes the honest value:
  `engines_tested` at line 407 is derived from `raw`, which is filtered to `res.ok` at line 201. Two
  different answers in one result; the wrong one is the one a paying customer reads.
- This is the P0.1 defect class (public claim vs measured fact) on the paid side, where it costs
  EUR 149 of credibility instead of a free scan.
- **Underlying cause:** a 45s timeout is too tight for Claude with `web_search max_uses: 2`, six
  queries in parallel. Likely chronic rather than new: before R10 the same timeout fired and the
  result was discarded just the same — the difference is that the abandoned request used to keep
  billing. That is consistent with the cost drop from ~$1.89 to $0.36 on a comparable run: much of
  the old unit cost may have been Claude work that was paid for and never used.
- Fix direction, in order:
  1. `buildGeoSummary` must name only engines that produced evidence. Pass `engines_tested`.
  2. Raise the per-engine timeout for the web-search path specifically, and/or cap concurrency, so
     Claude has a realistic chance to answer. Measure before choosing a number.
  3. Surface engine coverage in admin review: an audit where an engine returned nothing must be
     visible before a human approves delivery, not discoverable only in logs.
- Do NOT resolve this by removing Claude from the engine list. The three-engine claim is bound to
  the public copy via `lib/engine-scope.ts`; dropping coverage to match a broken timeout would make
  the product smaller to hide a bug.
- Acceptance: a run where one engine returns nothing produces a summary that does not name it, and
  the admin queue shows the coverage gap before approval.

## R10 — Engine timeout abandons the request but not the spend (DO NOW: burns money silently)

- Seen: 2026-08-04, Batch 3 benchmark. `withTimeout` (`lib/geo/engines.ts:33`) is a bare
  `Promise.race` against a `setTimeout` rejection. It stops the pipeline WAITING for the call; it
  does not cancel it. The Anthropic web-search request keeps running server-side and keeps billing
  after the pipeline has already recorded the engine as failed.
- Measured: two calls in audit `28cbfe6e-9870-41a0-81be-73c104de5929` completed after their logical
  timeout at 123,904 and 217,837 input tokens (~$0.42 and ~$0.72). Web search inflates context, so an
  abandoned call costs MORE than a normal one — a full clean audit is ~$1.89 total. Two benchmark
  attempts burned ~$3.03 and exhausted the production key mid-run.
- Why it is worse than an overspend: the call is logged as timed out, so the cost is invisible.
  Nothing in the admin cost badge attributes it. Six engine queries run in parallel per paid audit
  with `max_uses: 2` each, so the worst case is a silent multiple of the expected unit cost — the
  number the €149 price is justified against.
- Second defect in the same function: the `setTimeout` handle is never cleared when the promise wins,
  leaving a pending timer for the full window on every successful call.
- Fix: thread an `AbortController` through `callClaude`/`callClaudeJSON` and the engine adapters,
  abort it in the timeout branch, and `clearTimeout` in a `finally`. The Anthropic and OpenAI SDKs
  both accept a per-request `signal`. Cancellation must be verified by observation (no usage recorded
  after the abort), not by the absence of an error.
- Related gap: with `USE_ANTHROPIC_ADMIN_BALANCE=false` the guard in `lib/anthropic-balance.ts:153`
  falls back to a ClearSignal-side monthly budget estimate, which cannot see the real prepaid
  balance — so it did not and could not prevent the mid-run exhaustion.
- Acceptance: a unit test where the underlying call never settles asserts the abort signal fired and
  the timer was cleared; a real audit run shows no Anthropic usage attributed after a logical timeout.

## R9 — Schema gate blocks legacy re-renders into a dead end (wrong failure mode)

- Seen: 2026-07-24, monokelriga re-render on `6ad9d73`. Five `schema_deliverable_mismatch`
  errors (`LocalBusiness`, `ProfessionalService`, `Review` recommended in `action.top_fixes`
  and `implementation_briefs` but absent from `ready_materials.json_ld`). The audit moved to
  `failed-validation` and cannot return without a paid regeneration.
- The DETECTION is correct and must not be weakened: the report really does tell the client to
  implement types the attached deliverable omits. The report predates the gate (`8bb1f5c`,
  2026-07-23), when prompts did not yet tie recommendations to the deliverable.
- The FAILURE MODE is wrong for this path. `rerenderStoredAuditReport` rebuilds
  deterministically from stored evidence with no LLM call, so nothing in the re-render path can
  add the missing JSON-LD block or rewrite the recommendation text. Blocking therefore converts
  a usable legacy report into a permanently stuck one. Fresh generation is unaffected — it has
  the repair round-trip, and rozie run `9r5hcc01` confirmed the gate passes there.
- Precedent: R4 settled this exact trade-off for legacy re-renders (warn, do not block, when
  the deterministic path cannot fix what it detects).
- Fix direction: on the re-render path only, downgrade `schema_deliverable_mismatch` to a
  validator WARNING surfaced in admin review, so the operator sees the inconsistency and
  decides. Keep it a blocking error on generation. Do not "repair" client prose by appending a
  client-side-implementation label — that is the repair-the-repair pattern the trust-layer
  refactor exists to eliminate.
- Acceptance: a legacy fixture whose fixes recommend an undelivered schema type re-renders with
  a warning and stays reviewable; the same report on the generation path still blocks.
- Operator note until fixed: do not re-render audits generated before 2026-07-23.

## R8 — Marketplace JSON-LD deliverable is the generic pair (quality, not a blocker)

- Seen: 2026-07-24, rozie re-render on b1cc310. `ready_materials.json_ld.@graph` ships only
  `Organization` + `FAQPage`, while the marketplace allowlist permits `Organization, WebSite,
  FAQPage, ItemList, OfferCatalog` (lib/industry-profiles/schema-allowlist.ts:12).
- Not a gate defect: the schema-deliverable gate behaved correctly — it narrowed the
  recommendations to what is actually attached and deferred `Review` until a confirmed
  review-feed integration exists. Consistency is exactly what it is there for.
- The gap is in the materials, not the validator: for a marketplace, `ItemList` and
  `OfferCatalog` are the types that carry real value (listing/offer structure). Shipping the
  generic pair makes the section read as boilerplate for this vertical.
- Fix direction: extend the materials builder so an affirmatively-`marketplace` business also
  emits `WebSite` (with SearchAction) and an `ItemList`/`OfferCatalog` block built ONLY from
  listing/offer structure actually observed on the page. Never invent offers or prices — if the
  page shows no listing structure, keep the generic pair and say nothing.
- Acceptance: rozie fixture yields at least one marketplace-specific type in the deliverable, and
  every recommended type still passes the schema-deliverable gate unchanged.

## R12 — Empty ICP lets the query generator invent the wrong vertical (blocks first sale)

- Seen: 2026-08-05, manual-audit preview for `salidzini.lv` (a Latvian consumer price-comparison
  site). With `ICP: none`, `Conversion goal: unknown` and no competitors, all six generated buyer
  questions were about **financial products, banking and lending** — "What are the best tools for
  comparing financial products and services?", "What's the difference between various banking and
  lending options available to me?". The audit would have measured visibility in a vertical the
  business does not operate in, and every downstream finding would inherit that framing.
- The preview DOES scrape and pass 600 chars of page markdown (`app/api/admin/audits/preview`,
  `lib/audit-runner.ts:503`), so thin or failed scraping plus an empty ICP leaves the model guessing
  from the domain name — "salidzini" (Latvian for "compare") plus `business_model: marketplace`
  apparently resolved to comparison-of-finance.
- Why it reaches customers: `icp_description` is `.optional()` (`lib/schemas.ts:103`) and the paid
  checkout labels it "Describe your ideal customer (optional)". A buyer who skips it gets
  auto-generated queries with no operator confirmation step on the paid path — the manual-audit
  confirmation screen that caught this does not exist between payment and generation.
- Current mitigation is the human review gate: the operator sees the finished report and can
  regenerate. That costs ~$1.06 and a delivery delay per occurrence, and depends on the reviewer
  noticing the vertical is wrong.
- Fix directions, in preference order:
  1. Surface scrape success on the confirmation screen — the preview already returns `scraped`, but
     the operator cannot currently tell whether queries were informed by the page or invented.
  2. Make the paid path refuse to auto-generate from nothing: when ICP is empty AND the scrape is
     thin, hold the audit for operator query confirmation rather than guessing.
  3. Reconsider "optional" on the checkout ICP field, or replace it with a required one-line
     "what do you sell, to whom" that is hard to skip and cheap to answer.
- Do NOT fix by making the query prompt "try harder" — the failure is missing input, not weak
  wording.
- Acceptance: a fixture with empty ICP and thin scraped content does not produce confident
  wrong-vertical queries; it either surfaces the gap to the operator or refuses to proceed.

## R15 — A bot-challenge page is audited as if it were the website (DO NOW: customer-visible)

- Seen: 2026-08-05, audit `7590982c` for `salidzini.lv`. The report's own executive summary opens:
  "The Salidzini homepage currently serves a Cloudflare browser-verification interstitial as its
  crawlable face, meaning no value proposition, category content, or trust signals are observable at
  the first point" — `Cloudflare` appears 17 times, `interstitial` 13.
- The scrape "succeeded": HTTP 200 with markdown. The markdown was a bot check. Every on-page
  finding, clarity score, ready-material and website recommendation in that report describes a
  challenge screen, not the business.
- The GEO half is unaffected and remains valid — 56/100, named in 12 of 18 combinations — because it
  measures what engines answer, not what we scraped. So the report is half real and half about
  nothing, with no visible seam between them.
- This also explains the earlier `R12` symptom on the same site: with only a Cloudflare page in
  context, the query generator invented a finance vertical from the domain name.
- Scope: Cloudflare bot protection fronts a large share of real commercial sites. Any such customer
  would pay EUR 149 for an audit of an interstitial.
- The trust layer worked - the report says plainly what it saw. The failure is that generation
  continued and produced a full deliverable anyway.
- Fix: detect challenge/JS-required pages after scraping (Cloudflare/Akamai/PerimeterX markers, a
  body under a plausible length, "enable JavaScript"/"verify you are human" phrasing) and stop
  before the paid stages, surfacing it to the operator as a blocking intake problem. Do not silently
  degrade, and do not "try harder" with a second scrape - the answer is to tell a human.
- Acceptance: a fixture whose scraped markdown is a Cloudflare interstitial does not reach a
  finished report; the operator sees why.

## R17 — PDF orphaned headings and JSON-LD with nowhere to put it

Both seen 2026-08-05 in audit `5d53a488` (`jusukosmetologs.lv`), reviewed as a customer would.

**Orphaned headings.** "AI Visibility (GEO / AEO)" sits alone at the foot of page 2; its content
starts on page 3. The print block in `app/globals.css:52` sets only `@page { size: A4 }`,
`min-height: 0` and ligature suppression — there are no break rules at all. Add
`break-after: avoid` to headings and `break-inside: avoid` to cards/tables so a heading cannot be
separated from what it introduces. Cheap, and it is the first thing a reader notices.

**JSON-LD has no placement instruction.** The deliverable ships a JSON-LD block with a Copy button.
The report mentions validating with Google's Rich Results Test, but nowhere says *where the code
goes* — inside `<head>`, as `<script type="application/ld+json">`, one block per page, and who does
it (developer, or a WordPress/Wix SEO field). A clinic owner receives a block of JSON and cannot act.
The audit's whole value proposition is "a prioritized plan you can implement", so an
unimplementable deliverable undercuts it. Two sentences of placement guidance fix it.

Related wording: the section is titled **"Draft copy for operator review"** and reads "Review these
meta tags, FAQ, JSON-LD and CTA options before publishing." `operator` is our internal word for the
reviewer — the paying customer does not know it means them. Retitle for the reader.

## R24 — Observation stage is a hardcoded Toronto-moving-company detector (LAUNCH BLOCKER)

- Seen: 2026-08-10, self-audit of `getclearsignal.io` (audit `28ca503b`). The report states
  **"Business type: Moving service, Service category: Moving services, Observed locations: Toronto"**
  for a SaaS audit product. Delivered JSON-LD is `MovingCompany` + `Service` ("Getclearsignal moving
  services"). Ready copy: *"Getclearsignal provides residential and commercial moving services in
  Toronto"*, FAQ *"How do I request a moving quote from Getclearsignal?"*, CTAs *"Get My Moving
  Quote"*.
- **Root cause is two failures meeting.**
  1. `inferObservedBusinessContext` (`lib/business-context.ts:202`) is not a general observer — it is
     a moving-company detector. Its location vocabulary is the fixed list
     `['Toronto', 'GTA', 'Ontario', 'Quebec', 'Canada']`; its service vocabulary is
     `Residential moving`, `Commercial moving`, `Condo moving`. It was written for the `az-moving`
     fixture, a Toronto mover, and never generalized. It can only ever see one business.
  2. The ClearSignal landing page illustrates the product with a mock AI answer about **movers in
     Toronto**. The observer read that marketing example as the audited business's own identity.
- **Operator-supplied `business_model` cannot save you.** `materialCategoryForContext`
  (`lib/materials.ts:32`) short-circuits only on `gallery` and `marketplace`; every other value falls
  through to a keyword match over text that includes `observed.inferred_business_type`. Set
  `saas_software` and the inferred "Moving service" still wins. The most reliable signal available —
  a human who confirmed what the business is — is discarded in favour of a regex over prose.
- **Scope: any site that mentions moving, relocation, or a Canadian city in any context.** A blog
  post, a case study, an agency listing the industries it serves ("we work with movers, clinics and
  SaaS") — all of it misclassifies the whole audit. The failure is silent and the deliverable is
  confidently wrong.
- This is `F1` from `TASKS_RELEASE_CUT.md` returning. That fix narrowed which text was sniffed but
  kept the mechanism: a bare keyword over prose deciding a vertical. `R3` is the same family.
- Fix, in order:
  1. **Operator-confirmed `business_model` wins outright** whenever it is not `unknown`. It is
     already collected on checkout and in admin.
  2. Delete the hardcoded Canadian locations and moving services from
     `inferObservedBusinessContext`. Observation must be vertical-neutral or it should abstain.
  3. When neither an operator value nor a confident observation exists, **abstain** — emit the
     generic `Organization` + `FAQPage` pair and say the category was not established. A missing
     category is invisible; a wrong one is a refund.
- Acceptance: a fixture whose page merely *mentions* movers or Toronto in an example does not become
  a moving company; an operator-set `business_model` overrides any inferred type; with no signal at
  all the report ships the generic pair rather than guessing.

- **Closed 2026-08-10.** Fixed in `0cc3c17` (observation made vertical-neutral; operator
  `business_model` now wins outright in `lib/materials.ts:32`), deployed as Trigger `20260810.1`.
  Verified by regenerating audit `28ca503b` at 14:53Z: `Business type / Service category /
  Observed locations` all report `Not observed`, delivered JSON-LD is the generic
  `Organization` + `FAQPage` pair, and the moving-service CTA copy is gone.

## R26 — Firecrawl serves cached pages, so an audit can measure a stale copy of the site (DO NOW)

- Seen: 2026-08-10. `getclearsignal.io` gained a canonical URL and `Organization` + `FAQPage`
  JSON-LD, both confirmed live with `curl`. Audit `28ca503b` was regenerated twice afterwards
  (`16:18Z`, `17:16Z`) and both runs reported `Structured data verified absent` and no canonical.
- Decisive evidence: both runs report **`8773 text characters observed`** — identical to the
  character an hour apart. Two independent scrapes of a live page do not agree that closely; the
  document was served from a store predating the deploy.
- The meta description found in the same runs does not contradict this: it was always on the page,
  so it only proves the `R25` head fix works.
- Root cause: `lib/firecrawl.ts` passes no cache controls. `@mendable/firecrawl-js@^4.16.0` exposes
  `maxAge`, `minAge`, `storeInCache` on scrape params and returns `cacheState` / `cachedAt`. We
  neither opt out of the cache nor record when it was used.
- Commercial harm: a paid audit is sold as point-in-time evidence about a site on a date. A client
  who implements our recommendations and re-orders would be told nothing changed, with our own
  report as proof — a refund conversation we would lose. It also breaks internal verification: we
  cannot confirm a landing change through our own product.
- Fix: pass an explicit freshness bound (prefer `maxAge: 0`), capture `cacheState`/`cachedAt`, and
  disclose a cached capture in the report's `Data limitations` block with its timestamp.
- Do not fix with a cache-busting query string — that audits a different URL than the canonical one.
- Spec: `TASKS_CRAWL_FRESHNESS.md`.

- **Closed 2026-08-10.** Fixed in `5a8cecb` (explicit `maxAge: 0` on every scrape, cache metadata
  threaded through, cached captures disclosed in `Data limitations`), test hardened in `ba6af93`,
  deployed as Trigger `20260810.4`. Verified by regenerating audit `28ca503b` at 18:06Z:
  `Structured data → present 99%`, `Canonical target → eligible`, `FAQ / Q&A → present 92%`, and
  `9385 text characters observed` against the cached runs' identical `8773` — a different document,
  i.e. a fresh fetch. No cache disclosure line appeared, matching `cacheState: 'miss'`.

## R25 — The crawler never captures `<head>`, so head-level signals are reported absent (LAUNCH BLOCKER)

- Seen: 2026-08-10, self-audit `28ca503b`. `OBS-META-001` says **"Meta description verified absent,
  85%"**. It is present — declared in `app/layout.tsx:11` and served in production (confirmed with
  `curl`).
- Root cause: `scrapePage` (`lib/firecrawl.ts:46`) requests Firecrawl's `html` format, which is
  cleaned main content with `<head>` stripped. The head-level format is `rawHtml`.
- Affects four checks over the same document: `meta_description` and `structured_data`
  (`lib/findings.ts:211,229`), plus `ELIG-INDEX-001` and `ELIG-CANONICAL-001`
  (`lib/geo/eligibility.ts:177,196`).
- **The noindex check fails open:** a page carrying an explicit `<meta name="robots" content="noindex">`
  in `<head>` is reported `eligible`. We would tell a customer AI crawlers can reach a page that is
  deliberately blocked.
- Trust-layer violation: `verified absent` is an assertive claim and it is false. Recommendation #3
  "Do now" and the generated meta-description draft are built on it, so a paying customer is told to
  add what they already have — falsifiable in ten seconds by viewing page source, by the SEO
  agencies that are the first ICP.
- Scales with client quality: the better-built the site, the more head-level signals we wrongly deny.
- Fix: request `rawHtml`; when no `<head>` is captured, report `unknown` with the reason — never
  `absent`, never `eligible`. Absence of evidence is not evidence of absence, in either direction.
- Do not fix by lowering the confidence number. The claim is the problem, not the score.
- Spec: `TASKS_HEAD_SIGNALS.md`.

- **Closed 2026-08-10.** Fixed in `a032c43` (`rawHtml` requested; no captured `<head>` now yields
  `unknown` instead of `absent`/`eligible`), deployed as Trigger `20260810.2`. Verified by
  regenerating audit `28ca503b`: `Meta description → detected present 97%`, quoting the live
  description, where the same page previously reported `verified absent 85%`.

## R29 — A public suffix is printed as a cited source

- **Closed 2026-08-20.** Fixed before this verification by using Public Suffix List registrable
  domains. Verified on Trigger `20260820.1` with both `9ba2d5ec` and `28ca503b`: every ranked,
  evidence, and source-gap domain was registrable; neither report contained a bare public suffix.

## R31 — The schema demands five fixes whether or not the evidence supports five

- **Closed 2026-08-20.** Fixed in `5f356dc`: action generation now accepts 3-10 fixes, asks for up
  to five evidence-backed fixes, retains the 18-word cap, and rejects blank or whitespace-only
  descriptions before sanitization. Verified on Trigger `20260820.1`: `9ba2d5ec` saved four fixes
  and `28ca503b` saved five, all with non-empty descriptions.

## R32 — An audit that failed deterministically once can never be retried

- **Closed 2026-08-20.** Fixed in `5f356dc`: automatic recovery still blocks current deterministic
  failures, while the admin exposes an explicit override that records timestamp and `admin operator`
  in `admin_notes`. Both stuck audits were released through the production endpoint and completed
  in `awaiting_review` on Trigger `20260820.1`.

## R14 — Dead write to a table that does not exist (low severity, instructive)

- Seen: 2026-08-05, while deleting test rows: `delete from audit_insights` returned
  `42P01: relation "audit_insights" does not exist`. The table is declared in
  `supabase/migrations/001_initial.sql:32` but was never applied to the production database.
- `lib/audit-runner.ts:849` upserts into it on every successful generation with no error check.
  The Supabase client returns `{ error }` instead of throwing, so the write has been a silent no-op
  for the life of the project. Nothing reads the table — no reader exists anywhere in `app/`,
  `lib/`, `trigger/` or `scripts/`.
- Impact: none functionally. Recorded because the *pattern* is the risk, not this instance: the
  same unchecked-write shape elsewhere would hide a real persistence failure. `lib/resend.ts:178`
  carries an explicit comment about this exact Supabase/Resend behaviour, so the class is already
  known here — it just slipped in this one call.
- Fix: delete the upsert and the migration block, or apply the migration and add an error check.
  Deleting is preferred: a table nobody reads is not worth a migration.
- Do not "fix" by adding the table. Add the error check pattern instead, wherever a write matters.

- **Closed 2026-08-12.** The dead `audit_insights` upsert and its migration block were deleted in
  `ced0f04`; `grep -rn audit_insights` now returns nothing outside `docs/archive/`. The unchecked-write
  pattern it warned about was swept separately in `30bfabe` (`lib/supabase-write.ts`).

## R23 — A failed admin query renders as "No audits yet" (DO NOW: looks like data loss)

- Seen: 2026-08-07. The admin list showed **"No audits yet"** with every audit missing, minutes after
  the owner started a new one. Nothing was lost: `R20` added `reviewer_note` to the select in
  `app/api/admin/audits/route.ts`, migration `012_audit_reviewer_note.sql` had not been applied to
  production, Postgres rejected the unknown column, and the route returned 500.
- `refreshAudits` in `app/admin/page.tsx` does `if (!res.ok) return []`. A 500 therefore leaves
  `audits` at its initial empty array and the page renders the empty state. **A broken query is
  indistinguishable from an empty database**, which is the single most alarming thing the operator
  can be shown, and it points at exactly the wrong cause.
- Two fixes, both small:
  1. Surface the failure. Keep the previous list if there is one, and show "Could not load audits"
     with the status code instead of the empty state. Never let an error render as absence.
  2. Migrations are applied by hand in this project — `audit_insights` from migration 001 was never
     applied either (`R14`). Any change that adds a column to a query must apply the migration in
     the same step, and the deploy checklist in `DEPLOY.md` should say so.
- Immediate unblock: `alter table audits add column if not exists reviewer_note text;`
- Acceptance: with the API returning 500, the admin shows an error, not "No audits yet".

- **Closed 2026-08-12** in `ced0f04`. A failed admin query renders an error with the status code and
  a retry, never the empty state; 401 and 500 are distinguished so a broken query no longer shows the
  login form; `/api/health` checks every column the admin query selects and names missing ones, and is
  part of the required set. Covered by `tests/admin-session-state.test.ts` and
  `tests/health-schema-check.test.ts`. The authenticated health response has not been read in
  production yet — the public one returns `status: ok`.

## R27 — One empty list in one brief destroys the whole audit (LAUNCH BLOCKER)

- Seen: 2026-08-14, audit of `vertexspain.com`. `Report validation blocked PDF export: empty_field at
  implementation_briefs.4.acceptance_criteria`, twice (the second is the recovery retry). No PDF, no
  web report, no partial delivery — after the run had already spent its API budget. The only missing
  content was the "Done when …" list in the fifth of five briefs.
- Root cause: three rules in `lib/report-validator.ts` disagree. The repair pass (`:908`) keeps a
  brief with a title and *either* steps or acceptance criteria; `validateActionUsability` (`:938`)
  errors only when both are empty; but `:977` errors whenever `acceptance_criteria.length === 0`.
  The shape one pass deliberately preserves, the next treats as fatal.
- `degradeValidationErrors` (`lib/audit-runner.ts:390`) cannot repair it: the error path ends in a
  field name, not an array index, so `removeArrayItemAtPath` misses and `setFallbackAtPath` cannot
  fill an empty list. Degradation runs, changes nothing, and `:806` throws.
- The retry is pointless and doubles the cost: `lib/audit-recovery.ts:41` treats every
  `Report validation blocked` as retryable, but this failure is deterministic.
- Commercial harm: a customer pays €149, the analysis is complete and usable, and they receive
  nothing. Withholding a correct report because one appendix lacks a checklist is worse than
  shipping the brief without it. Fires hardest on thin sites — exactly our buyers.
- Fix: empty `acceptance_criteria` on an otherwise usable brief is a warning; render the brief
  without that section; a degraded structural emptiness must save with the note in
  `validation_warnings` instead of throwing; do not retry an identical validation block.
- Never fix by having the model invent criteria, and do not weaken `validateStringArrayFields`.
- Spec: `TASKS_BRIEF_VALIDATION.md`.

- **Closed 2026-08-14** in `f9686ba`, deployed as Trigger `20260814.2`, verified by regenerating
  `beb637a8` (`vertexspain.com`), which completed and exported a 24-page PDF where the previous run
  failed. Note the fallback branch itself was not exercised by that run: the model returned complete
  acceptance criteria for all five briefs. It is covered by tests, not yet by a production run.

## R28 — Answer-engine aliases are listed as competitors

- **Closed 2026-08-20** in `afa20b5` and `6dcb5ac`, deployed as Trigger `20260820.3`. Inferred
  competitor names are filtered by vendor/product tokens, while single-token names still require an
  exact engine-name match and operator-supplied competitors still win. The same filter is applied
  when saved GEO evidence is reused, which was the residual path found during production
  verification. Final regenerations of `9ba2d5ec` and `28ca503b` contained only `Crunchbase` and
  `Brandwatch`/`Siftly` respectively; no answer-engine name remained in visibility or evidence.

## R33 — A fresh queued audit can be enqueued twice by recovery

- **Closed 2026-08-20** in `afa20b5`, deployed as Trigger `20260820.2` and carried by
  `20260820.3`. Migration `013_audit_queued_at.sql` was applied before the code shipped. Every
  server-side transition into `queued` records `queued_at`; recovery uses the same 20-minute age as
  stale processing and safely falls back to `last_generated_at` or `created_at` for older rows.
  Concurrent production requeues of `9ba2d5ec` and `28ca503b` both completed with
  `recovery_attempts = 0` and no recovery note or duplicate generation.

## R34 — The cost guard watches one audit at a time and is blind to volume

- **Closed 2026-08-21** in `8247da2`, deployed on Vercel and as Trigger **`20260821.1`**.
  Production migration `014_daily_ai_spend_guard.sql` is applied with RLS enabled. The shared
  enqueue/task-start guard sums the current UTC day's persisted AI-call cost, blocks at the `$5.00`
  default cap (or `DAILY_AI_SPEND_CAP_USD`), leaves the audit queued, and claims one alert per day.
  Trigger uses `AbortTaskRunError` only for the existing deterministic-failure class; transient
  failures retain `maxAttempts: 2`. Admin and authorized health surfaces report the same aggregate,
  including recovery and platform-retry calls.
