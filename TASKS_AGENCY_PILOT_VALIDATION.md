# TASKS — Agency Pilot 01

**Status:** ready 2026-09-27. Owner-approved exception to the frozen scope; everything not in this
file stays frozen. Replaces the external prompt
`CLEARSIGNAL_AGENCY_ACQUISITION_PILOT_VALIDATION_PROMPT.md` — do not load it.

**Goal.** Start real conversations with US/UK SEO agencies. Run up to 10 free pilot audits for
them or their clients in exchange for short structured feedback. End every pilot with a paid
offer (a pack of 3 audits). Success means human replies, completed feedback and a first pack sale —
not opens, clicks or volume.

**Owner decisions (2026-09-27)**

- Send from `alex@blvdproduction.com`; the owner says the mailbox is warmed. **20 new emails per
  business day** from the start, spread through the sending window with random gaps, plus **one**
  follow-up — about 40 emails a day at peak. A second follow-up and any higher volume wait for a
  separate outreach domain, prepared in parallel for the waves after the first 200.
- **200 prospects now** (100 A + 100 B); about 500 over the whole pilot, in waves.
- The owner's working list is his Google Sheet `seo_baltics`, tab `gid=95772132` (with LinkedIn
  links). He sends LinkedIn requests himself from that sheet, weekly; there is no LinkedIn step in
  Apollo.
- Context — the August test (owner, 2026-09-27): about 50 Baltic agencies were emailed from the
  owner's personal Gmail and got zero replies. That email was a pitch (sample link, price, call
  request), the sheet records no follow-ups, and several recipients were not decision-makers or
  not SEO agencies. Hence the strict qualification and the question-first copy below.
- End-of-pilot offer: a founding agency pack of 3 audits. The owner names the price
  (`AGENCY_PACK_PRICE_LABEL`) before Phase 3 goes live.
- `GO LIVE` only after the owner has reviewed the first 20 prospects and the copy.
- Customer-facing copy: `validation/pilot01/COPY.md` (verbatim). Reply handling is the owner's:
  `validation/pilot01/REPLY_PLAYBOOK.md`.

## Gates — build only what real replies have earned

| Step | Starts only when |
|---|---|
| GO LIVE | the owner has reviewed the first 20 rows and the copy |
| Manual pilots | an agency accepts the invitation — no code needed (see "Manual pilot flow") |
| Phase 2 (intake page, table, `/admin/pilot`) | 3 agencies have accepted a pilot, and the uncommitted `lib/` work is resolved |
| Phase 3 (feedback page, cron, pack link) | 3–5 written feedbacks are in and the COPY.md §8 questions have been rewritten from them |
| Pack via Stripe Payment Link | Phase 3's webhook guard is live |

Until the Payment Link is safe, the pack is sold with a Stripe invoice from the dashboard.
Invoices create no checkout session, so the current webhook ignores them.

## Rules for every phase

1. **One phase = one Codex session** (AGENTS.md cost rules). Default model: Terra, medium.
2. **Preflight:** `git log --oneline -1`, `git status`.
   - On 2026-09-27, `main` had someone else's uncommitted engine work in `lib/audit-runner.ts`,
     `lib/geo/entities.ts`, `lib/geo/index.ts`, `lib/report-validator.ts` and `lib/sanitize.ts`.
     Never stage, stash, commit or discard it.
   - Phase 1 may proceed with it present, because Phase 1 changes no app code.
   - Phases 2–3 must not start until the owner has resolved it. Stop and say so.
   - Phase 1 makes no git changes at all. `.gitignore` already covers `validation/**/*.local.*`, and
     the docs are committed by the site-wording task (`TASKS_SITE_REVIEW_WORDING.md`).
3. **No prospect contact before the owner writes `GO LIVE`:** no enrolling, activating, sending or
   LinkedIn actions.
4. **Never automate linkedin.com.** No browser automation, extensions, scraping or unofficial APIs.
   The owner sends LinkedIn requests and messages by hand, from his Google Sheet.
5. **Vercel-only initiative.**
   - Do not modify `lib/audit-*`, `lib/report-*`, `lib/quality/*`, `lib/geo/*`, `lib/sanitize.ts`,
     `lib/report-validator.ts`, `trigger/*` or prompts. Importing from them is fine.
   - If a change there looks necessary, stop and ask: it would force a Trigger deploy.
6. **Human review stays.** Pilot audits go through `awaiting_review` and are delivered by the
   owner from `/admin`. `AUTO_DELIVER_AUDITS` stays false.
7. **Apollo holds email state:** prospects, sends, replies, contact stages. The owner's Google
   Sheet is his working list (LinkedIn, notes). Supabase holds pilot state only from the moment a
   person is invited.
8. **Trust layer.** No page or email promises rankings, citations or traffic. Findings are
   observed, point-in-time, and scoped to the tested questions.
9. **No prospect personal data in git.** Local review files use `*.local.*` (gitignored).
10. End each phase with the Russian owner status from AGENTS.md.

## Phase 1 — Outreach ready (Apollo; no app code)

Use the official Apollo MCP/API available in your environment. Discover its actions first; never
guess endpoint names. If Apollo access is unavailable, stop and report.

1. **Verify:**
   - mailbox `alex@blvdproduction.com`: active, connected, sending limits;
   - schedule "Eastern" (Mon–Fri 10:00–17:00 America/New_York, contact timezone, skip holidays) —
     reuse it, don't duplicate it;
   - credits and any existing ClearSignal lists or sequences (reuse);
   - suppressions, bounces, unsubscribes, do-not-contact.
2. **Limits:**
   - 20 new cold emails per business day in total (10 A + 10 B if a cross-sequence cap is
     impossible).
   - Spread across the sending window with random gaps of roughly 15–25 minutes — no bursts.
   - Everything the mailbox sends, follow-ups included, stays at or below 40 a day.
   - Open and click tracking off.
3. **Source and qualify 200 contacts (100 A, 100 B):** US and UK, English-speaking, agencies of about
   5–100 people, one decision-maker per company.
   - *Cohort A* materially sells SEO but has no established GEO/AEO/AI-search offer.
   - *Cohort B*'s own public pages show GEO, AEO, AI-search or LLM-visibility work. Store the
     evidence URL and a short quote. No evidence means Cohort A.
   - *Exclude:*
     - solo freelancers and recruiters; SEO job boards;
     - affiliate sites, link farms and lead farms; inactive or spammy sites;
     - pure paid-media, social or dev shops;
     - SEO SaaS vendors without an agency business.

     Never qualify on Apollo's "marketing" label alone — check the site.
   - *Titles:*
     - small agencies: Founder, Co-founder, Owner, MD, CEO, President;
     - larger agencies: Head, Director or VP of SEO, Organic, Search, Growth, Digital or Strategy;
     - never specialists, analysts, juniors, BDRs or HR.
   - *Deterministic score*, with a written reason per component:

     | Component | Range |
     |---|---|
     | Company fit | 0–5 |
     | Authority | 0–5 |
     | Use-case fit | 0–5 |
     | Personalization evidence | 0–3 |

     Send threshold ≥ 12; any exception needs a written reason.
   - *Verified emails only.* Skip anyone unsubscribed, bounced, do-not-contact, previously negative,
     or in another active ClearSignal sequence.
   - Record each person's LinkedIn profile URL where one exists; the owner works LinkedIn from it.
4. **Store in Apollo:**
   - lists `ClearSignal | Pilot 01 | Cohort A` and `ClearSignal | Pilot 01 | Cohort B`;
   - custom fields (create if missing): `cs_campaign` (= `pilot01`), `cs_cohort`,
     `cs_email_version` (`A1`/`B1`), `cs_score`, `cs_score_reasons`, `cs_geo_evidence_url`.

   Track the funnel with Apollo contact stages, not with stage-mirroring lists.
5. **Two sequences, created inactive:** `ClearSignal | Pilot 01 | A | US+UK` and
   `ClearSignal | Pilot 01 | B | US+UK`.
   - Steps: day 0 auto email → +4 business days auto email in the same thread.
   - No LinkedIn step: the owner does LinkedIn from the sheet.
   - The third email in COPY.md waits for the second domain.
   - Settings: finish on reply and on "interested"; pause on out-of-office; no unverified emails;
     nothing driven by opens or clicks.
   - Copy: verbatim from COPY.md §1–§3. `{{postal_address}}` comes from the owner; without it,
     report it as a blocker and leave the sequences inactive.
6. **The owner's Google Sheet.** Spreadsheet `1i8gQoETTaDWnWm-17Adxua2ih7ZQJnjvwZJSeoTbWBw`, tab
   `gid=95772132` (the owner created it for this pilot). Never touch any other tab: `seo_baltics`
   holds the August test.
   - Read the tab's header row first. Keep the owner's columns and their order, and fill the ones
     that match by meaning. Add any missing columns to the right: `date_added`, `name`, `role`,
     `company`, `email`, `linkedin_url`, `country`, `company_size`, `website`, `cohort`, `score`,
     `score_reasons`, `geo_evidence`, `email_version`, `sequence`, `review`, `linkedin`,
     `email_status`, `notes`.
   - Also add these columns and leave them empty — the owner fills them during manual pilots:
     `pilot_status`, `feedback_date`, `client_price`, `wants_another`, `pack`, `feedback_notes`.
   - 200 rows. The top 10 A + top 10 B come first, with `review = first 20`; then the rest, by
     score.
   - `linkedin = todo` for the top 100 by score (50 A + 50 B), empty for the others.
   - `email_status = queued` for every row.
   - Append only: never overwrite, reorder or delete existing cells. Skip duplicates by email or
     LinkedIn URL.
   - Write with a Google Sheets tool or API if you have one. If you don't:
     1. write `validation/pilot01/prospects.local.csv` with exactly the tab's columns, in the same
        order (`.gitignore` already keeps it out of git);
     2. tell the owner to import it (File → Import → Upload → Append to current sheet).

     No browser automation, and never ask for the owner's Google password.
7. **Report:** companies looked at, qualified and rejected (top reasons); Apollo IDs of the lists
   and sequences; credits used.

**Acceptance:**

- both sequences exist and are inactive;
- 0 contacts enrolled, 0 emails sent;
- 200 qualified contacts across the two lists;
- the 200 rows are in the owner's sheet tab, or the import CSV is ready and not tracked by git;
- tracking is off; 20 new emails a day with random gaps; at most 40 emails a day in total.

**GO LIVE** runs as a separate short session, only after the owner writes `GO LIVE`. Enroll the
200 contacts into their cohort's sequence, activate both sequences, confirm the first scheduled
sends, and report. If you can write to the sheet, set `email_status = in_sequence` for them.

## Manual pilot flow (before Phase 2) — owner, no code

1. **Invite:** COPY.md §5.
2. **Intake by email:** COPY.md §6 — five short answers.
3. **Create the audit** in `/admin` with "Create manual audit" (comped), through the usual preview
   and query review.
4. **Review and deliver** as usual.
5. **Written feedback, no calls** (owner decision): 1–2 days after delivery, send the five
   questions from `validation/pilot01/FEEDBACK_EMAILS.md`; send one reminder after 4 days.
6. **When they answer**, fill the pilot columns in the sheet. Reply with the pack offer from the
   same file: the price named plainly, and a direct question.
7. **A "yes" to the pack** → send a Stripe invoice from the dashboard.

## Phase 2 — Private pilot intake (Vercel only; only after its gate)

**Outcome.**

1. The owner creates a participant in `/admin/pilot` and copies a private link.
2. The agency fills a ~2-minute form.
3. The owner turns the intake into a normal comped audit through the existing preview flow.
4. The audit is linked to the participant.

**Migration.** Use the next free number. The repo ends at `015_audit_trigger_run_fence.sql`, but
STATUS.md only records `014` as applied — confirm with the owner that 015 is in production before
applying yours.

Table `agency_pilot_participants`:

| Group | Columns |
|---|---|
| Identity | `id uuid pk`, `token_hash text unique`, `token_expires_at`, `token_revoked_at` |
| Person | `first_name`, `last_name`, `email`, `title`, `agency_name`, `agency_domain`, `country`, `cohort` (`A`/`B`), `apollo_contact_id` (optional), `campaign` (default `pilot01`), `email_version` |
| Intake | `intake jsonb`, `intake_completed_at` |
| Audit | `audit_id uuid unique references audits(id)`, `audit_linked_at` |
| Feedback & offer (used in Phase 3) | `feedback_requested_at`, `feedback_reminded_at`, `feedback_completed_at`, `pack_clicked_at`, `pack_paid_at` |
| Housekeeping | `notes`, `created_at`, `updated_at`; index on `email`; RLS enabled like the other tables |

Timestamps are the truth. One pure, tested function `pilotStage(participant, auditStatus)` derives
the stage: `invited → intake_complete → audit_created → delivered → feedback_requested →
feedback_complete`, or `revoked`.

**Token.**

- 32 random bytes, base64url. Store only the SHA-256.
- Expires after 60 days; revocable.
- "Regenerate" issues a new token and kills the old one.
- The raw link is shown once, right after create or regenerate, with a Copy button.

**Public page `/agency-pilot/[token]`.**

- The token is validated server-side.
- Hidden from search: `robots: noindex, nofollow`; add `/agency-pilot/` to the disallow list in
  `app/robots.ts`; not in the sitemap; linked from nowhere.
- One page: header, context, value-exchange card, what you receive, form, confirmation
  (COPY.md §7).
- States: inactive link (one generic message for invalid, expired or revoked), already submitted,
  server error, rate limited.
- Reuse the site's existing styles and components (`/checkout`, `/sample`); no new visual language.
- Design QA: one pass of screenshots at 1440 and 390 px, including a long agency name and a long
  URL. Report — don't iterate (AGENTS.md rule 3).

**Intake API `POST /api/agency-pilot/intake`.**

- zod validation.
- Rate limits via `lib/rate-limit.ts`: 10 per hour per IP, 5 per hour per token.
- Idempotent: a second submit returns the stored state.
- Generic error messages, never stack traces.

| Field | Rule |
|---|---|
| `site_url` | required; `normalizeWebsiteUrl` |
| `site_type` | `agency` / `client` |
| `business_description` | required; ≤600 chars |
| `target_customer` | required; ≤600 chars; plain text, not a URL (reuse `icpTextSchema`) |
| `market_language` | required; ≤200 chars |
| `competitors` | 0–3 URLs; `competitorUrlSchema` |
| `current_process` | `none` / `manual` / `seo_platform` / `geo_platform` / `internal` / `other` |
| `current_tool` | optional; ≤120 chars |
| `useful_if` | optional; ≤600 chars |
| `consent` | must be `true` |

**Admin `/admin/pilot`** — the existing admin cookie protects the page and its APIs.

- A participants table: name, agency, cohort, title, country, stage, site, audit link and status,
  feedback state, pack clicked/paid.
- A "New participant" form.
- Actions: revoke, regenerate link, open audit, and "Create audit" for `intake_complete` rows.

**"Create audit" flow.**

- It opens the existing create flow prefilled, e.g. `/admin?pilot=<participant_id>`:

  | Create-form field | Filled from |
  |---|---|
  | email, url, competitors | the participant and intake |
  | `icp_description` | `target_customer` |
  | `business_context.target_markets_languages` | `market_language` |

  Business description, current tool and "useful if" are shown next to the form for the operator.
  No new audit columns. The usual preview and query review run unchanged.
- `/api/admin/audits/create` accepts an optional `pilot_participant_id`. If that participant
  already has an audit, return 409 before inserting; otherwise link it after the insert.
- Cap: `PILOT_AUDIT_CAP` (default 10) linked audits. Going past it requires `override_cap: true`
  plus a reason appended to the admin notes.

**Tests:**

- token create, hash lookup, expiry, revocation, invalid;
- intake schema; idempotent submit; rate limit applied;
- 401 on the pilot admin APIs without the cookie;
- create-route linking, 409 and the cap;
- `pilotStage()`;
- robots contains `/agency-pilot/`; page metadata is noindex.

**Ship.**

1. Run `npx tsc --noEmit`, `npm run build` (dev server stopped) and the full vitest suite.
2. Push `main` → Vercel. Apply the migration.
3. Verify on production: the `/api/health` SHA; an invalid token renders the generic page with
   noindex; `/admin/pilot` requires auth.
4. Confirm with `git diff --name-only` that no Trigger-path file changed, so no Trigger deploy.
5. Update STATUS.md.

**Acceptance:** on production, the owner can create a participant, copy the link, submit the form
from a phone, see the intake in `/admin/pilot`, create the audit through the normal preview, and
see it linked.

## Phase 3 — Feedback, pack offer, daily automation (Vercel only; only after its gate)

Before building, rewrite the questions in COPY.md §8 from what the first 3–5 written feedbacks
showed; the current §8 is a draft.

**Outcome.**

- A day after delivery, the agency automatically gets a feedback link.
- The page reviews *their* report in about 5 minutes and ends with the pack offer.
- One reminder at most.
- A Monday summary for the owner, in Russian.

**Do first: a Stripe webhook guard, with a test.**

- The problem: `app/api/stripe/webhook/route.ts` treats a completed session that has no
  `metadata.audit_id` and no matching `stripe_session` as a legacy order and inserts a new audit.
  A Payment Link purchase would take that path and create a broken audit.
- The new rule: if no audit matches and `metadata.url` is empty, respond 200
  `{ ignored: 'not_an_audit_session' }` and call
  `notify('non_audit_checkout', { session_id, amount_total, customer_email, kind: metadata.kind })`.
- The pack Payment Link carries `metadata.kind = agency_pack`.

**Migration** (next number).

- `agency_pilot_feedback`, one row per participant (unique):
  - answers: `usefulness_1_5`, `sections_show text[]`, `sections_drop text[]`,
    `would_test_another`, `resale_price_amount numeric`, `resale_price_currency`,
    `testimonial_permission`, `alternative_if_gone text`;
  - `practice jsonb` (cohort answers, with `schema_version`);
  - `draft jsonb` (autosave) and `submitted_at`;
  - provenance: `audit_id`, `report_version`, `engine_version`, `cohort`, `reviewer_title`.
- `agency_pilot_item_reviews`, one row per reviewed item:
  - which item: `participant_id`, `audit_id`, `item_type` (`recommendation` / `query` / `entity` /
    `section`), `item_key`, `item_text` (snapshot), `depth` (`core` / `deep`);
  - the answer: `verdict`, `verdict_2` (deep applicability), `reason`, `suggestion`, `comment`;
  - `label_source` (default `agency_pilot`), `created_at`;
  - unique on (`participant_id`, `item_type`, `item_key`, `depth`).

These labels measure realism, relevance and usefulness as practitioners judge them. They are not
ground truth for what the engines returned. Never write them into the existing eval labels.

**Extraction.** Take items from the delivered report through the same presentation path the client
report uses — sanitized text only, never raw JSON.

| Item | What to take | Limit |
|---|---|---|
| Recommendations | Action Plan fixes, as displayed | 3–10 |
| Questions | tested core buyer questions, as displayed | ≤6 |
| Competitors | competitor entities, as displayed | ≤8 |
| Sections | major sections actually rendered for this report | — |

`item_key` = item type + position + a short hash of the text.

**Page `/agency-pilot/[token]/feedback`.**

- Available only once the linked audit is delivered; otherwise it shows the "not ready" state.
- Five short steps with a progress indicator. Answers autosave per step; one final submit.
- noindex, like the intake page.
- Questions and wording: COPY.md §8 — the core steps plus the collapsed optional deep-dive.
- The resale-price question appears *before* the pack card.
- The pack button goes to `/agency-pilot/[token]/pack`, which records `pack_clicked_at` and
  redirects (302) to `AGENCY_PACK_PAYMENT_LINK`.
- If the price label or the link env var is missing, hide the card; the rest still works.

**Daily cron.** `vercel.json` with one daily job → `/api/cron/pilot-daily`. Reject the call unless
it carries `Authorization: Bearer ${CRON_SECRET}`. Each run:

- (a) sends the feedback request (COPY.md §9) for linked audits delivered ≥24 h ago that have no
  request yet;
- (b) sends one reminder 4 days after the request if there is still no feedback — never more than
  one;
- (c) on Mondays, sends a Russian weekly summary to `PILOT_OWNER_EMAIL`:
  - per cohort: invited, intakes, audits created / awaiting review / delivered, feedback complete,
    pack clicks, packs paid;
  - an action list: intakes waiting for "Create audit", audits awaiting review, overdue feedback;
  - a link to Apollo's sequence analytics (outreach numbers stay in Apollo for v1);
  - Russian strings use `\u` escapes (the CP1251 rule).

Idempotency: claim each send with a conditional timestamp update before sending; if the send fails,
clear the timestamp and `notify`. Sender: `PILOT_FEEDBACK_FROM` (an address on the Resend-verified
getclearsignal.io domain). Reply-to: `PILOT_REPLY_TO`.

**Admin additions.**

- Feedback status and answers per participant.
- A "Send feedback request now" button (same idempotency).
- A "Mark pack paid" button.
- A small A-vs-B table — never one blended score:
  - intake rate and feedback completion;
  - recommendation Yes / Maybe / No shares;
  - flagged-question share and flagged-competitor share;
  - section show / drop counts;
  - would-test-another; pack click rate; packs paid;
  - the resale prices, listed.

**Tests:**

- the webhook ignore rule, including a Payment Link-shaped session;
- extraction of each item type from a saved report fixture (grep the fixture, don't load the whole
  file — AGENTS.md rule 5);
- the feedback schema, including the cohort-specific questions;
- idempotent submit and autosave;
- cron auth, no double send, at most one reminder;
- weekly summary content; per-cohort metrics;
- the pack redirect records the click.

**Ship and verify** as in Phase 2.

**Owner, before the first feedback request goes out:**

- name the pack price;
- create the live Stripe Payment Link with `metadata.kind = agency_pack`;
- set `AGENCY_PACK_PRICE_LABEL`, `AGENCY_PACK_PAYMENT_LINK`, `PILOT_OWNER_EMAIL`, `PILOT_REPLY_TO`,
  `PILOT_FEEDBACK_FROM` and `CRON_SECRET` in Vercel.

**Acceptance:**

1. A delivered pilot audit leads to exactly one feedback request from the next day's cron.
2. The page lists that report's actual fixes, questions and competitors.
3. Submitting from a phone works.
4. Admin shows the answers and the A-vs-B table.
5. The pack click is logged.
6. A test Payment Link purchase in Stripe test mode creates no audit.

## Checkpoints (proposed; the owner may change them before GO LIVE)

| Checkpoint | Condition | Action |
|---|---|---|
| Automatic pause | bounces above 3% of sent, or any spam complaint | pause both sequences and report |
| Early check (3 business days after the 100th first email) | 0 human replies across both cohorts | pause both sequences; rethink the channel, segment or offer — not just the copy (August: 0 replies from ~50) |
| Early check | one cohort has 0 human replies | pause that cohort; change its message or segment |
| End of wave 1 (all 200 sent + 5 business days) | ≥5 human replies and ≥2 accepted pilots | next wave (~300) from the new domain, up to 30 new emails a day |
| After 5 completed feedbacks | nobody wants another audit and nobody clicked the pack | stop free audits and talk to those five first |
| After 5 completed feedbacks | ≥1 pack paid | continue to 10 |
| Cap | 10 pilot audits | more only by explicit owner decision |

## Not in this spec (later, if earned)

- A morning digest of replies with draft answers, once replies exceed about 3 a day.
- An evidence hook: a first line built from a real 3-question, 3-engine check of the agency's own
  niche, tested on ≤20% of wave 2.
- A public "which agencies do AI engines recommend" study — content queue, after the first payment.
