# TASKS_CRAWL_FRESHNESS — the audit can measure a stale copy of the client's site

**Defect:** `R26`. Touches the audit engine → **requires a Trigger.dev deploy from `C:\csdeploy`.**

## Evidence

`getclearsignal.io` gained a canonical URL and an `Organization` + `FAQPage` JSON-LD block, deployed
and confirmed live:

```
curl -s https://getclearsignal.io/ | grep -c 'application/ld+json'   # 1
curl -s https://getclearsignal.io/ | grep -o 'rel="canonical"[^>]*'  # present
```

Audit `28ca503b` was regenerated twice afterwards, at `16:18Z` and `17:16Z`. Both reported:

- `OBS-SCHEMA-001 — Structured data — verified absent — 88%`
- `ELIG-CANONICAL-001 — No canonical URL was detected in the captured document head`
- `Crawlable rendered content — **8773 text characters observed**` — **byte-identical between the
  two runs, an hour apart.**

Two independent scrapes of a live page do not agree to the character. The crawler was served a
stored copy predating the deploy. The meta description found in the same runs was always on the
page, so it does not contradict this — it only proves the `R25` head fix works.

## Root cause

`scrapePage` and `scrapeUrl` (`lib/firecrawl.ts`) pass no cache controls. The installed client
(`@mendable/firecrawl-js@^4.16.0`) exposes `maxAge`, `minAge` and `storeInCache` on scrape params,
and returns `cacheState: 'hit' | 'miss'` with `cachedAt` on the response. Firecrawl serves cached
content by default; we neither opt out nor record that it happened.

## Why this matters commercially

A paid audit is sold as point-in-time evidence about a specific site on a specific date. Today it
can silently describe an older version of that site. The failure mode that will actually be seen:
a client implements our recommendations, orders a re-audit, and is told nothing changed — with our
own report as the evidence. That is a refund conversation, and we would be wrong.

It also invalidates the fix loop we depend on internally: we cannot verify a landing change through
our own product.

## Fix

1. Pass an explicit freshness bound on every scrape used for an audit. Prefer a fresh fetch:
   `maxAge: 0`. If cost or rate limits argue for a small window, make it a named constant with the
   reason written next to it — not an implicit default.
2. Capture `cacheState` and `cachedAt` from the response and thread them through with the scraped
   page.
3. **Surface it in the report.** When the page came from cache, the crawl-related data limitation
   must say so and give the capture time: the report already carries a `Data limitations` block, and
   this belongs there in the same observational voice as the rest. A report that measures a snapshot
   must say when the snapshot was taken.
4. Free-score scrapes (`scrapeUrl`) may keep using cache if that materially reduces cost — but the
   same disclosure rule applies wherever a user-visible claim is derived from it.

Do not fix this by adding a cache-busting query string to the target URL. That changes the URL we
audit, can miss the canonical page, and may be blocked or redirected by the client's CDN.

## Acceptance

- A test asserts the scrape params passed to Firecrawl carry an explicit freshness bound; it fails
  against the current code.
- A test with a mocked `cacheState: 'hit'` response produces a data-limitation line naming the
  capture time; with `cacheState: 'miss'` no such line appears.
- `npx tsc --noEmit`, `npm run build`, full vitest suite pass.

## Verification after deploy

Deploy Trigger from `C:\csdeploy`, regenerate audit `28ca503b`, and confirm:
`Structured data → present (Organization, FAQPage)` and `Canonical target → eligible`. Both are
verifiably live on `getclearsignal.io` today, so anything else means the page is still not being
fetched fresh.
