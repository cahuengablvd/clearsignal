# Input quality — the engine is only as good as what it was told

Four defects found on 2026-08-05 by the pre-launch verification audits, all the same class: the
pipeline behaves confidently on inputs it never actually received. `R12`, `R13`, `R15`, `R16` in
`DEFECTS_BACKLOG.md`.

The verification worked exactly as intended — it found what tests could not, because tests do not
scrape live sites and do not read reports as a customer would.

## Order

`P0` items either spend money on nothing or put a false statement in front of a paying customer.
`P1` items degrade a paid section without lying. Ship in order; each starts with a failing test.

---

## P0.1 — Stop before paying to audit a bot-challenge page (R15)

Audit `7590982c` for `salidzini.lv` was generated from a Cloudflare browser-verification
interstitial. The scrape returned HTTP 200 with markdown, so nothing objected. Every on-page
finding in that report describes a challenge screen.

**Detect after scraping, before any paid stage**, in both `lib/score-runner.ts` and
`lib/audit-runner.ts`:

- Vendor and challenge markers: Cloudflare (`Just a moment`, `Checking your browser`,
  `cf-browser-verification`, `Ray ID`, `Performance & security by Cloudflare`,
  `Attention Required`), Akamai, PerimeterX, DataDome, Imperva/Incapsula (`Incapsula incident ID`),
  Sucuri; plus `verify you are human`, `enable JavaScript`, `please enable cookies`.
- **A length floor, required together with a marker.** Markers alone false-positive: a hosting
  company or an agency legitimately writes about Cloudflare at length. A challenge page is short.
  Require marker AND body below a plausible-homepage threshold. Pick the threshold from real data —
  `monokelriga.lv` scraped 8,016 characters and was called substantive; a challenge page is
  hundreds.
- Very short body with no marker is a separate, softer state: "not enough readable content",
  same stop, different message.

**On detection:**

- **Free score:** fail with the honest reason. The runner already fails when the scrape returns
  nothing (`lib/score-runner.ts:51`); this is the same class with a better message.
- **Paid audit:** stop before the paid stages, leave the audit in an operator-visible state, and do
  not spend the ~$1.06. The customer has already paid, so this cannot fail silently — a human
  decides whether to ask the customer for crawler access, refund, or proceed knowingly.
- **Admin preview:** state it prominently. Do not present generated queries as informed by the page.

**Do not try to defeat the protection.** No second scrape with different headers, no rendering
tricks. The customer owns the site and can allowlist our crawler; that is a request, not a bypass.

## P0.2 — A WAF challenge is an AI-visibility finding, not just an error (R15, second half)

The same report says **"OpenAI / ChatGPT Search crawler access: eligible — No matching robots.txt
disallow rule was observed"** while the page served a challenge. `crawlerAllowed`
(`lib/geo/eligibility.ts:68`) parses `robots.txt` only; it cannot see the WAF layer. The section is
accurate about the rule it checked and misleading about the question it appears to answer.

- When a challenge was observed, the eligibility section must say so and must not report `eligible`
  on robots.txt grounds alone.
- Frame it observationally, never causally: *our crawler received a browser-verification challenge
  at this URL; answer-engine crawlers may receive the same.* Do **not** assert that Cloudflare
  blocked GPTBot — we did not measure that.
- This is plausibly the single most valuable finding such a customer can get, so it belongs in the
  findings, not only in an error state.

## P0.3 — Pre-fill the intake draft (R12)

Detail is already specified in `TASKS_INTAKE_DRAFT.md` and unchanged by this batch. Note the
interaction: on a challenge page there is nothing to draft from, so `P0.1` must run first and the
"we could not read your site" state must win over the draft.

---

## P1.1 — Wire markets/languages into query generation, and structure the language part (R13)

`target_markets_languages` is collected on checkout and in admin, stored, and displayed — and never
reaches `geoQueriesUserPrompt` (`lib/prompts.ts:81`), which receives only brand, page snippet, ICP
and count. The operator wrote "Latvian and Russian" for a Riga clinic and got six English queries.
What sets the language today is the scraped page snippet, which the model mirrors by accident.

- Pass markets and languages into the query prompt.
- Make the language part **structured** — a multi-select from a closed list — so the instruction can
  be deterministic ("write N queries in Latvian and N in Russian") instead of hoping a sentence is
  interpreted. Market/city stays free text; it is an open set.
- Structured input also fixes the owner's complaint that typing this on a phone is painful, but
  reliability is the reason, not typing.

## P1.2 — Make intent classification language-proof (R16)

`salidzini.lv` reports `Other: 6 queries`; the clinic reports `Comparison: 1, Other: 5`. The whole
"Visibility by buyer intent" section collapses because `classifyQueryIntent`
(`lib/geo/query-taxonomy.ts`) matches English regexes only and everything else falls to `other` at
line 49. The section is not wrong, it is empty — worse in a paid deliverable, because it reads as
analysis.

Preferred fix: **carry the intent from the query-plan slot the generator was asked to fill**, rather
than re-deriving it from the query text afterwards. It is cheaper than per-language vocabularies and
cannot rot as languages are added. Keep the text classifier as a fallback for operator-supplied
queries that arrived without a slot.

This is now load-bearing: `P1.2` of the previous batch asks the generator to cover specific intents,
and the coverage check that verifies it runs through this same classifier.

---

## Do not

- Do not weaken any trust-layer rule to make these pass. `R15` was *found* because the report
  honestly described what it saw; that behaviour stays.
- Do not add a report section, an engine, a monitoring feature, or a rename.
- Do not "improve the prompt" in place of supplying missing input. Three of these four defects are
  missing-input problems wearing a prompt-quality mask.
- Do not auto-retry a challenge page or bypass bot protection.

## Tests

- Fixture: scraped markdown that is a Cloudflare interstitial → no finished report; the operator
  sees why; no paid stage runs.
- Fixture: long legitimate page that *mentions* Cloudflare → audits normally (guards the
  false-positive).
- Fixture: challenge observed → eligibility section does not report `eligible` from robots.txt
  alone, and the wording stays observational.
- Fixture: two configured languages → queries in both; removing the field changes the output,
  proving it is wired.
- Fixture: Latvian and Russian query sets → intents spread across buckets, not one `other`.

## Acceptance

A site behind bot protection never yields a confident report about a challenge screen, and its owner
learns something genuinely useful instead. A customer who says which market and languages they sell
into gets queries in those languages. The buyer-intent section carries real distribution in Latvian
and Russian, not a single bucket.
