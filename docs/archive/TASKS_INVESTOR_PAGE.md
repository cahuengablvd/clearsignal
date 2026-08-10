# Rewrite `/investor` to match the current strategy (Codex task)

**File:** `app/investor/page.tsx` (319 lines) on `main`, latest commit. Frontend copy/content only.
Do not touch backend, the audit engine, admin, Supabase, Trigger, Stripe or `app/page.tsx`.

## Why
The page is stale. It sells **weekly monitoring as the destination**, which the July 2026
`DECISION_MEMO.md` explicitly killed (monitoring is a red ocean: Otterly $29, Peec €89, Semrush
$99, Ahrefs up to $828/mo). It also contradicts the live landing page. An investor reading the deck
and then this page sees two different companies.

Concrete contradictions to fix:
- `roadmap[0]` says **"€399 AI Visibility Audit"** — the landing sells **€149** (founding, first 20).
  Two different prices on two of our own pages.
- `roadmap[1]` says **"€99/mo Weekly Monitoring"** as "Next" — that offer is deprioritized.
- `proofPoints` says **"Weekly monitoring MVP deployed"** — the landing says monitoring is
  "coming soon".
- Thesis heading: *"A services wedge into recurring visibility monitoring."*
- `demoLinks` labels the monitoring demo *"Recurring SaaS loop"*.

**Keep the page structure** (nav, hero, how-it-works, thesis, demo links, proof points) and its
visual style. This is a content/copy rewrite, not a redesign.

## Global rules
- **No em-dashes or en-dashes** (`—`, `–`, `&mdash;`, `&ndash;`) anywhere. Use a comma or a middot `·`.
  Normal hyphens in compound words are fine.
- No invented metrics. Every number must come from this document.
- No guaranteed-ranking or revenue-impact language.
- Typecheck + build must pass.

---

## 1. Metadata, and keep it out of search
```ts
export const metadata: Metadata = {
  title: 'ClearSignal — Investor walkthrough',   // (use a normal hyphen or rephrase; no em-dash)
  description: 'Investor walkthrough for ClearSignal: expert-reviewed AI visibility audits, the evidence chain, and the path from service to product.',
  robots: { index: false, follow: false },
}
```
The `robots` addition is required: this page should not be indexed.

## 2. Hero
- H1: **"When buyers ask AI who to choose, does it recommend you, or your competitor?"**
- Sub: **"Expert-reviewed AI visibility audits. We test how ChatGPT, Claude and Perplexity recommend a business, show why competitors appear instead, and turn the evidence into a plan the team can ship."**
- Add a small honest badge near the top: **"Pre-seed · Pre-revenue · July 2026"**.

## 3. Thesis section (replace the monitoring wedge)
Replace the `<h2>` *"A services wedge into recurring visibility monitoring."* with:

**"The audit is the entry product, not the business model."**

Supporting paragraph:
> Every tool in this category measures. None of them prescribe, and none of them record whether the
> prescription worked. That gap is the product, and the data it produces is the asset.

## 4. `roadmap` — reframe as the service-to-product path
Replace the array entirely. This is the deck's narrative:

```ts
const roadmap = [
  ['Now', '€149 expert-reviewed audit', 'First revenue and, more importantly, labelled data: the gap we found and the fix we prescribed.'],
  ['Next', 'Policies and validators', 'Repeated decisions harden into rules and templated briefs. Manual review time per audit falls.'],
  ['Then', 'The evidence chain compounds', 'Buyer query, AI answer, cited source, website gap, prescribed fix, outcome. Nobody else records the last two links.'],
  ['Later', 'Monitoring and re-scan', 'The continuation of a workflow that already proved itself, not another generic dashboard.'],
]
```

## 5. `proofPoints` — true statements only
Replace the array. Remove "Weekly monitoring MVP deployed" (it contradicts the landing).

```ts
const proofPoints = [
  'Free score and paid audit live end to end: checkout, payment, generation, human review, delivery',
  'Deterministic mention and citation detection',
  'Raw AI answer evidence stored per query',
  'Transparent score formula',
  'Trust layer: no invented numbers, no guaranteed rankings, human review before delivery',
  'Measured in beta: $0.17 to $0.25 AI cost and roughly 1 hour of manual QA per audit',
  'Paid report and PDF protected by signed links',
]
```

## 6. `demoLinks` — honest labels
```ts
const demoLinks = [
  { label: 'Live landing', href: '/', desc: 'Positioning and conversion path' },
  { label: 'Sample audit', href: '/sample', desc: 'The paid deliverable, with evidence' },
  { label: 'Try free score', href: '/score', desc: 'The front door: run it on any site' },
  { label: 'Monitoring prototype', href: '/monitoring/sample', desc: 'Built, deliberately not sold yet' },
]
```
The monitoring link stays (it is real and shows capability) but must **not** be framed as a
"Recurring SaaS loop" or a current offer.

## 7. Add an honest status section (new, before the proof points)
Heading: **"Where it stands."** Two columns.

**What exists**
- Free score and paid audit, live end to end
- Payment, delivery and human review gate working
- Trust layer: no invented numbers, no guaranteed rankings
- Landing, pricing and legal shipped

**What does not**
- Zero paying customers today
- No repeat data, no case studies yet
- Manual review still roughly 1 hour per audit
- No company, solo founder, Latvia

Then one line: **"The ask is feedback and two or three introductions to agencies who would run a founding audit. Not capital, not yet."**

This section is the point of the page. Do not soften it.

## Acceptance
- `grep -nE '&mdash;|&ndash;|—|–' app/investor/page.tsx` returns nothing.
- No "€399" as the current price, no "€99/mo", no "Weekly monitoring MVP deployed", no
  "recurring visibility monitoring" thesis anywhere on the page.
- `robots: { index: false, follow: false }` present in metadata.
- The "Where it stands" section renders with both columns and the ask line.
- Page layout and styling unchanged in structure; typecheck and build green.
