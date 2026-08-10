# Delivery polish — branded report email + admin queue grouping

Two small, unrelated jobs batched because neither is worth a session on its own.

The report email is the first thing a paying customer sees after €149. Right now it is
unstyled HTML that reads like a system notification. The audit inside it is good; the envelope
undersells it.

---

## A. Brand the report delivery email

Current state: `lib/resend.ts` `buildReportEmailHtml()` — a bare `<div>`, one black button, no
brand marks. Subject line is `Your AI Visibility report is ready - https://rozie.app/`.

### A1. Palette — take it from the app, do not invent

These are the values already used across `app/` (occurrence counts in brackets), so the email
matches the site instead of approximating it:

| Role | Value |
|---|---|
| Page background | `#FBF6EE` [29] |
| Card / content surface | `#FFFDF9` [27] |
| Ink (headings, primary button fill) | `#2E2116` [68] |
| Accent (eyebrow text, rules) | `#A9531F` [43] |
| Border | `#E5D7C5` [36] |
| Muted body text | `#6E5A50` [38] |

### A2. No logo image — use a text wordmark

`public/` contains no logo asset, and that is fine: mail clients block remote images by default,
so an image-based logo shows as a broken placeholder to a large share of recipients on first
open. A wordmark set in the accent colour with letter-spacing reads as deliberate design and
cannot fail to load.

Build it as text: `ClearSignal` in `#2E2116`, with a small uppercase accent eyebrow
(`AI VISIBILITY AUDIT`, `#A9531F`, letter-spacing ~0.18em, ~11px).

If a real logo file is added later, it drops in with explicit `width`/`height` attributes, an
`alt` of `ClearSignal`, and the wordmark stays as the alt fallback. Do not add an image now.

### A3. Email HTML constraints (this is where these things break)

- **Tables, not flexbox or grid.** Outlook renders through Word; modern layout silently collapses.
- **Inline styles for everything that matters.** A `<style>` block is allowed only for the dark
  mode media query — several clients strip it entirely, so nothing load-bearing goes there.
- **Max width 600px**, centered, with the page colour on a wrapping table (not on `<body>`,
  which some clients drop).
- **No web fonts.** System stack; the site's display font will not survive and that is expected.
- **Bulletproof button**: a table cell with background colour and padding, containing the link —
  an `<a>` with padding alone loses its shape in Outlook.
- **Dark mode**: `@media (prefers-color-scheme: dark)` plus colours that survive auto-inversion.
  Apple Mail and Outlook invert aggressively; check the button does not end up dark-on-dark.
- **Preheader**: one hidden line of preview text after `<body>`, or the client previews the raw
  first words.
- **Plain-text alternative**: pass `text` to Resend alongside `html`. Its absence is a real spam
  signal and it is two lines of work.
- All links absolute, already true via `reportLinks()`.

### A4. Subject line

Change `Your AI Visibility report is ready - ${url}` to use the bare domain, not the full URL:

```
Your AI Visibility report is ready - rozie.app
```

A raw `https://` in a subject reads as spam to filters and to people. `new URL(url).hostname`
with `www.` stripped — the helper already exists in several routes; reuse rather than re-write.

### A5. Footer

Small, muted, below a `#E5D7C5` rule: what ClearSignal is in one line, a link to the terms page,
and the sending business identity. No unsubscribe link — this is transactional mail sent to
someone who paid, not marketing, and adding one invites the recipient to opt out of their own
report.

### A6. Verification

`buildReportEmailHtml` is already pure and exported, which is what makes this testable. Add tests:
the returned HTML contains both links, contains no `<style>`-only critical rule, and the text
alternative contains both URLs. Then send one real email to yourself and open it in Gmail web,
Gmail on a phone, and one dark-mode client. Screenshot each — this is the one place where
looking at it is the point, so one pass, three screenshots, no iteration loop.

---

## B. Admin queue: label the groups

Not a bug. `app/api/admin/audits/route.ts` sorts by `STATUS_PRIORITY` — what needs attention
first (`processing`, `queued`, failures, `awaiting_review`), finished work last. A delivered
audit correctly sinks below `done`. The owner read this as a sorting fault because nothing on
screen explains it.

Fix in `app/admin/page.tsx` only, no change to the sort: render section headers between priority
bands — **Needs attention** (`processing` … `awaiting_review`) and **Finished** (`done`,
`delivered`) — with the count per band. Keep the existing order inside each band (newest activity
first).

Do not "fix" the sort so that delivered audits float up. That would bury the audits that actually
need a human.

---

## Out of scope

No redesign of the report page or the landing. No new email types (no receipts, no reminders, no
drip). Anything else noticed goes to `DEFECTS_BACKLOG.md`.
