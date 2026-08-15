# TASKS_PLAIN_REPORT — the report is written for an auditor, not for the person who pays

Prompt and copy work in `lib/prompts.ts` (plus a deterministic style check in tests). Touches the
generation path, so it **needs a Trigger deploy from `C:\csdeploy`.**

**No new report sections, no new data, no new engine calls.** Scope is frozen; this changes how the
existing sections are written, nothing else.

## Why

Two of two real readers said the same thing. The clinic owner (`R20`): *"выглядит АИшный документ
на 15 страниц… я не понял"*. The founder, reading the `vertexspain.com` report before sending it to
a friend: *"я не понимаю что там написано"*. When the person who built the product cannot summarise
its own deliverable, the buyer certainly cannot.

A competitor's free-tier report (AI4Life, 2026-08-14, Malta) opens like this:

> "Вас уже называют — и чаще всех: 14 раз, дальше Sparkly, DoDe и Tidy. … На глубокой уборке и
> выезде вас нет ни в одной."

Ours opens like this:

> "Trust signals are thin relative to the stated price range … several structural gaps may reduce
> its effectiveness with the international HNWI buyers it is built to serve."

Same class of finding. One is a sentence a business owner repeats to their team; the other is a
sentence they skim. The facts in our report are already better — the packaging is not.

## What must NOT change

- **The trust layer.** No causal claims about lost customers or revenue, no guaranteed placement, no
  invented numbers. The competitor writes *"Пока там другие — эти люди уходят не к вам"*; part of
  their persuasiveness is a claim they cannot support. **Do not copy it.** Plain language must not
  become confident language about things we did not measure.
- Observational voice ("was observed", "was not named in the tested set"), the scoping caveats, the
  data-limitations block, `lib/sanitize.ts` and `lib/report-validator.ts`. If a style change makes a
  validator rule fire, the style change is wrong, not the rule.
- Section list, schema, scores, evidence handling.

## Changes

### 1. Executive summary: lead with what is working

`actionUserPrompt` (`lib/prompts.ts:477`) asks for `executive_summary` as "3-4 sentences" with no
structure. Give it one:

1. The strongest thing observed to be working, named concretely (a query where the brand was named,
   a proof signal present, a technically clean check) — or, when nothing was observed working, one
   plain sentence saying exactly that, without softening.
2. Where the brand was absent, naming the buyer situations, not the metric.
3. Who appeared instead, by name.
4. The single first action.

Order is not a suggestion: a reader who stops after sentence one must still have learned something
true and useful.

### 2. Sentence-level rules, applied to every generated prose field

Add these to the shared style guidance used by the analysis prompts (`ACTION_SYSTEM`,
`CLARITY_SYSTEM`, `GAP_SYSTEM`, `GEO_ANALYSIS_SYSTEM`):

- One idea per sentence. Target under 20 words; never stack three subordinate clauses.
- Name the thing. "DoDe and Tidy were named instead" beats "competitors carrying stronger category
  signals were named instead".
- No consultant filler: `leverage`, `holistic`, `robust`, `best-in-class`, `synergy`,
  `highest-leverage path`, `represents an opportunity to`.
- **One hedge per sentence, maximum.** Today we write "may reduce", "could weaken", "might suggest"
  two and three to a sentence. Hedging is required by the trust layer; stacking it is not, and it is
  what makes the prose unreadable.
- Prefer the concrete number we measured over an adjective: "named in 4 of 18 answers", not "limited
  visibility".
- Write to the business owner, not about them. Second person where the existing copy already uses it.

### 3. Keep the mechanism visible, drop the throat-clearing

Sentences whose only content is that analysis happened ("Addressing the CTA gap, strengthening
proof, and adding explicit category and FAQ content represent the highest-leverage improvements
available with owned-channel control") say nothing the numbered fixes do not. Cut that shape.

## Acceptance

Deterministic checks over the golden fixture and at least two other stored report fixtures, so this
cannot silently regress:

- A style test asserts that in `executive_summary`, `clarity.*.rationale` and
  `action.top_fixes[].description`: mean sentence length is under 22 words, no sentence exceeds 35,
  and no sentence contains more than one hedging modal (`may`, `might`, `could`, `appears to`,
  `seems to`, `potentially`).
- A banned-phrase test fails on the filler list above.
- `executive_summary` names at least one concrete entity (brand, competitor, engine, or a measured
  count) in its first sentence.
- The full trust-layer suite and the golden-report regression stay green — including every
  observational-voice and no-guarantee assertion. Nothing in this task may relax them.
- `npx tsc --noEmit`, `npm run build`, full vitest suite pass.

## Verification after deploy

Regenerate `beb637a8` (`vertexspain.com`). Read the executive summary aloud. If it cannot be
repeated to a business owner from memory, the task is not done.

## Explicitly out of scope

Do not add a "what the AI got wrong about you" section, do not change which engines are tested or
how many queries run, do not touch the free score's scope, and do not translate the report. Those
are separate decisions with cost and scope consequences; this task is voice only.
