# TASKS_HEAD_SIGNALS — the crawler never sees `<head>`, so head-level signals are reported absent

**Defect:** `R25` (LAUNCH BLOCKER — customer-visible false claim).
**Touches the audit engine → requires a Trigger.dev deploy from `C:\csdeploy`. See `DEPLOY.md`.**

## The failure

Self-audit `28ca503b` (2026-08-10) states:

> **OBS-META-001 — Meta description — verified absent — 85%**
> How checked: No non-empty `<meta name="description">` in the rendered HTML

The meta description is present. It is declared in `app/layout.tsx:11` and served in production:

```
curl -sL https://getclearsignal.io/ | grep -o '<meta name="description"[^>]*>'
<meta name="description" content="ClearSignal tests real buyer questions across ChatGPT, ..."/>
```

## Root cause

`scrapePage` (`lib/firecrawl.ts:46`) requests `formats: ['markdown', 'html']`. Firecrawl's `html`
format is **cleaned main content** — `<head>` is stripped. The correct format for head-level
signals is `rawHtml`.

Every consumer of that HTML therefore evaluates a document with no `<head>`:

| Consumer | Check | Wrong result |
|---|---|---|
| `lib/findings.ts:229` | `<meta name="description">` | `absent` at 85% confidence |
| `lib/findings.ts:211` | `application/ld+json` | `absent` at 88% — JSON-LD is commonly in `<head>` |
| `lib/geo/eligibility.ts:196` | `<link rel="canonical">` | `warning`, "no canonical detected" |
| `lib/geo/eligibility.ts:177` | `<meta name="robots" content="noindex">` | **`eligible` when the page is actually noindex** |

The noindex row is the dangerous one: it fails *open*. We would tell a customer their page is
eligible for AI crawlers while it carries an explicit `noindex`.

## Why this is a launch blocker

1. It breaks the trust layer. `verified absent` is an **assertive** claim, not observational, and it
   is false. `CLAUDE.md` forbids exactly this.
2. Recommendation `#3` "Do now" and the generated meta-description draft are built on the false
   finding. A €149 customer is told to add what they already have.
3. It is falsified in ten seconds by viewing page source — by SEO agencies, the first ICP.
4. It scales with customer quality: the better-built the client site, the more head-level signals we
   wrongly deny.

## Fix

1. In `scrapePage`, request `formats: ['markdown', 'rawHtml']` and return `result.rawHtml`. Keep the
   returned field named `html` so callers are unchanged, or rename it consistently — do not leave
   two half-migrated names.
2. If Firecrawl returns `rawHtml` empty but `html` non-empty, **fall back to `html` and mark the
   head-level checks `unknown`, not `absent`.** A missing `<head>` in the crawl is not evidence of a
   missing tag.
3. Introduce that distinction in `lib/findings.ts`: when the crawled document contains no `<head>`
   element at all, head-level findings (`meta_description`, `structured_data`) must report
   `manual verification` / `unknown` with a basis line saying the head was not captured — never
   `verified absent`.
4. Same rule in `lib/geo/eligibility.ts` for `ELIG-INDEX-001` and `ELIG-CANONICAL-001`: no `<head>`
   captured ⇒ `unknown`, with the reason stated. Never `eligible` on absence of evidence.

Do not "fix" this by lowering the confidence number. The problem is the claim, not the score.

## Acceptance

Each starts as a failing test.

- A fixture whose HTML contains `<head><meta name="description" content="x"></head>` yields
  `meta_description: present`. (Fails today.)
- A fixture with JSON-LD inside `<head>` yields `structured_data: present`.
- A fixture with `<head><meta name="robots" content="noindex"></head>` yields
  `ELIG-INDEX-001: blocked`. (Fails today — returns `eligible`.)
- A fixture with `<link rel="canonical" href="...">` in `<head>` yields `ELIG-CANONICAL-001:
  eligible` when it matches the audited URL.
- A fixture with **no `<head>` element at all** yields `unknown` for all four checks, and the
  rendered report contains neither the string `verified absent` nor `eligible` for them.
- `npx tsc --noEmit`, `npm run build`, full vitest suite pass.

## Verification after deploy

Deploy Trigger from `C:\csdeploy`, then Regenerate audit `28ca503b` and confirm:
`Meta description → present`, `Index directives → eligible` (our page has no noindex, but now for
the right reason), and that recommendation `#3` no longer claims the meta description is missing.

Note: JSON-LD and canonical really are absent on `getclearsignal.io` — those two findings should
stay `absent`/`warning` after the fix. That is handled separately in `TASKS_LANDING_TRUST.md`; do
not touch the landing page in this task.
