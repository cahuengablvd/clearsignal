# Defects backlog — open

Process: defects found in real audits land here (date, audit/vertical, field path, quoted
text, proposed fix). Fixed in batches — each fix starts with a failing fixture test.

Closed defects (R1–R12, R15, R17, R24–R26) are in `docs/archive/DEFECTS_CLOSED.md`. Do not read that file
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

## R28 — The engines we test are listed as "who AI recommends instead" (customer-visible)

- Seen: 2026-08-14, audit `9ba2d5ec` (`snoika.com`). The block reads
  `ChatGPT 50% · Perplexity 25% · Google AI Overviews 17% · Gemini 17% · Ahrefs 8% · SEMrush 8%` —
  four of six rows are the answer engines themselves. Same shape in our own audit `28ca503b`.
- Cause: competitor discovery (`lib/geo/index.ts:216`) extracts brand names from answers that are
  full of engine names; the dedupe at `:227` excludes only the audited brand and the operator's
  list. Nothing excludes the engines under test, whose names are in our own config.
- Reads to a client as "AI recommends ChatGPT instead of you" — not a competitive finding, in the
  most-read table of the report. Worst in the AI-visibility category, i.e. our own vertical.
- Fix: exclude engines under test and their vendor product names, built from the existing engine
  registry, matched case/punctuation-insensitively. Do not exclude general SEO vendors (Ahrefs,
  Semrush) — for an SEO product they are real competitors. An operator-supplied name always wins.
- Spec: `TASKS_COMPETITOR_HYGIENE.md`.

## R29 — A public suffix is printed as a cited source

- Seen: 2026-08-14, audit `9ba2d5ec`. "Sources AI cites most" lists **`co.uk` 2x** beside real
  domains. `co.uk` is a public suffix; the real host was truncated to it, so the row is wrong and
  the reader cannot open it.
- Same family as the `R19` addendum (`Com` at 15% from `com.mt`), one block over: that fix covered
  competitor names, not `cited_domains_ranked` (`lib/geo/index.ts:322`).
- Fix: a registrable domain is at minimum `label + suffix`; anything reducing to a bare suffix must
  not become a row. Prefer the full host from the citation URL. If the host cannot be recovered,
  drop the row — a missing source is invisible, a fake one is the first thing a reader sees.
- Spec: `TASKS_COMPETITOR_HYGIENE.md`.

## R30 — A third of engine-query combinations failed in one run (observation, unexplained)

- Seen: 2026-08-14, audit `9ba2d5ec`: 12 of 18 combinations successful, 6 failed or skipped. Our own
  `28ca503b` failed 3 of 18 in the same period.
- Not yet diagnosed. The report discloses the count honestly, so this is a coverage-quality issue,
  not a correctness one — but a third of the measurement missing weakens every rate in the report.
- Next step when picked up: identify from the run logs whether one engine drops out systematically
  (rate limit, timeout, provider error) or the failures are spread.

## R31 — The schema demands five fixes whether or not the evidence supports five (LAUNCH BLOCKER)

- Seen: 2026-08-18. `9ba2d5ec` (`snoika.com`) failed — two `top_fixes` came back without the
  required `description`, Zod rejected the payload, the audit is `failed`. `beb637a8`
  (`vertexspain.com`) survived the same shortage because the model emitted `description: ""`, which
  passes Zod and is then dropped by the sanitizer (4 fixes shipped).
- Three requirements cannot all hold on a thin site: `min(5)` fixes (`lib/schemas.ts:657`), a
  non-optional `description` (`:628`), and the 18-word cap from the plain-language pass
  (`lib/prompts.ts:508`). The model must invent a fifth fix; with filler banned it returns an empty
  string or omits the key.
- The defect is `min(5)`, not the word limit. A fixed number of findings is a demand to invent when
  evidence runs out — the thing the product refuses to do everywhere else (see
  `docs/archive/TASKS_VERTICAL_TRUTH.md`: abstain rather than guess).
- Fix: floor of three, prompt asks for "up to 5, only evidence-backed", and `description` must be
  `.min(1)` so emptiness fails loudly instead of silently becoming a dropped fix.
- Spec: `TASKS_FIX_COUNT.md`.

## R32 — An audit that failed deterministically once can never be retried

- Seen: 2026-08-18. `28ca503b` never reached the model: recovery read the previous deterministic
  failure marker in `admin_notes` and stopped (`lib/audit-recovery.ts:39`).
- The rule is right — a failure that will repeat should not be retried automatically. But nothing
  clears the marker once the cause is fixed and deployed, and the admin has no control to say "the
  cause is fixed, run it again". The audit is stuck permanently.
- Fix: an explicit operator action that clears the marker and requeues one audit, recorded in
  `admin_notes`. Automatic recovery keeps refusing; this is a human override, not a loosened rule.
- Spec: `TASKS_FIX_COUNT.md`.

