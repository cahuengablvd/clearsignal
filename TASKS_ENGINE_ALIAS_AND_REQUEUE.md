# TASKS_ENGINE_ALIAS_AND_REQUEUE — an engine alias slips through, and a queued audit can run twice

Two small, unrelated fixes that both surfaced during the `R28`/`R29` verification. They touch
different files and can be done in one session. Touches `lib/geo/*` and `lib/audit-recovery.ts`, so
it **needs a Trigger deploy from `C:\csdeploy`**, plus a hand-applied migration (see part B).

---

# PART A — `R28` residual: "Google AI" is not on the exclusion list

The engine exclusion added in `126be3c` compares normalised keys: `competitorKey` strips
non-alphanumerics, so `Google AI Overviews` becomes `googleaioverviews` and `Google` becomes
`google`. A model that writes **`Google AI`** produces `googleai`, which matches neither. The row
survives and the report again tells a client that an answer engine is a competitor.

Adding one more literal to `ANSWER_ENGINE_COMPETITOR_NAMES` (`lib/engine-scope.ts:15`) fixes this
input and not the next one — `ChatGPT Search`, `Google AI Mode`, `Bing Copilot` are all one model
phrasing away.

**Fix:** match by tokens, not by whole string. Keep the existing literal list for exact matches, and
add a rule: a discovered name is an answer engine when **every** token in it belongs to a small
vendor vocabulary — `google, openai, chatgpt, anthropic, claude, perplexity, gemini, copilot,
microsoft, bing, ai, overviews, mode, search, assistant`. Single-token names must still match the
literal list, so `AI` alone or a brand like `AI4Life` is never excluded by the vocabulary rule.

Acceptance (failing first):
- `Google AI`, `Google AI Mode`, `ChatGPT Search`, `Bing Copilot` are all excluded.
- `Ahrefs`, `Semrush`, `AI4Life`, `Perplexity Labs Consulting` (a hypothetical real company) are
  **not** excluded — the last one has a token outside the vocabulary.
- An engine name supplied explicitly by the operator still appears, as today.

---

# PART B — `R33` is wider than a manual-requeue race

Recorded as "recovery may enqueue a manual regeneration a second time". The cause is more general:
`recoverStuckAudits` (`lib/audit-recovery.ts:82`) selects **every** audit in `audit_status = 'queued'`
with no age condition, while the stale-`processing` branch beside it correctly filters on
`processing_started_at < cutoff`.

So any audit sitting in `queued` when the sweeper runs is re-enqueued — including a **paid customer's
audit queued seconds earlier by the Stripe webhook**, not just an operator requeue. The window is
"between enqueue and the worker picking it up". The result is two generations of the same audit:
double API spend, duplicate stage executions, and the `duplicate_stage_warning` the admin already
knows how to display.

**Fix:** give `queued` the same age condition the `processing` branch has.

1. Add a `queued_at timestamptz` column and set it wherever an audit enters `queued`
   (`lib/audit-queue.ts:56` and the operator requeue path). Per `R23`, **apply the migration in the
   same step as the code that reads the column**, and add it to `ADMIN_AUDIT_COLUMNS` so
   `/api/health` reports it if it is ever missing.
2. Recovery only considers a `queued` audit stuck when `queued_at` is older than a named threshold —
   reuse `STALE_PROCESSING_MS` unless there is a reason to differ, and state the reason if so.
3. An audit with no `queued_at` (rows queued before this change) must be treated as **not** stuck
   until it has aged past the same threshold measured from `last_generated_at` or `created_at` —
   never as immediately recoverable, which would reintroduce the double run on historical rows.

Acceptance (failing first):
- An audit queued 30 seconds ago is not picked up by recovery; the same audit queued past the
  threshold is.
- A stale `processing` audit is still recovered exactly as today.
- A row with `queued_at = null` and a recent `created_at` is not recovered.
- The `R32` override still releases a deterministically failed audit, and recovery does not
  immediately re-enqueue it.

---

## Both parts

- `npx tsc --noEmit`, `npm run build`, full vitest suite pass.
- After deploy: regenerate `9ba2d5ec` and `28ca503b` once more and confirm no engine name appears in
  "Who AI recommends instead" — that finally closes `R28`. Record the surviving fix count for each in
  `STATUS.md`; those are data points three and four for the plain-language watch list.
