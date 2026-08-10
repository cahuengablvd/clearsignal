# TASKS_CANONICAL_PER_PAGE — canonical points every page at the homepage

Follow-up to `docs/archive/TASKS_LANDING_TRUST.md`. Landing/metadata only, no engine changes, no
Trigger deploy.

## The failure

`app/layout.tsx:14` sets `alternates: { canonical: '/' }` in the **root** layout, and no child route
overrides it. Every public page therefore emits the same canonical. Confirmed in the production
build:

```
.next/server/app/sample.html   <link rel="canonical" href="https://getclearsignal.io"
.next/server/app/terms.html    <link rel="canonical" href="https://getclearsignal.io"
.next/server/app/checkout.html <link rel="canonical" href="https://getclearsignal.io"
```

This tells search engines and AI crawlers that `/sample`, `/terms`, `/refund`, `/privacy` and
`/checkout` are duplicates of the homepage and should be dropped from the index. `/sample` is the
most-linked asset in the sales process — every outreach email points at it (`R21`). We would be
deindexing our own sales asset.

## Fix

Give each public route its own canonical. Either declare `alternates.canonical` in that route's
`metadata`, or make the root value relative so Next resolves it per path — pick one approach and
apply it consistently; do not leave both.

- Public routes that need a self-referencing canonical: `/`, `/sample`, `/score`, `/checkout`,
  `/terms`, `/privacy`, `/refund`.
- Per-audit and per-score pages (`/audit/[id]`, `/score/[id]`) are private, token-addressed and must
  **not** gain a canonical. Do not add one.
- `/admin` and `/investor` must not become more indexable than they are today. Do not change their
  indexing posture in this task.

## Also in this task (copy, one line)

`app/page.tsx`, hero paragraph, now says the same thing twice:

> "... Every full report is reviewed by a person before delivery. Alexander Kalinko reviews the
> evidence, factual claims and recommendations before each full report is sent."

Drop the first sentence. The named version is strictly stronger; the impersonal one is what the
audit flagged as unanchored.

## Acceptance

- A test asserts that `/` and `/sample` emit different canonical URLs, each matching its own path.
  It must fail against the current code.
- `npm run build`, then grep the built HTML: `.next/server/app/sample.html` contains
  `href="https://getclearsignal.io/sample"`, `terms.html` contains `/terms`, `index.html` contains
  the bare origin.
- No canonical tag appears on `/audit/[id]` or `/score/[id]`.
- `npx tsc --noEmit` and the full vitest suite pass.
