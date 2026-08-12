# Vertical truth — stop guessing what the business is

Fixes `R24` in `DEFECTS_BACKLOG.md`. **Launch blocker.** Ship before any paid audit.

The self-audit of `getclearsignal.io` reported *"Business type: Moving service, Observed locations:
Toronto"*, delivered `MovingCompany` JSON-LD, and offered the reader a **"Get My Moving Quote"**
button. ClearSignal is an audit product with no connection to moving or to Canada.

Nothing was corrupted and no model hallucinated. The code did exactly what it says.

## What is actually wrong

**1. The observer only knows one business.** `inferObservedBusinessContext`
(`lib/business-context.ts:202`) carries a fixed location vocabulary —
`['Toronto', 'GTA', 'Ontario', 'Quebec', 'Canada']` — and a fixed service vocabulary of
`Residential moving`, `Commercial moving`, `Condo moving`. It was written for the `az-moving`
fixture, a Toronto mover, and never generalized. For every other business on earth it can only
return a wrong answer or nothing.

**2. The trigger was our own marketing.** The ClearSignal landing page illustrates the product with
a mock AI answer about movers in Toronto. The observer read that example as the audited business's
identity. Any client site that *mentions* moving, relocation or a Canadian city — a blog post, a
case study, an agency listing the industries it serves — is exposed the same way.

**3. The human's answer loses to a regex.** `materialCategoryForContext` (`lib/materials.ts:32`)
short-circuits on `gallery` and `marketplace` only. Every other `business_model` value falls through
to a keyword match over text that includes `observed.inferred_business_type`. An operator who
selected `saas_software` is overruled by an inferred `"Moving service"`. The single most reliable
signal in the system — a person who confirmed what the business does — is discarded.

## The fix, in order

### 1. Operator-confirmed `business_model` decides the category

When `business_model` is anything other than `unknown` or empty, it selects the material category
outright. No inference, no keyword pass.

Map both vocabularies: `businessModelSchema` (`lib/schemas.ts:18`) and the wider admin list
(`saas_software`, `agency_studio`, `local_business`, `product_business`, `media_publication`,
`nonprofit`, `two_sided_marketplace`, `not_applicable`). The admin field is `enumOrCustom`, so values
outside the enum reach the DB as free text — handle them, and treat an unrecognized custom string as
"no category established" rather than falling back to keyword matching.

### 2. Strip the hardcoded vertical from the observer

Delete the Canadian location list and the moving-service list. Observation must be vertical-neutral
or it must abstain. Removing them costs nothing outside Canada, because the function never worked
for anyone else.

Do **not** replace the list with a bigger list. A gazetteer of world cities has the same shape of
bug with better coverage. If locations are worth observing later, that is a separate, evidence-led
change — for now the operator's `target_markets_languages` and ICP text are the honest sources.

### 3. Abstain when nothing is established

No operator value and no confident observation means the report ships the generic
`Organization` + `FAQPage` pair and states plainly that the business category was not established.

**A missing category is invisible; a wrong one is a refund.** That trade is the whole point of this
task, and it must not be softened into a "best guess".

## Do not

- Do not fix this by editing the ClearSignal landing page to remove the Toronto example. The example
  is good marketing and the observer is the defect. A fix that depends on client sites never
  mentioning the wrong industry is not a fix.
- Do not add more keywords, more verticals, or a smarter regex. `F1` in
  `docs/archive/TASKS_RELEASE_CUT.md` narrowed the input text and left the mechanism; `R3` and now
  `R24` are the same family returning. The mechanism is the bug.
- Do not break the legitimate case: `az-moving` is a real Toronto mover and must still receive
  moving materials when the operator says so.

## Tests

Each starts as a failing fixture.

- A page that merely *mentions* movers and Toronto in an illustrative example does not become a
  moving company. Use the real `getclearsignal.io` copy for this one.
- An operator-set `business_model` overrides any inferred type, including a directly contradictory
  one — set `saas_software` against an inferred `Moving service` and assert the SaaS path.
- A custom `business_model` string outside the enum does not silently fall back to keyword matching.
- With no operator value and no observation, the deliverable is `Organization` + `FAQPage` and the
  report says the category was not established.
- Regression: `az-moving` with `business_model` set to a service/moving value still gets
  `MovingCompany` materials.

## Acceptance

Re-run the `getclearsignal.io` audit from scratch. The report must not mention moving, Toronto, or
quotes for either. With `business_model` left empty it should ship the generic pair and say so;
with it set, it should follow the operator.
