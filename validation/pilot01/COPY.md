# Pilot 01 — copy (v1, 2026-09-27)

Owner-approved texts for Agency Pilot 01. Spec: `TASKS_AGENCY_PILOT_VALIDATION.md`.

Rules:

- Use verbatim. Do not let Apollo AI rewrite anything. Never change copy mid-wave; a new version
  gets a new `email_version`.
- Cold emails carry no links, prices, calendars or offers.
- The Cohort B opener only when GEO/AEO work was verified on the agency's own public pages.
- `{{postal_address}}` is supplied once by the owner. Until then the sequences stay inactive.

---

## 1. Cohort A — traditional SEO agencies (`campaign: pilot01`, `email_version: A1`)

**Step 1 · day 0 · auto email**

Subject: `What do you show the client?`

> Hi {{first_name}},
>
> If a client asked tomorrow, "Why does our competitor show up in ChatGPT and we don't?" — what
> would {{company}} actually show them?
>
> I'm testing a way for SEO teams to answer that with real evidence across ChatGPT, Claude and
> Perplexity, rather than screenshots or gut feel.
>
> Curious how you handle this today.
>
> Alexander

**Step 2 · +4 business days · auto email, same thread**

> Hi {{first_name}}, floating this up once. Even a one-line answer ("clients don't ask about it
> yet") would genuinely help me.
>
> Alexander

**Later, second domain only · +9 business days · auto email, same thread** — not used for the
first 200

> Last note from me. If AI-search questions aren't coming up with your clients yet, that's useful
> to know too. Thanks either way.
>
> Alexander

## 2. Cohort B — agencies already selling GEO / AEO / AI search (`email_version: B1`)

**Step 1 · day 0 · auto email**

Subject: `How are you validating the numbers?`

> Hi {{first_name}},
>
> I saw {{company}} is already working on GEO / AI search.
>
> Curious how you're validating AI-visibility results for clients today, especially when ChatGPT,
> Claude and Perplexity can give different answers from one run to the next.
>
> I'm testing a methodology built around preserving the actual evidence behind the numbers,
> rather than just reporting a visibility score.
>
> Interested in how you're handling that today.
>
> Alexander

**Step 2 · +4 business days · same thread**

> Hi {{first_name}}, one more try: when you report AI-search visibility to clients, is it a
> platform or your own method? A one-word answer helps.
>
> Alexander

**Later, second domain only · +9 business days · same thread** — not used for the first 200

> Last note from me. If you've found a way to make AI-visibility numbers hold up in front of
> clients, I'd genuinely like to hear how. Thanks either way.
>
> Alexander

## 3. Signature (every email)

```text
--
Alexander Kalinko
Founder, ClearSignal
getclearsignal.io
{{postal_address}}
Not relevant? Just reply "no" and I won't follow up.
```

## 4. LinkedIn (owner, by hand, once a week, from the Google Sheet)

Раз в неделю, по таблице:

1. **Заявки.** Строки с `linkedin = todo`, сверху вниз, не больше 50 в неделю. Открыть ссылку →
   Connect без записки → поставить `sent`. Тем, кто уже ответил на письмо, заявку не отправлять.
2. **Кто принял.** LinkedIn → My Network → Connections: у принявших поставить `accepted`.
3. **Сообщение.** Принявшим отправить текст ниже (A или B — смотри колонку `cohort`), затем
   поставить `messaged`.

Никогда не писать тем, кто не принял заявку. Если человек уже ответил на письмо — продолжать
разговор там.

- **A:** Thanks for connecting, {{first_name}}. Quick question: if a client asks why competitors
  show up in ChatGPT and they don't, how are you currently measuring or explaining that?
- **B:** Thanks for connecting, {{first_name}}. Curious: when you report AI-search visibility to
  clients, are you using a dedicated platform already or your own methodology?

## 5. Pilot invitation (owner, after a real reply — see `REPLY_PLAYBOOK.md`)

> Thanks, that's actually why I reached out.
>
> I'm inviting a small number of SEO agencies (ten) into a founding pilot. The full ClearSignal
> audit is a paid product (€149 at our founding price, €399 regular), but I'd be happy to run one
> for {{company}} or one of your clients at no cost.
>
> All I'd ask in return is a few short written answers after you've read it (about 10 minutes):
> what's useful, what isn't, and whether you could realistically use it with clients.
>
> If that sounds fair, I'll need five quick details to set it up.
>
> Alexander

## 6. After "yes"

**Before Phase 2 — intake by email**

> Great. To set it up I just need five things (a quick reply is fine):
>
> 1. The site to audit (your agency or a client)
> 2. What the business sells, in a sentence
> 3. Who buys from them
> 4. Main market and language (e.g. UK, English)
> 5. Up to three competitor websites, if you know them
>
> I review every setup and every report personally; the report usually arrives within 3 business
> days. Once you've read it, I'll send you five short questions.
>
> Alexander

**After Phase 2 — private link**

> Great, here's your private link: {{pilot_link}}
>
> It takes about 2 minutes: pick the site (your agency or a client), tell me who buys from them,
> and name up to three competitors if you know them. I review every setup and every report
> personally; the report usually arrives within 3 business days of your submission.
>
> Alexander

## 7. Intake page — `/agency-pilot/[token]` (Phase 2)

- **Eyebrow:** ClearSignal · Founding Agency Pilot
- **Heading:** Help us pressure-test AI-visibility audits on real agency work
- **Intro:** You're one of up to ten SEO agencies in ClearSignal's founding pilot. We run the full
  audit, the same one clients pay for, on your agency or one of your clients. In return, you tell
  us honestly what's useful and what isn't.

**Value card**

| | |
|---|---|
| The full audit | €149 founding price (regular €399) |
| Your pilot audit | €0 |
| In exchange | About 5 minutes of structured feedback after you've read it |

Under the card: *This is the same audit process as a paid order, not a demo. Future audits are not
free.*

**What you'll receive**

- Real answers from ChatGPT, Claude and Perplexity to buyer-intent questions about the business
- Who gets named and cited instead, with the answers kept as evidence
- A prioritized fix list, reviewed by a person before delivery
- A web report and a PDF you can use with the client

Small print: *Results describe what the engines answered for the tested questions at the time of
testing. No rankings, citations or traffic are guaranteed.*

**Form** (label — help text)

1. Site to audit — "Homepage of the business to audit"
2. Whose site is it? — Our agency / A client
3. What does this business sell? — "One or two sentences"
4. Who buys from them? — "e.g. finance teams at 50–500-person SaaS companies"
5. Main market and language — "e.g. UK, English"
6. Competitors (optional, up to 3) — "Homepage URLs"
7. How do you check AI visibility today? — We don't yet / Manual ChatGPT or Perplexity checks /
   A traditional SEO platform / A dedicated GEO or AEO platform / Our own method or tool / Other.
   Then, optional: "Which tool?"
8. What would make this audit useful to you? (optional)
9. Consent (required checkbox): I understand this complimentary audit is part of ClearSignal's
   Founding Agency Pilot and agree to give about 5 minutes of structured feedback after reviewing it.

Button: **Submit for the pilot**

**Confirmation:** Thanks, {{first_name}}, we have everything we need. I'll review the setup
personally; your report usually arrives within 3 business days at {{email}}. — Alexander

**States**

- Invalid, expired or revoked link (one message for all three): "This pilot link isn't active. If
  you think that's a mistake, reply to Alexander's email."
- Already submitted: "You've already submitted this pilot, thank you. Your report is on its way
  to {{email}}."
- Server error: "Something went wrong on our side. Please try again in a minute." (the form keeps
  what was typed)
- Rate limited: "Too many attempts. Please wait a few minutes and try again."

## 8. Feedback page — `/agency-pilot/[token]/feedback` (Phase 3; draft — rewrite from the first written feedbacks)

- **Heading:** Review your audit
- **Intro:** Thanks for helping pressure-test ClearSignal. There are no "right" answers; critical
  feedback is the most useful kind. About 5 minutes, with an optional deep-dive at the end if you
  have more time.
- **Not ready yet:** "Your report hasn't been delivered yet. This page opens once it has."
- **Progress:** 1 Recommendations · 2 Questions & competitors · 3 Overall · 4 Your practice ·
  5 Next step

**Step 1 — Recommendations** (each fix, as shown in the report)

- "Would your team recommend this to the client?" Yes · Maybe · No
- If Maybe or No — "Why?" Already done · Wrong assumption · Not enough evidence · Too generic ·
  Low priority · Not feasible · Outside our control · Not relevant · Other. Comment (optional).

**Step 2 — Questions & competitors**

- "Tick any question a real buyer in this market wouldn't ask." For each ticked one, optional:
  "How would a buyer phrase it?"
- "Tick anything listed as a competitor that isn't really one." For each ticked one: "What is it?"
  Adjacent competitor · Directory or marketplace · Publication or source · Not relevant · Not sure

**Step 3 — Overall**

- "How useful would this report be in a real client conversation?" 1 (not at all) – 5 (very)
- "Which sections would you show a client?" (multi-select)
- "Which sections would you drop?" (multi-select)

**Step 4 — Your practice**

Cohort A:

- "Are clients asking you about ChatGPT or AI search?" Regularly · Occasionally · Rarely · Not yet
- "Could this become…" (multi-select) A new service · An upsell · An internal diagnostic ·
  A client-retention tool · Not useful

Cohort B:

- "What do you use today?" (multi-select; label it as not exhaustive) Profound · Semrush · Ahrefs ·
  Peec · Otterly · AthenaHQ · Another GEO tool · Internal tool · Manual checks · Other
- "Compared with your current approach, ClearSignal is…" Much better · Better · About the same ·
  Worse · Much worse — rows: Evidence transparency; Client presentation
- "Would ClearSignal…" Replace part of our stack · Complement it · Not add enough · Not sure

Both cohorts:

- "If ClearSignal disappeared tomorrow, what would you use instead?" (optional)

**Step 5 — Next step**

- "Would you like to run it for another client?" Yes · Maybe · No
- "What would you charge a client for a deliverable like this?" amount + currency (optional).
  Shown before the pack card.
- Pack card: "Founding agency pack: 3 audits for {{pack_price}}. The same human-reviewed audit,
  for any of your clients." Button **Get the pack** · link *Not now*
- "May we quote your feedback?" Yes, with my name and company · Yes, anonymously · No (nothing
  preselected, optional)

Submit: **Send feedback**

**Thank-you:** Thank you, this genuinely shapes what we build next. — Alexander

**Optional deep-dive** (collapsed: "Have 10 more minutes? Review in detail")

- Each question: "Would a real buyer ask this?" Yes · Maybe · No; if not: Wrong intent · Wrong
  market · Wrong language · Unnatural wording · Too broad · Too narrow · Other
- Each competitor: Actual competitor · Adjacent competitor · Directory or marketplace · Source or
  publication · Not relevant · Not sure
- Each recommendation: "Supported by the evidence in the report?" Yes · Partly · No · Can't tell;
  "Applicable to this business?" Yes · Partly · No

Agencies are never asked to verify what the engines returned or the arithmetic; that is the
system's job.

## 9. Feedback emails (automatic, Phase 3)

**Request — 24 hours after delivery**

Subject: `Could you pressure-test the audit?`

> Hi {{first_name}},
>
> Thanks again for being part of the pilot. Now that you've had the report, I'd really value the
> part of the exchange that's most useful to me: your honest reaction.
>
> It takes about 5 minutes: which recommendations you'd actually use, what you'd cut, and whether
> this could work with your clients.
>
> {{feedback_link}}
>
> Negative feedback is just as useful as positive.
>
> Alexander

**Reminder — once, 4 days after the request, only if there is no feedback**

Subject: `Re: Could you pressure-test the audit?`

> Hi {{first_name}}, a gentle nudge on the 5-minute feedback for the {{site}} audit:
> {{feedback_link}}
>
> If it wasn't useful, that's exactly what I need to hear.
>
> Alexander

## 10. After the pilot (owner, by email)

See `FEEDBACK_EMAILS.md`: the five questions, the reminder, the pack offer and the referral ask.
