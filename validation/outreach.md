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

**"Why pay for this when ChatGPT does it free?"** — expect this one; log it verbatim every time.
> Fair, and I have the comparison in hand: a business owner ran his own site through ChatGPT and
> sent me the result. It was good — it caught page-level problems my report missed, and I am fixing
> that. But look at what it cannot do. Its headline score has no method behind it; ask again and you
> get a different number. It never queried an engine about the business, names no competitor, and
> reports no share of voice. It is a website review presented as an AI audit.
>
> What I run is six buyer questions across three engines — eighteen answers, counted. "Named in 4 of
> 18; this competitor in 6; your site cited 7 times as a source." All eighteen answers are in the
> report.
>
> For an agency the difference is billability: you cannot invoice a client for advice they could
> generate in a chat window in two minutes. You can invoice for implementation justified by a number
> that survives "how do you know that?"

**"We could build this ourselves."**
> Probably — the hard part is not the idea. It is the trust layer: never inventing a number, never
> promising a ranking, keeping every claim tied to an observed answer. That took most of the build
> and it is what makes the report safe to put in front of your client. If you do build it, I would
> genuinely like to hear how it goes.

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

Subject: `Is anyone asking you about ChatGPT yet?`

> Hi {First name},
>
> I'm Alexander, based in Riga. I'm building something and I'd like a sanity check from people who
> actually sell this stuff for a living.
>
> It checks what ChatGPT, Claude and Perplexity say when someone asks a buying question in a
> client's niche — who gets named, who gets cited, who doesn't come up at all.
>
> I ran it on a Riga clinic last week. Turned out their own site is the most-cited source in the
> whole category, ahead of every competitor. But when someone asks "where should I go", the engines
> name a competitor three times more often than the clinic. So the AI reads them and recommends
> someone else. They had no idea.
>
> That gap doesn't show up in a rank tracker, because it isn't a ranking.
>
> The output is a PDF you could hand straight to a client: every question, every answer, who came up
> instead, and a fix list with the schema and copy already written. You'd do the implementation.
>
> €149 for one client's site, two days, and I read every report before it goes out.
>
> Sample: getclearsignal.io/sample
>
> Mostly I want to know whether this is something you'd ever sell, or whether I'm solving a problem
> nobody's asking about yet. "No" is a useful answer.
>
> Alexander

Why this reads as a person and not a brochure:

- **Contractions everywhere.** "I'm", "doesn't", "you'd", "nobody's". Their absence is the single
  biggest reason a draft feels machine-written.
- **One idea per sentence, no colons introducing lists.** The earlier draft had three colons and two
  comma-separated feature lists; that is landing-page grammar, and agency owners recognise it.
- **A finding, not a product.** Every agency inbox contains "I built a tool". A specific, checkable,
  slightly surprising fact does not.
- **"They had no idea."** A human observation about a real person. Nothing in a template says that.
- **Genuine uncertainty at the end.** "Or whether I'm solving a problem nobody's asking about yet"
  is true, invites honesty, and is the opposite of a confident pitch. It raises reply rates because
  answering costs the reader nothing.
- **Peer framing.** "A sanity check from people who actually sell this stuff" puts them above you,
  not in a funnel.
- **Price in message one**, so an agency that balks at €149 self-selects out immediately.

Signature is the first name only. "Founder & CEO, ClearSignal" sounds bigger than a one-person
company and undercuts the peer framing.

Anonymise the clinic. "A Riga clinic" carries no identifying detail; do not name the business.

Language: send in English. Every Baltic agency principal works in it, and it avoids choosing between
Latvian, Lithuanian and Estonian. If you are comfortable writing Latvian, use it for `.lv` agencies
only — same text, and log whether it changes the reply rate.

## Follow-up (once, day 4)

> Hi {First name} — bumping this once in case it got buried. If it's not your thing, no reply
> needed and I won't chase. Sample if you're curious: getclearsignal.io/sample

One follow-up only, then `closed_no_reply`. Never a third.

## Legal note

Cold B2B email inside the EU is a grey area under GDPR. Keep this run small, business addresses
only, honest sender identity, and remove anyone who asks — immediately and without argument. If the
run scales past a few hundred, it needs a real legal answer, not this paragraph.

## Expected numbers

40 sent → 8-12 replies is a good outcome for a plain broadcast, and most of those will be "no".
The "no"s carry the finding: log the reason verbatim in `tracking.csv`. Three real conversations out
of 40 is enough to learn whether the offer lands.
