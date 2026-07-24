# Two-week sales test — the plan

Goal: find out whether anyone pays €149 for an expert-reviewed AI Visibility Audit,
starting with the segment the strategy already names first: SEO/digital agencies with a
client base. This is not marketing at scale — it is 20-40 personal messages and a handful
of calls, done by the founder, 30-60 minutes a day.

**Nothing in the product changes during these two weeks.** If nobody buys, the answer is a
different offer, price, segment or explanation — not a new feature. Defects found by real
customers go to `DEFECTS_BACKLOG.md` as always.

## The numbers

| Stage | Target over 2 weeks |
|---|---|
| Targets listed | 40 (25 agencies, 15 service businesses) |
| First messages sent | 40 (5 per working day) |
| Replies | 8-12 is normal (20-30%) |
| Real conversations (call or substantive email thread) | 10+ |
| Paid audits | **3+, at least 1 from an agency** |
| Second audit requested by the same agency | 1 = the strongest possible signal |

## Who to look for

**Agencies (primary):** SEO / digital / web agencies, ~5-30 people, 20+ active clients,
selling audits/content/technical SEO already. The buyer is the owner, Head of SEO, or
Strategy Director. Where to find them:

- LinkedIn search: `SEO agency` / `digital agency`, filter by region (Baltics, Nordics, EU —
  English-friendly markets first), company size 2-50.
- Clutch.co and Sortlist listings for SEO agencies (they list size and client focus).
- Riga/Baltic agencies first: a local founder gets replies a cold Londoner never will.
- Any marketing/founder community you already sit in (Telegram, Slack, Facebook groups) —
  one post + direct messages beat 20 cold emails.

**Service businesses (secondary):** owner-operated companies where buyers google/ask AI
before choosing — clinics, law firms, movers, cleaners, repair, B2B services. You already
have warm examples: every business whose audit exists as a fixture is a door.

## Daily routine (30-60 min)

1. Add 3-5 new targets to `tracking.csv` (name, company, channel, link).
2. Send 5 first messages (templates in `outreach.md`). Personalize ONE line per message —
   name a real client of theirs or a real query. No mass tools, no Apollo yet.
3. Send follow-ups to anyone silent for 3+ days (max 2 follow-ups, then `closed_no_reply`).
4. Log every reply the same day. A reply logged a week later is a lost thread.
5. When someone bites: offer a 25-minute call (script in `interview-agency.md`) or, if they
   are ready sooner, send the sample report + checkout link straight away. The call is a
   tool, not a gate — never delay a willing buyer into an interview.

## The offer, in one breath

> We test how ChatGPT, Claude and Perplexity actually answer buyer questions about a
> business — who gets recommended, who gets cited, and why. Then a human-reviewed report
> turns that into a prioritized fix list. One-time, €149, delivered in 2 business days.
> Sample: getclearsignal.io/sample

## Payments note (read once)

Live Stripe is configured but the control purchase has not happened yet. Two safe paths:

- **Best:** do the €149 control purchase + refund with your own card before the first
  customer pays. Costs the non-refundable Stripe fee (~€2.50), buys certainty.
- **Acceptable:** treat the first real customer as the supervised first transaction — watch
  `/admin` and the Stripe dashboard the moment they pay; if the webhook misfires, the audit
  row and recovery path make it fixable by hand. Do not let a failed first payment go
  unnoticed for hours.

## Go / no-go after two weeks

**GO (write the investor deck on real numbers):** 10+ real conversations, 3+ paid audits,
at least one agency buyer, and at least one agency asking about a second client. Fulfilment
per audit stayed under ~2-3 hours of human time.

**PIVOT (change offer/price/segment, not features):** conversations happen but nobody pays.
Collect the exact objection quotes from `tracking.csv` — they ARE the finding.

**STOP-AND-THINK:** you cannot get 10 conversations at all. Then the problem is upstream of
price — the message, the channel, or the segment. Bring the tracking sheet and we diagnose.

## What NOT to do during the test

- No white-label, no agency dashboard, no monitoring promises. If an agency asks: "on the
  roadmap after pilot demand is proven — today you get an agency-ready PDF."
- No discounts below €149 to force a yes. A discounted yes teaches nothing about the price.
  (An agency 3-pack at €297-349 MAY be floated if they push on volume — log it, don't build it.)
- No custom report changes per prospect. One product, one price, two weeks.
