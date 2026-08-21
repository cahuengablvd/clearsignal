# TASKS_REPORT_COHERENCE — three sections of one report disagree with each other

**Defects:** `R35` (the first action differs between sections), `R36` (confirmed operator category is
discarded by ready materials), `R37` (a fix claims a signal is missing that the findings recorded as
present). Touches `lib/report-validator.ts`, `lib/materials.ts` and `lib/prompts.ts`, so it **needs a
Trigger deploy from `C:\csdeploy`.**

## How these were found

The human-review gate stopped audit `beb637a8` (`vertexspain.com`) before delivery on 2026-08-20.
All three passed the validator, the trust layer and 392 tests. They are contradictions *between*
sections, and nothing in the pipeline compares sections to each other.

The report was generated on Trigger `20260815.3`. Some of what the reviewer saw may be an artefact
of that build — but each defect below is confirmed absent from the current code by inspection, not
by regeneration, and each must be fixed regardless.

---

## R35 — the "first action" differs between summary, action plan and ship-first

`docs/archive/TASKS_PLAIN_REPORT.md` requires the executive summary to end with "the single first
action". Nothing makes that sentence agree with `action.top_fixes[0]` or with `ship_first[0]`.
`report-validator.ts:736` only touches `executive_summary` when it is empty, and `ship_first` is not
cross-checked anywhere. Three sections name a first step independently, and they diverged.

A reader who takes the summary at face value starts on a different task from the one the plan calls
first. In a deliverable whose whole promise is "what to fix first", this is the worst possible
inconsistency.

**Fix:** make one section the source of truth — `action.top_fixes[0]` — and require the others to
agree with it. The summary's closing sentence must name that fix; `ship_first[0]` must be the same
action. Prefer instructing the generator and then verifying deterministically: if they disagree
after generation, rewrite the dependent sections from `top_fixes[0]` and record a warning. Never
silently reorder `top_fixes` to match prose.

---

## R36 — ready materials say the category is unknown while the operator confirmed it

`operatorMaterialCategory` (`lib/materials.ts:32`) maps only `gallery`, `marketplace`,
`moving_service`, `video_production` and `tailoring_atelier`. Every other confirmed value — including
`local_business`, which the operator selected for a Marbella real-estate brokerage — falls through
to `default`, and the generic copy states the business category was not established.

This is the mirror image of `R24`. There, abstention protected the customer from a confident wrong
category. Here, abstention overrides a category a human confirmed, and the report tells a broker we
do not know what they do — directly under a business-context block that says exactly what they do.

**Fix:** a confirmed `business_model` must reach the generated copy even when no bespoke material
template exists for it. Keep the specialised templates as they are; when none matches, the generic
template must still be told the confirmed category in plain words and must not claim the category is
unestablished. Only a genuinely unknown or absent `business_model` may produce the "not established"
wording.

Do not fix this by adding a template per vertical — that is the hardcoded-vertical trap `R24`
closed.

---

## R37 — a recommendation contradicts a deterministic finding

The report recorded JSON-LD as detected on the page and, elsewhere, told the client to add JSON-LD
because it was missing. One statement is measured, the other is generated prose; they cannot both
stand.

The machinery for this already exists: the validator maps fixes to `OBS-*` evidence ids and strips
inappropriate links (`lib/report-validator.ts:670-692`). It checks that a fix cites *relevant*
evidence; it never checks that a fix does not *contradict* the evidence.

**Fix:** add a contradiction check over the deterministic findings. When a finding's status is
`present`, no fix, ship-first item or ready-material note may assert that the same signal is absent
— and the reverse for `absent`. Cover at least the signals the findings already produce: JSON-LD,
meta description, H1, FAQ structure, primary CTA. A contradiction is a validation **error** on the
prose, repaired by dropping or rewriting the offending item, not by editing the finding: the
measurement wins over the sentence, always.

---

## Acceptance

Each starts as a failing test.

- A generated action block whose summary names a different first action from `top_fixes[0]` is
  reconciled, with a warning; the delivered report names one first action in all three places.
- A report with `business_model: local_business` produces ready materials that name that category and
  never say the category was not established. A report with `business_model: unknown` still does.
- A fix that says "add JSON-LD" alongside `OBS-SCHEMA-001: present` fails validation and is dropped
  or rewritten; the finding is untouched.
- The same check fires for meta description, H1, FAQ and CTA.
- The `R24` regressions stay green: an unconfirmed business model still abstains rather than guesses.
- `npx tsc --noEmit`, `npm run build`, full vitest suite pass.

## Verification after deploy

**Only after `TASKS_SPEND_GUARD.md` is live** — that guard exists so this verification cannot repeat
the 2026-08-20 spend. Then regenerate `beb637a8` once and review it by hand again. Coverage was
`9/18` on the old build; record what it is now as the next data point for `R30`, and do not
investigate `R30` inside this task.
