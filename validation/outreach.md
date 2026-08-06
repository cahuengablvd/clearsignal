# Outreach messages

Rules: every message gets ONE personalized line (a real client of theirs, a real query, a
real thing on their site). Short beats clever. The CTA is always small — a look at a sample
or a 20-minute call, never "buy now" in message one. Send from the founder, as a person.

---

## Agencies

### LinkedIn connection note (300 chars max)

> Hi {Name} — I build ClearSignal, an AI-visibility audit (how ChatGPT/Perplexity answer
> buyer questions — who they recommend and cite). Testing it with a few SEO agencies as a
> client-facing deliverable. Mind if I share a sample?

### First message (after connect, or as email)

Subject (email): `AI visibility audits as an agency deliverable`

> Hi {Name},
>
> Quick context: buyers increasingly ask ChatGPT and Perplexity before they ever search.
> ClearSignal tests how those engines answer real buyer-intent queries about a business —
> who gets recommended, who gets cited, and what's missing on the site that causes it.
>
> {PERSONAL LINE — e.g.: "I ran a test query for one of your listed clients, {Client}, and
> the engines recommend two of their competitors by name."}
>
> Agencies use the report two ways: as a paid add-on to SEO work, and as evidence to sell
> the implementation (schema, FAQ, comparison pages) they already offer.
>
> Sample report: https://getclearsignal.io/sample
> Pilot for one of your clients is €149, human-reviewed, 2 business days.
>
> Worth a 20-minute look at how it'd fit your client base?

### Follow-up (day 3-4, one line)

> Hi {Name} — floating this back up. If AI visibility isn't coming up with your clients yet,
> a "no" is genuinely useful to me too. Sample: getclearsignal.io/sample

### Follow-up 2 (day 8-10, last one)

> Last nudge from me. If it's ever useful — the free score at getclearsignal.io/score takes
> a minute per client site and shows the headline number. Good luck either way!

---

## Service businesses

### First message (email or LinkedIn)

Subject: `What ChatGPT says when buyers ask about {their category} in {their city}`

> Hi {Name},
>
> When someone asks ChatGPT or Perplexity "{real buyer query for their niche/city}", the
> answer names specific companies — and sends buyers to them.
>
> {PERSONAL LINE — e.g.: "I ran that exact query today: {Competitor} is recommended by
> name; {TheirCompany} doesn't come up."}
>
> I run ClearSignal — we test how the AI engines answer real buyer questions about your
> business, show who appears instead of you and why, and give you a prioritized fix list.
> Expert-reviewed, one-time, €149, 2 business days.
>
> You can see the free version of the check here: getclearsignal.io/score
> Full sample report: getclearsignal.io/sample
>
> Want me to run the free check on {their domain} and send you the result?

(That last line is the strongest hook we have: it costs them nothing, and the result page
itself sells the €149 audit.)

---

## Handling replies

**"How is this different from our SEO tools?"**
> Rank trackers show Google positions. This shows what the answer engines actually SAY —
> which brands they recommend, which sources they cite, on real buyer questions. Different
> layer; most tools that touch it are €29-99/mo monitoring dashboards that tell you a
> number but not what to do. This is the audit + fix plan, once, with a human review.

**"Can we white-label it?"**
> On the roadmap once pilot demand is proven. Today you get an agency-ready PDF you can
> walk your client through — the pilot exists exactly to find out if your clients care.

**"Too expensive / do you have discounts?"**
> The founding price already is the discount — €149 against €399 regular. What I can do is
> hold that price for a 3-audit agency pack. (Log the ask in tracking; do NOT invent a new price on the call.)

**"Does this guarantee we'll show up in ChatGPT?"**
> No — and be wary of anyone who guarantees that. We show what the engines answer today,
> why competitors appear, and the concrete changes that improve your odds. Findings are
> point-in-time and scoped to the tested queries; the report itself is explicit about that.

**"Send me more info" (the polite brush-off)**
> Best info is the sample itself: getclearsignal.io/sample — 2 minutes to skim. If it looks
> useful for {Client/their site}, the pilot is €149 and takes 2 business days. Should I
> pencil one in?

**Silence after a warm reply:** one nudge after 3 days, then log `closed_no_reply`. Never
argue with a "no" — ask one question instead: "Totally fine — what would have made this a
yes?" and write the answer down verbatim. Those quotes are the product's roadmap.

---

# Apollo run — 40 agencies, one message, no personalization

Owner decision (2026-08-05): skip per-message personalization, send one honest broadcast. This
section is the config and the copy for that.

## Sending: personal mailbox, not the product domain

**Never send cold outreach from `getclearsignal.io`.** That domain delivers paid reports. Burning
its reputation means a customer who paid €149 finds their report in spam, silently.

At this volume no infrastructure is warranted: send from the founder's own everyday mailbox,
**5-10 per working day**, as ordinary one-to-one email. An established personal address out-delivers
any freshly warmed cold domain, and it reads as a person — which is the whole point.

Do not use Apollo's built-in sequencer for this run. Apollo is the *finder*; the sending stays
manual. A sequencer adds tracking pixels and bulk headers that filters read as marketing, and it
removes the one advantage a small run has.

## Apollo filters

Saved search, then **Export → CSV**:

- **Job titles:** Founder, Owner, Co-Founder, Head of SEO, SEO Director, Strategy Director
- **Industry:** Marketing & Advertising
- **Employees:** 2-50
- **Location:** Latvia, Lithuania, Estonia, Finland, Sweden, Denmark, Poland
- **Keywords:** SEO, digital agency, search marketing
- **Email status:** Verified only

Baltics first — a local founder gets replies a cold Londoner never will. Widen only after the first
40 are sent.

## The message

Subject: `AI visibility audits as an agency deliverable`

> Hi {First name},
>
> I build ClearSignal — an audit that tests how ChatGPT, Claude and Perplexity answer real buyer
> questions about a business: which brands get recommended, which sources get cited, and what is on
> the pages that beat them.
>
> I am writing to a small number of SEO agencies because the report is built to be resold. It is an
> agency-ready PDF: evidence per query, competitor share of voice, and a prioritised fix list your
> team implements.
>
> Sample: getclearsignal.io/sample
> A pilot on one of your clients is €149, reviewed by a person, two business days.
>
> If AI visibility is not coming up with your clients yet, a straight "no" is genuinely useful to me
> — I am still working out which agencies this fits.
>
> Alexander
> Riga

Why this works without personalization: it is specific about the product, honest that it is a
broadcast, and it invites a "no". Fake familiarity ("loved your recent post") is what gets ignored;
a short, plain, useful message does not need it.

## Follow-up (once, day 4)

> Hi {First name} — floating this back up in case it got buried. If it is not relevant, no reply
> needed and I will not chase again. Sample if useful: getclearsignal.io/sample

One follow-up only, then `closed_no_reply`. Never a third.

## Legal note

Cold B2B email inside the EU is a grey area under GDPR. Keep this run small, business addresses
only, honest sender identity, and remove anyone who asks — immediately and without argument. If the
run scales past a few hundred, it needs a real legal answer, not this paragraph.

## Expected numbers

40 sent → 8-12 replies is a good outcome for a plain broadcast, and most of those will be "no".
The "no"s carry the finding: log the reason verbatim in `tracking.csv`. Three real conversations out
of 40 is enough to learn whether the offer lands.
