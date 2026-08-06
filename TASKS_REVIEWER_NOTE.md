# Reviewer note — make the human review visible

Fixes `R20`. The first real reader of a ClearSignal report — a business owner, not a tester — said:
**"выглядит АИшный документ на 15 страниц. Не человек писал, Сгенерировано."**

The analysis was not the problem. The report was mechanically clean, the competitor data real, the
recommendations specific. It still read as machine output, because nothing in it showed a person had
been involved. "Expert-reviewed" is half the differentiation against $29/mo scanners and half the
justification for €149, and the deliverable contains no trace of the expert.

This ships before the first paid sale. It is the cheapest possible defence of the price.

## What to build

**One nullable text column** on `audits` — `reviewer_note` — plus a migration. It must be a separate
field from `admin_notes`: those are internal operational logs full of timestamps and error strings
and must never reach a customer.

**Admin:** a textarea on the audit card, saved the same way notes are today. Label it so the operator
knows it is client-facing — e.g. "Reviewer note (printed at the top of the client report)". Show a
character guide, not a hard cap: this should be three or four sentences, not an essay.

**Report and PDF:** when the field is non-empty, render it **above the executive summary**, visually
distinct from generated content — a bordered block in the brand palette, headed with the reviewer's
name and role. Nothing renders when the field is empty; existing reports are unaffected.

**Attribution:** read the name from `REVIEWER_NAME` (env), falling back to a generic
"ClearSignal reviewer". A note printed with no human name attached defeats the purpose.

## Wording of the block header

The header must state what actually happened, and nothing more:

> **Reviewed by {name}** — read the full report before delivery.

Do not write "verified", "approved", "guaranteed" or anything implying the reviewer re-tested the
engines. They read the report; that is the claim.

## Do not

- **Do not make the generated prose sound more human.** The objection is about evidence of a person,
  not about tone. Faking the voice while nobody actually reviewed it is worse than today.
- Do not auto-generate the note, pre-fill it from the report, or offer suggested text. An
  LLM-written "reviewer note" is precisely the thing this exists to disprove.
- Do not surface `admin_notes` to the client, and do not merge the two fields.
- Do not block delivery on the note being filled. Some audits will go out without one; that is the
  operator's call, and a forced field would get filled with junk.

## Tests

- A report with a note renders it above the executive summary, with the reviewer name.
- A report without a note renders byte-identical to today.
- `admin_notes` never appears in the client report or the PDF (guard the regression directly).
- The note is escaped in HTML and PDF like any other client-facing string.

## Acceptance

A reader who opens the PDF sees, before anything generated, a few sentences a person wrote about
their business — and can tell a human looked at this. The operator can write one in under a minute.
