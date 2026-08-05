# Defects backlog

Process: defects found in real audits land here (date, audit/vertical, field path, quoted
text, proposed fix). Fixed in batches — each fix starts with a failing fixture test. R1 is
the exception: it is unmet F9 acceptance (a wrong headline metric), so it ships BEFORE the
20-audit run.

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
