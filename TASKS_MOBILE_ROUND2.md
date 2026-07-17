# ClearSignal landing — refinement round 2 (Codex prompt)

**Source of truth:** `app/page.tsx` on `main`, commit `2bbd49a` ("Polish mobile landing and wire
audit CTA") or newer. Before editing, run `git pull` and confirm `git rev-parse --short HEAD` is
`2bbd49a`+. Bind changes to the **current classes in `app/page.tsx`** (ignore
`app/preview-hero/page.tsx` — stale copy). Line numbers are from `2bbd49a`; if drifted, locate by
the quoted text/class.

Round-1 items are already implemented (nav CTA hidden on mobile, hero secondary → text link,
engine-note two-line, Stripe "Order the full audit" CTA) — **do not redo them.**

## Global rules
- No horizontal overflow / no clipped text at 320/360/375/390/430px. No element overlaps another.
- Tap targets ≥ 44×44px; body ≥ 14px; labels ≥ 11px. respect `prefers-reduced-motion`.
- Desktop (≥1024px) unchanged **except** where a task says desktop (§A, §B, §D).
- No backend / engine / admin / Supabase / Trigger / pricing-logic changes.
- Copy is frozen **except**: the long-dash removal (§A) and the §D showcase copy.

---

## 0. BLOCKER — pricing CTA must go to `/checkout`, not the raw Stripe payment link
**This is a real order-breaking bug. Fix first.**

The app already has a complete paid funnel:
`/checkout` (collects url, email, competitor_1..3, icp_description; optionally pre-fills from
`?score_id=<id>&token=<token>`; works fine with no params at all)
→ `POST /api/stripe/checkout` (creates a Stripe Checkout **session carrying that data as
`metadata`**, `success_url=/success?session_id=…`)
→ Stripe → `checkout.session.completed`
→ `/api/stripe/webhook` (reads `metadata`, inserts the `audits` row, calls `enqueueAudit`).

The landing currently bypasses all of it: the pricing button points at a **raw Stripe payment
link** (`STRIPE_AUDIT_URL`, line ~15; used at line ~900). A payment link collects **no** website,
email, competitors or ICP and carries **no metadata** — so the webhook fires with empty metadata and
**the audit cannot be created**. The customer pays and nothing is ordered.

**Change:**
- Point the pricing primary CTA at **`/checkout`** (internal `next/link`), not `buy.stripe.com`.
- **Delete** the `STRIPE_AUDIT_URL` constant (line ~15) and the `NEXT_PUBLIC_STRIPE_AUDIT_URL`
  usage — the Stripe session is created server-side by `/api/stripe/checkout`.
- Keep the button label **"Order the full audit · €149"** and the secondary text link
  "Not ready yet? Get your free score →" → `/score`.
- From the landing, plain `/checkout` is correct (the form works with no params). Only the
  free-score result page should pass the upgrade params, and the exact names are
  **`/checkout?score_id=<id>&token=<token>`** (not `?score=`).

**Accept:** clicking the pricing CTA opens the on-site `/checkout` form; submitting it reaches
Stripe Checkout; after payment `/success` loads and the webhook creates + enqueues the audit. No
`buy.stripe.com` URL remains in `app/page.tsx`.

---

## A. Remove ALL long dashes — site-wide (mobile + desktop)
Replace every **em-dash (`—` / `&mdash;`) and en-dash (`–` / `&ndash;`)** in visible text with a
natural alternative. **Keep normal hyphens** in compound words (`expert-reviewed`, `buyer-intent`,
`citation-readiness`, `service-area`, `multi-brand`, etc.) — those stay.

Rule of thumb: for a pause use a comma; for a separator use a middot `·` or rephrase.

Known locations (search the whole file for `&mdash;`/`&ndash;` to catch any others):
- **Hero H1**, line ~611: "…does it recommend you `&mdash;` or your competitor?"
  → **"When buyers ask AI who to choose, does it recommend you, or your competitor?"**
- **Pricing CTA**, line ~901: "Order the full audit `&mdash;` €149"
  → **"Order the full audit · €149"** (middot).
- **Phone mockup**, line ~677: "named & cited `&mdash;` yourbusiness.com"
  → **"named & cited · yourbusiness.com"**.
- The showcase H2 "See where you stand `&mdash;` and what to fix first." (line ~416) is **removed by
  §D** and replaced with a dash-free headline — no action needed here.
- Any others found by the search: apply the same rule.

**Accept:** `grep -nE '&mdash;|&ndash;|—|–' app/page.tsx` returns nothing in visible copy;
hyphenated compounds untouched; every rewrite reads naturally.

---

## B. Hero (desktop) — more depth behind the phone
- **Where:** phone depth layer, lines ~637–642 (the blurred orb + 3 translucent rotated panels
  `border-white/… bg-white/…` behind the phone).
- **Change:** add more translucent glass panels and let them **bleed further out** from behind the
  phone (more offset/rotation, extending beyond the phone silhouette on left/right/bottom), so the
  phone sits in a richer stack of soft glass shapes. Keep them subtle (low opacity, blurred) — depth,
  not clutter.
- **Accept:** desktop hero shows a fuller, layered translucent stack peeking out around the phone;
  no hard edges, no overlap with the headline column.

---

## C. Hero (mobile) — tighten gap to phone + enlarge phone
- **Where:** phone wrapper, line ~636: `relative -mb-24 mt-0 flex scale-[0.74] justify-center sm:my-0 sm:scale-100`.
- **Change (mobile only):**
  - **Reduce the gap** between the "TESTED ACROSS" logo row and the phone (tighten via the wrapper's
    top margin / the hero grid gap), keeping the phone fully below the logos, not overlapping.
  - **Enlarge the phone** — raise `scale-[0.74]` to ~`scale-[0.82–0.86]`.
- **Accept:** on mobile the phone is visibly larger and sits closer under the logos, still not
  covering them; desktop unchanged (`sm:scale-100`).

---

## D. Product showcase — REPLACE the tabs with a "Measure → Explain → Act" panel
**This supersedes the earlier "Your top priorities" mobile task — it is a full rebuild of the
`ProductShowcase` component (`function ProductShowcase`, line ~386; `<section id="workflow">`,
line ~421), not a polish.**

**Why:** three tabs stretch thin data across a big mockup — desktop reads empty, mobile reads long
and fragmented, and "Stand / Competitors / Fix first" feels like navigation, not a story. Do not
keep refining the browser-frame/tab design — replace it.

**Keep the section DARK.** It is the page's dark anchor in the light→dark→light rhythm — the new
panel must stay dark-glass, **not** ivory, or the whole page flattens.

**Remove:** the fake browser chrome (dots + `app.clearsignal.com / audit`), the three tabs + tab
state (desktop tablist line ~435 and mobile tablist line ~453), the three separate tab layouts, and
the separate proof strip below (`id="what-you-get"`, line ~617) — its content folds into the new
footer line (below).

**New copy (no dashes):**
- Eyebrow: `THE PRODUCT`
- Headline: **From AI visibility to clear next steps.**
- Subheadline: **See where you appear, why competitors are chosen, and what your team should improve first.**

### D-desktop — one wide panel, three stages, left→right (Measure → Explain → Act)
One cohesive **dark-glass** panel, max-width ~**1050–1150px**, three columns separated by thin
vertical dividers; each column uses a different internal layout suited to its content; restrained
copper highlights; **no nested cards, no browser chrome, no empty white bands.** Show the
**Measure → Explain → Act** flow with small labels/arrows between columns.

- **Measure — "Where you stand":** AI visibility score **34/100** (large), Mention rate **21%**,
  Citation rate **14%**, then ChatGPT — Missing / Perplexity — Cited / Claude — Appears (render the
  engine states as chips/labels; no literal em-dash in copy — use a chip, not "ChatGPT — Missing").
- **Explain — "Why competitors appear":** two groups.
  - `THEY HAVE`: Strong customer reviews · Clear service-area pages · Mentions in comparison sources.
  - `YOU'RE MISSING`: Clear location information · Third-party proof · Presence in cited sources.
- **Act — "What to fix first":** three short actions, numbered **1 / 2 / 3**:
  1. Add your city and service area to the homepage heading.
  2. Add a concise FAQ section.
  3. Add customer proof and comparison content.

**Numbering:** label the three stages **Measure / Explain / Act** (or 01/02/03 at the column head) —
but the three fixes inside Act use **1/2/3**. Do not put two competing 01/02/03 scales in the same
eyeline.

**Footer (one small line, NOT inside a box):**
`Web dashboard + PDF report · Real AI evidence · Expert-reviewed before delivery`

**Guard against the opposite failure:** three dense columns can become a wall — keep balanced
whitespace, short lines, clear column headers.

### D-mobile — same three stages as a compact vertical accordion/stepper
- **01 Where you stand** — collapsed summary: `34/100 · 21% mentioned · 14% cited`
- **02 Why competitors appear** — collapsed summary: `Stronger reviews, clearer pages and cited sources`
- **03 What to fix first** — collapsed summary: `Add location · Add FAQ · Add proof`

Only **one item expanded at a time**; **default open = "What to fix first"**. Expanded content is
concise (do not dump all copy at once). No browser chrome, no large cards/icons, no nested boxes.
Animate height subtly; respect `prefers-reduced-motion`.

**Accept:**
- Desktop: one cohesive dark panel, three columns, no browser frame, no tabs, no empty white bands;
  the section still reads as the page's dark anchor.
- Mobile: compact accordion, one open at a time, default "What to fix first"; the section is
  **significantly shorter** than now; no horizontal overflow at 320/375/390/430; tap targets ≥44px.
- No em/en-dashes anywhere in the new copy.

---

## E. Audit-preview "Engine breakdown" — mobile tighten
- **Where:** the "AUDIT PREVIEW" card's **ENGINE BREAKDOWN** block in the **audience** section
  (separate from §D; ~line 344–345 region, `space-y-2.5`). After the round-1 two-line fix the rows
  gained vertical air.
- **Change (mobile):** reduce the vertical spacing between rows and between each engine name and its
  note line, so the card is **shorter vertically**. Keep the two-line, no-truncation layout.
- **Accept:** the engine-breakdown card is noticeably shorter on mobile; notes still show in full.

---

## F. Pricing card — mobile
- **F1. Badge to top-right corner.** "Founding offer · first 20" (line ~881) currently stacks below
  the title/subtitle on mobile (header is `flex-col` below `sm`). Put the badge in the **top-right
  corner** of the card on mobile too (title/subtitle left, badge top-right).
- **F2. Sell the price.** Next to **€149** (line ~885) add a **struck-through `€399` in grey**
  (`line-through`, muted). The line "Regular €399 after the founding offer" (line ~886) can shrink or
  move under the price, but the struck `€399` must sit next to `€149`.
- **F3. Narrower card vertically.** Remove empty vertical gaps (tighten spacing between title, badge,
  price, bullets and CTA).
- **Accept:** mobile pricing card has badge top-right, `€149` with a struck grey `€399` beside it,
  and visibly less vertical whitespace. Desktop unchanged.

---

## G. FAQ — mobile line width
- **Where:** FAQ answer paragraph, line ~935: `pb-5 pr-10 text-[14px]` — `pr-10` narrows the column.
- **Change (mobile):** drop/reduce the right padding on mobile (`pr-10` → `pr-0`/`pr-2`) so question
  and answer use the full container width.
- **Accept:** FAQ answers use the full width on mobile; more words per line, no early wrapping.

---

## Optional (unconfirmed — only if you want it)
- **Hero H1 dominance:** current H1 `clamp(2.1rem,4.1vw,3.5rem)` vs section H2s is a correct
  hierarchy. If more dominance is wanted, bump H1 to ~`clamp(2.2rem,4.4vw,3.9rem)`. Skip unless
  requested.

## Out of scope
- Desktop layout/spacing/type except §A, §B and §D.
- Section order, backgrounds, the light→dark→light rhythm (the §D panel STAYS dark).
- Any copy except the long-dash removal (§A) and the §D showcase copy.
- Anything server-side.
