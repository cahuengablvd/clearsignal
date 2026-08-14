# TASKS_COMPETITOR_HYGIENE — the most-read table prints things that are not competitors

**Defects:** `R28` (tested engines listed as competitors) and `R29` (public suffix printed as a cited
source). Touches `lib/geo/*`, so it **needs a Trigger deploy from `C:\csdeploy`.**

Both appear in the two blocks a reader looks at first — "Who AI recommends instead" and "Sources AI
cites most". Both are visible in delivered reports today.

## R28 — the engines we tested are listed as who AI recommends instead

Audit `9ba2d5ec` (`snoika.com`, 2026-08-14), "Who AI recommends instead":

```
ChatGPT 50% · Perplexity 25% · Google AI Overviews 17% · Gemini 17% · Ahrefs 8% · SEMrush 8%
```

Four of six rows are the answer engines themselves. The same list appeared in our own audit
`28ca503b` (`ChatGPT 60% · Perplexity 47% · Gemini 40% · Claude 33% · Copilot 20% · Google AI
Overviews 13%`).

Cause: competitor discovery (`lib/geo/index.ts:216`) asks the model to name competing brands from
the answers, and in this category the answers are full of engine names. The dedupe at `:227` only
excludes the audited brand and names already in the operator's list. Nothing excludes the engines we
are testing — whose names we control, in our own config.

For a reader this reads as "AI recommends ChatGPT instead of you", which is not a competitive
finding. It is worst precisely in the AI-visibility category, i.e. our own vertical and every
prospect that sells anything adjacent to it.

**Fix:** exclude the engines under test and their vendors from competitor discovery and from
`competitor_visibility`. Build the exclusion from the engine registry that already exists rather
than a new hardcoded list, and cover the obvious product names of those vendors (ChatGPT, Claude,
Perplexity, Gemini, Copilot, Google AI Overviews, AI Mode). Match case- and punctuation-insensitively,
as `R19` requires.

Do **not** exclude general SEO vendors such as Ahrefs or Semrush: for an SEO product they can be
genuine competitors. The rule is "an engine we queried", not "a well-known tool".

## R29 — `co.uk` is printed as a cited source

Same audit, "Sources AI cites most":

```
substack.com 3x · discoveredlabs.com 2x · seo.com 2x · aiadvantageagency.com 2x · co.uk 2x
```

`co.uk` is a public suffix, not a domain. A real domain was truncated to its suffix, so the row is
both wrong and untraceable — the reader cannot visit it, and we lost which source was actually
cited.

This is the `R19` addendum (`Com` at 15% from `com.mt`) in a different block: the earlier fix, if
applied, covered competitor names, not `cited_domains_ranked` (`lib/geo/index.ts:322`).

**Fix:** normalise cited domains against a public-suffix rule before counting. A registrable domain
is at minimum `label + suffix`; anything that reduces to a bare suffix (`co.uk`, `com.mt`, `com.au`,
`co.jp`) must not become a row. Prefer keeping the full host from the citation URL over a derived
short form — the reader needs something they can open.

If the original host cannot be recovered for a given citation, drop the row. A missing source is
invisible; a fake one is the first thing a reader notices.

## Acceptance

Each starts as a failing test.

- A fixture whose answers name ChatGPT, Claude and Perplexity yields no competitor rows for those
  names, while a genuine competitor in the same answers still appears. (Fails today.)
- A fixture whose operator-supplied competitor list contains an engine name still shows it — an
  explicit operator choice wins over the exclusion.
- A fixture citing `https://example.co.uk/post` yields `example.co.uk`, never `co.uk`.
- A fixture citing `https://news.example.com.mt/x` yields a registrable domain, never `com.mt`.
- The `R19` regressions stay green: one company under two name forms still merges, and `com.mt`
  still never produces a competitor named `Com`.
- `npx tsc --noEmit`, `npm run build`, full vitest suite pass.

## Verification after deploy

Regenerate audits `9ba2d5ec` (snoika) and `28ca503b` (our own). Neither "Who AI recommends instead"
may contain an engine name, and no cited-source row may be a bare public suffix.

## Noted, not in scope

The same snoika run tested 12 of 18 combinations — 6 failed or skipped, a third of the set. Our own
run failed 3 of 18. Worth a look at which engine drops out and why, but do not investigate it inside
this task; record what you observe in `DEFECTS_BACKLOG.md` if the cause is obvious from the logs.
