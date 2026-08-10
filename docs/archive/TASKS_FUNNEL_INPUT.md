# Funnel input batch — URL normalization + free-score reliability

Both defects were hit by the owner on a phone, in one sitting, on the free score:
first the URL field refused `rozie.app` without a scheme, then the submitted request
died with Safari's "Load failed".

The free score is the top of the funnel. If it fails on a phone, nothing downstream
matters. This is a bug-fix batch, not a feature — the scope freeze is not violated.

Ship A and B together. Do not start until the Rozie verification is closed.

---

## A. Accept a website without `https://`

### A1. One normalizer, used everywhere

New `lib/normalize-url.ts`:

```ts
export function normalizeWebsiteUrl(raw: string): string | null
```

Rules:
- Trim; strip all internal whitespace (phone keyboards insert a trailing space).
- If there is no `^[a-z][a-z0-9+.-]*://` prefix, prepend `https://`.
- Parse with `new URL()`. Reject anything whose protocol is not `http:` or `https:`
  (so a pasted `ftp://`, `javascript:` or `mailto:` still fails — this is also the
  reason the scheme check must survive, not be relaxed).
- Reject a hostname with no dot, a trailing dot, or a leading/trailing hyphen in a
  label. `localhost` and bare IPs are rejected too: this is a public-website field.
- Lowercase the hostname; leave path, query and case elsewhere untouched
  (`example.com/EN/Pricing` must keep its case — some sites are case-sensitive).
- Return the canonical string, or `null` when the input cannot be salvaged.

Do NOT strip `www.`; the scraper and the brand resolver already handle it, and
rewriting the user's input further than necessary is its own defect class.

### A2. Inputs

Every website field: `type="url"` → `type="text"` plus
`inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false}`.
Those four attributes are the actual mobile fix — without them iOS capitalizes the
first letter and underlines the domain as a typo.

Call sites (all of them, no partial rollout):
- `app/score/page.tsx:107` (url), `:131` (competitor_1)
- `app/checkout/page.tsx:182` (url), `:193` (competitor_1..3)
- `app/admin/page.tsx:723,730,736,742`

Placeholders drop the scheme: `yourproduct.com`, `competitor.com`. Keep the label
wording; only the example changes.

Normalize on submit, client-side, before the POST — so the value the user sees in
the result page is the canonical one.

### A3. Server side

The API must accept a bare domain independently of the form (people POST directly,
and the form is not the security boundary):
- `app/api/score/route.ts` `requestSchema.url`
- `lib/schemas.ts` — `competitorUrlSchema` and `CheckoutIntakeSchema.url`
- `app/api/admin/audits/create/route.ts:14`

Pattern: `z.string().trim().transform(normalizeWebsiteUrl).refine(v => v !== null, ...)`.
Keep the existing user-facing messages ("Enter a valid homepage URL").

### A4. Tests (`tests/normalize-url.test.ts`)

Accept: `example.com`, `www.example.com/`, `EXAMPLE.COM`, `HTTP://Example.com`,
`example.com/path?x=1`, `example.co.uk`, ` example.com ` (padded),
`example.com/EN/Pricing` (path case preserved).
Reject: `example`, `не урл`, `ftp://example.com`, `javascript:alert(1)`,
`localhost:3000`, `http://192.168.0.1`, empty string for the required field.

### A5. Known trade-off — write it in the code comment

Defaulting to `https://` breaks an http-only site. Rare in 2026, and the fix is
cheap: in `lib/firecrawl.ts`, when a scrape of an `https://` URL that the user
supplied WITHOUT a scheme returns empty, retry once over `http://`. Only for that
case — never downgrade a scheme the user typed explicitly.

---

## B. The free score must survive a phone

### B0. Confirm the cause first (5 minutes, do this before writing code)

Vercel → Logs → `/api/score`. Record the duration of the failing invocation.
- ~60000 ms or "Task timed out" → the self-imposed cap in
  `app/api/score/route.ts:20` killed it.
- Well under 60 s with a 200 response → the function finished and the PHONE dropped
  the connection (screen lock / app switch / network handover).

Both causes are fixed by B2. Report which one it was; it changes nothing about the
work, but a fix shipped against an unverified diagnosis is how the next one hides.

### B1. Stop lying to the user (small, ships regardless)

- `app/score/page.tsx:36` calls `res.json()` on the `!res.ok` path. A Vercel 504
  returns HTML, so the parse throws and the user sees a JSON error instead of the
  real cause. Read the body defensively; fall back to a message keyed off the status
  (429 → rate limit, 5xx → "we could not finish the check, try again").
- Raise `maxDuration` in `app/api/score/route.ts` from 60 to 120. The platform allows
  300 here — `api/stripe/webhook` and `api/monitoring/run` already use it — so 60 is
  a self-imposed cap, not a limit. This is a safety margin, NOT the fix.

### B2. Make the wait survive a locked screen (the actual fix)

Today the browser must hold one connection open for 30-55 s. A phone will not do
that reliably: locking the screen suspends the tab and kills the request. No server
timeout tuning changes this.

Move to the pattern the paid audit already uses:

1. `POST /api/score` enforces rate limits exactly as today (before any spend),
   inserts the `scores` row with `status: 'processing'`, and returns
   `{ id, token }` immediately.
2. The scrape + Claude score + GEO probe move to a Trigger task, enqueued the same
   way `lib/audit-queue.ts` enqueues audits. Keep the inline path as the fallback
   when `TRIGGER_SECRET_KEY` is absent, so local dev still works end to end.
3. The client navigates straight to `/score/[id]?token=...`, which polls
   `GET /api/score/[id]` every 3 s and renders a real progress state until
   `status` is terminal. Closing and reopening the page must resume correctly —
   that is the whole point.
4. Terminal failure sets `status: 'failed'` with a reason the page can show. A row
   stuck in `processing` past a sane cutoff must render as failed, not spin forever.

Trigger deploys separately — see `DEPLOY.md`, and deploy with
`npx trigger.dev@<version from package.json> deploy`, never `@latest`.

### B3. Tests

- Normalizer + schema tests from A4.
- `POST /api/score` returns an id without waiting for the scan.
- A `processing` row renders the waiting state; a `failed` row renders the failure;
  a `done` row renders the score.
- Rate limiting still rejects before anything is enqueued (no spend on a blocked
  request).

---

## Acceptance

On a phone, in one pass: type `rozie.app` with no scheme, submit, lock the screen,
unlock 40 seconds later — the result page shows the score. No "Load failed" anywhere.

## Out of scope

No redesign of the score page, no new score sections, no changes to the scoring
formula or the free-score PDF teaser. Anything else noticed goes to
`DEFECTS_BACKLOG.md`.
