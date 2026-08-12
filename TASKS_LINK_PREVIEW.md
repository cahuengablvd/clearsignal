# TASKS_LINK_PREVIEW — every shared link renders as a blank grey card

Landing/metadata only. No engine changes, **no Trigger deploy**.

## The problem

The site has no Open Graph or Twitter Card tags at all, and no page below the root has its own
title:

```
curl -s https://getclearsignal.io/sample | grep -o '<meta property="og:[^>]*>'   # nothing
curl -s https://getclearsignal.io/sample | grep -o '<title>[^<]*</title>'
<title>ClearSignal - Expert-reviewed AI Visibility Audit</title>
```

So a link pasted into LinkedIn, a DM, Slack or an email client renders as a grey card with the same
generic title regardless of which page was shared. Outreach is the only channel this product has
right now, and every link in it currently looks unfinished.

## Fix

1. Add an `openGraph` (and `twitter`) block to the root `metadata` in `app/layout.tsx`, reusing
   `SITE_DESCRIPTION` from `lib/site-description.ts` so the text cannot drift from the meta
   description. `metadataBase` is already set, so relative image paths resolve.
2. Give each public route its own `title` and `openGraph.title`/`description`: `/sample`, `/score`,
   `/checkout`, `/terms`, `/privacy`, `/refund`. A shared `/sample` link must say it is a sample
   report, not repeat the homepage title. Follow the per-route pattern already established for
   `alternates.canonical` in `docs/archive/TASKS_CANONICAL_PER_PAGE.md`.
3. Add a static share image at `public/og.png`, 1200x630, referenced from the root `openGraph.images`
   with explicit `width`, `height` and `alt`. Build it from real report UI — a cropped panel of an
   actual report — not stock illustration or abstract AI art. If a real crop cannot be produced in
   this task, ship a plain typographic card (product name + one line of positioning) rather than a
   placeholder graphic, and note it for replacement.
4. Private, token-addressed routes (`/audit/[id]`, `/score/[id]`) must **not** gain Open Graph tags
   or share images. Those URLs carry a signed token; a rich preview would render a client's report
   details inside whatever chat app the link is pasted into. Keep them bare.

## Acceptance

- `npm run build`, then grep the built HTML: `index.html` contains `og:title`, `og:description`,
  `og:image`, `og:url` and `twitter:card`; `sample.html` contains an `og:title` that differs from the
  homepage's.
- `.next/server/app/index.html` contains no `og:` tag whose content is an empty string.
- A test asserts `/audit/[id]` metadata carries no `openGraph` block.
- `public/og.png` is 1200x630 and under 1 MB.
- `npx tsc --noEmit` and the full vitest suite pass.

## Verification after deploy

`curl -s https://getclearsignal.io/sample | grep 'og:'` returns the sample-specific title, and
pasting the URL into LinkedIn's Post Inspector renders a card with an image.
