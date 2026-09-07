# TASKS_FRONTIER_HORIZON_A_V2_2 — canonical operational roadmap (2026-09-07)

**Architect:** Fable 5.1. **Status:** CANONICAL for all forward-looking Horizon A execution from 2026-09-07.
**Supersedes:** `TASKS_FRONTIER_HORIZON_A_V2_1.md` (and through it V2 and V1) for sequencing, gates and
requirements. Those files stay in the repository as history only; move them to `docs/archive/` when the
owner is ready. **Nothing in this document is implemented.** It changes no code, no migration, no
production data, and it authorises no provider call by itself.

Repository state this was written against: HEAD `319851d`, Vercel `/api/health` = `319851d`, Trigger
`20260904.5` deployed from the same SHA (`STATUS.md`, 2026-09-04). Working tree carries pre-existing
uncommitted changes that do not affect measurement.

**Amendment 1 (2026-09-07, operator, pre-implementation):** U-1 resolved from repo evidence and turned into
PX-0 for the residual row-level confirmation; PX-1 retention architecture decided (unified
measurement/retention ceiling, §5); U-2 and U-4 marked non-blocking for PX-1; U-3 split into resolved and
experiment-preparation unknowns. The execution sequence is unchanged.

## Authority order (applies to every section)

1. `STATUS.md` — current operational truth (what is deployed, verified, blocked).
2. Accepted production evidence: verified commits, controlled audits `bcdbba5a` (A1), `d1d99664` (A4),
   `d8945b66` (A3), paid Alahli audit `1e9122fe` (RD-00…RD-06 on stored evidence), and the code at `319851d`.
3. `CLEARSIGNAL_FRONTIER_REVIEW_G2_2026-09-02.md` **including its embedded ADDENDUM 2026-09-02**. Where the
   G2 body and the addendum disagree, the addendum wins.
4. Astra pre-freeze review (2026-09-07, delivered as Sections A–G in the operator brief). Its amendments
   listed in §24/§25 are accepted and override G2 where they conflict.
5. `TASKS_FRONTIER_HORIZON_A_V2_1.md` — historical roadmap, no longer authority.
6. `CLEARSIGNAL_EVALS_AND_MEASUREMENT_2026-08-21.md`, `CLEARSIGNAL_FRONTIER_REVIEW_2026-08-21.md`,
   `CURRENT_STATE_2026-08-21.*` — historical design inputs.
7. `PARALLEL_TRACK_REPORT_IA_RESET_REVIEW.md` — parallel presentation/client-workflow track only.

Conflicts are not silently reconciled. Every conflict this document resolves is recorded in §25 with the
rule that decided it. Working rules carried over unchanged from V2.1 and `AGENTS.md`: one task = one
session (Codex and Claude Code alike); cheapest model that can do the job; anything under `lib/geo/*`,
`lib/audit-runner.ts`, `lib/report-*`, `lib/schemas.ts`, `lib/report-validator.ts`, `trigger/*` needs a
separate Trigger deploy from `C:\csdeploy`; every evidence filter must cover the reuse path with its own
test over saved data; non-ASCII in `.ts` only as `\u` escapes; `npx tsc --noEmit`, `npm run build`
(never alongside a dev server) and full vitest after each initiative; `lib/sanitize.ts` and
`lib/report-validator.ts` are never weakened.

---

## 1. Purpose / canonical status

This roadmap answers one question: **what must be true for the next five paying ClearSignal audits to be
reliable, implementable and repeatable**, and in what order the remaining Horizon A work is done to get
there. It reconciles six inputs — production state, the G2 adjudication, the Alahli first-client
evidence, Astra's independent red-team review, the existing evaluation architecture in `evals/`, and the
Report IA / delivery-UX track — into one sequence with explicit gates.

It is written so that a future Codex or Fable session can work from it without reconstructing history.
Each gate has exit criteria. Each experiment has a decision rule that includes an INCONCLUSIVE outcome.
A2 is not started until an explicit decision record (§12) is frozen.

## 2. Current state snapshot (2026-09-07)

| Item | State | Source |
|---|---|---|
| Vercel production | `319851d` | `STATUS.md` |
| Trigger.dev | `20260904.5`, deployed from `319851ddcc…` (`C:\csdeploy`), runtime `node-22`, `git.dirty: false`, 5 tasks | `STATUS.md` |
| Supabase | migration `014_daily_ai_spend_guard.sql` applied 2026-08-21 | `STATUS.md` |
| Alahli `1e9122fe` — **canonical client evidence** | second acquisition for `alahli.com`; provider calls only on 2026-09-02 with RD-00 capture live; zero-call cached-stage recovery and two zero-call re-renders since; final render at `319851d`/`20260904.5`; `awaiting_review`, 30-page PDF passed Fable review; delivery waits on the owner reading four reviewer notes (none need code); operator alias present, brand named in 10 of 18 | `STATUS.md`; its stored report (`tmp/design-fixture-source.json`, untracked) |
| Alahli `63bfd278` — historical | first paid acquisition 2026-08-25 on pre-A3, pre-R39, pre-RD-00 code; named in 1 of 15; never regenerated or re-rendered per `STATUS.md`; the R39 verification line still points at it → disposition decided in PX-0 (§5) | `STATUS.md`, `DEFECTS_BACKLOG.md`, `docs/archive/TASKS_BRAND_ALIASES.md` |
| Controlled audits | A1 `bcdbba5a`, A4 `d1d99664`, A3 `d8945b66` — all `awaiting_review`, not delivered | `STATUS.md` |
| Human labels | entities 0/27 approved, queries 0/30, samples 0/61 (all `pending`) | `evals/labels/*.v0.json` |
| Golden fixtures | 5 reports (`rozie`, `az-moving`, `snoika`, `getclearsignal`, `vertex`), manifest, deterministic baseline | `evals/golden/`, `evals/baseline/` |
| Eval command | none (`package.json` has `test`, `build`, `codex-usage`, orchestrator scripts only) | `package.json` |
| Sampling | `sample_index: 1` hard-coded in fresh capture (`lib/geo/index.ts:361`, `:474`); `acquisition_protocol.samples_per_combination` is `z.literal(1)` (`lib/schemas.ts:578`) | code |
| Stored text ceiling | `ANSWER_TEXT_LIMIT = 24_000` (`lib/geo/coverage.ts:15`) | code |
| Provider concurrency | per-scan, per-provider queue, defaults 3/2/3, env `GEO_PROVIDER_CONCURRENCY_*` (`lib/geo/provider-limiter.ts`) | code |
| Open defects | R13, R16, R18, R19, R20, R21, R22, R30, R38, R39 | `DEFECTS_BACKLOG.md`, `STATUS.md` |
| Owner-blocked | live Stripe control purchase + refund; legal review of terms/privacy/refund/VAT | `STATUS.md` |
| Report design lab | Round 1 done (defective), Round 2 spec ready, not started — presentation only | `STATUS.md` |

**Code findings verified today (not re-derived from the packet):**

- Fresh detection measures on the complete provider response (`r.answer`) and stores a slice
  (`r.answer.slice(0, ANSWER_TEXT_LIMIT)`) — `lib/geo/index.ts:443–466`. Reuse detection measures on the
  stored `answer_text` — `lib/audit-runner.ts:207–209`. A mention after character 24,000 therefore exists
  in fresh measurement and disappears on recomputation. `tests/geo-capture.test.ts` covers the truncation
  flag, not this parity case.
- Reuse keeps the previous `entity_observations` when the new resolution returns none —
  `lib/audit-runner.ts:328` (`observations?.length ? { entity_observations } : {}`). This is the fail-closed
  defect recorded in `STATUS.md` "Deferred follow-up".
- The fresh-path `buildMeasurementMethodology` (`lib/geo/index.ts:701–716`) emits no
  `untested_languages_disclosure` and no `search_mode_disclosure`; the reuse path
  (`lib/audit-runner.ts:371–382`) emits both. A fresh or regenerate run therefore discloses less than a
  re-render of the same evidence. This is the "Trigger Regenerate path still lacks the Arabic disclosure"
  note in `STATUS.md`, generalised.
- `entity_resolution` acceptance rule (`distinct_queries ≥ 2 || distinct_engines ≥ 2 || domain_corroborated`
  or operator-provided) is stable under repeats by construction, but no resolver-level test asserts that
  repeated samples of one (query, engine) pair do not count as distinct queries or engines.

## 3. DONE / PARTIAL / NOT STARTED / SUPERSEDED matrix

| Initiative | Status | Evidence | What remains (and where it lives) |
|---|---|---|---|
| Phase 0 baseline | **DONE / BASELINE** | `evals/golden/*`, `evals/labels/*.v0.json`, `evals/baseline/BASELINE_2026-08-21.md` | Human calibration of labels is separate → §6 (27 entity labels) and §16 |
| A1 measurement integrity | **DONE / BASELINE** | production-verified `bcdbba5a`; status taxonomy, ledger, coverage gate, `answer_text`, approve 409 | none; do not reopen |
| A4 query provenance | **DONE / BASELINE** | production-verified `d1d99664`; core/supplemental separation, validators, `query_provenance` | none; do not reopen |
| A3 entity precision (product behaviour) | **DONE / BASELINE** | production-verified `d8945b66`; entity states, spans, strict merges, mention-not-recommendation wording | none as product behaviour. Two bounded exceptions handled elsewhere: stale-observation reuse defect (§5 PX-2), same-pair repetition test (§6). **Human precision evaluation is not complete and belongs to A5a; that does not make A3 incomplete.** |
| RD-00 acquisition capture | **DONE, one retention exception** | Alahli `1e9122fe` fields verified: `retrieved_urls`, `cited_urls`, `citation_attachment`, `engine_issued_queries`, `stop_reason`, `truncated_at`, `raw_response_sha256`, per-row timestamps, `acquisition_protocol`, `acquisition_operational` | Retention exception = RD-04 row below (§5 PX-1) |
| RD-01 composite guards | **DONE** | `ai_visibility_score: null` + `score_breakdown.unavailable_reason` when comparison/citation components undefined; no renormalisation (`lib/audit-runner.ts:362`; `rd-pre-delivery-hardening` tests) | none |
| RD-02 citation semantics | **DONE for current capture** | `citation_attachment: resolved / unresolved / unsupported`; unresolved rows outside the citation denominator; retrieval separate; legacy evidence explicitly `mixed_legacy` | Legacy stays legacy; never recomputed into `cited` |
| RD-03 identities | **DONE baseline** | `acquisition_protocol` (version `rd-00`) separate from `computation_version` / `computed_by` (`rd-01-06`), rendering outside | A2 extends both with repeated-sampling configuration and actual timing (§13); `samples_per_combination` literal must become a bounded integer |
| RD-04 censoring + retention | **PARTIAL / OPEN EXCEPTION** | censoring disclosure exists (`absence_observation: censored`, `truncated_at`) | measured text may exceed retained text (§2 finding 1) → **PX-1, pre-experiment blocker; architecture decided (unified ceiling, §5)** |
| RD-05 provider concurrency | **DONE within scope** | per-scan, per-provider limiter, defaults 3/2/3 | It is **not** an account-wide or cross-process limit. Experiments must be scheduled and budgeted so they do not compete with paid audits (§7.4) |
| RD-06 methodology disclosure | **PARTIAL across execution paths** | reuse/re-render path complete and verified on Alahli PDF (English-only frame, Arabic-not-tested, search-mode line) | fresh and Trigger regenerate paths emit less (§2 finding 3) → **PX-3** |
| A2 repeated sampling | **NOT STARTED as a feature** | sample identifiers and counting groundwork exist; production still hard-codes one sample | full contract in §13 after the decision record in §12 |
| A5a evaluation | **PARTIAL** | golden fixtures, label schema, focused regressions (`geo-capture`, `rd-pre-delivery-hardening`, `a3-reuse-parity`, `provider-limiter`, `evals-golden-compat`, `production-artifact-regression`) | no eval command, no approved-label evaluation, gate suites incomplete → A5a-GATE (§6, §14) and A5a-COMPLETE (§16) |
| A5b structured review | **NOT STARTED** | existing delivery approval, `admin_notes`, `reviewer_note`, `report_versions` are not a `ReviewDecision` system | narrow scope in §17 |
| Report IA / delivery UX | **PARALLEL TRACK** | IA review exists; prototype task file referenced by it is not in the repo root (§25 U-2) | §19 |
| Superseded designs | **SUPERSEDED** | see §24 | — |

## 4. Accepted architecture invariants

These hold for every initiative below. A change to any of them is a new architecture decision, not an
implementation detail.

1. **Trust layer.** No invented numbers, no guaranteed outcomes, observational language, findings scoped to
   the tested query set and observation window. `lib/sanitize.ts` and `lib/report-validator.ts` are not
   weakened. Human review before delivery (`AUTO_DELIVER_AUDITS` false in prod).
2. **Mention ≠ candidate ≠ recommendation ≠ first choice.** Horizon A measures mentions and citations only.
   Client surfaces never say "recommends" about entities (V2.1 terminology contract, shipped in A3).
3. **Measurement uses only retained evidence.** Every deterministic text-derived signal (`brand_mentioned`,
   `brand_position`, `competitors_mentioned`, `entity_observations`) is computed from exactly the text that
   is durably stored, so a stored-evidence recomputation reproduces the fresh result with zero provider
   calls. Text that is not retained is not measured; a storage-ceiling hit is an explicit censored state,
   never a silent loss. A sample whose retained text cannot be shown complete is marked non-recomputable
   and is never recomputed from partial text. (Closes the RD-04 exception; see PX-1.)
4. **Three identities.** `acquisition_protocol` (what was requested of providers: engines, models, tool
   versions, limits, location, requested n, schedule, plan hash) is immutable per acquisition.
   `computation_version` / `computed_by` names the rule set that derived metrics and is rewritten on every
   recompute. Rendering is outside measurement identity. Observed `model` strings are facts, not protocol.
5. **Citation counts only on resolved attachment.** `unresolved` and `unsupported` rows are outside the
   citation denominator; `retrieved_urls` never become citations; legacy `mixed_legacy` stays legacy.
6. **No renormalisation.** When a component is undefined the composite is `null` with a reason; weights
   stay fixed; components are preserved.
7. **Per-engine results are primary.** The single global pool is retained for compatibility only, computed
   over successful observations and explicitly labelled "pooled over successful observations, weighted by
   availability". No equal-engine reweighting; no business weights.
8. **Unknown states stay distinct.** Acquisition failure, skipped cells, citation-attachment uncertainty,
   censoring, and observed disagreement are never collapsed into one bucket or into "negative".
9. **Core / supplemental isolation.** Six single-language core slots carry every metric, gate and index;
   supplemental probes are reported separately and never enter core denominators or the core budget.
10. **Reuse-path parity.** Any filter, resolver or metric applied on the fresh path is applied identically
    on `recomputeReusedGeoEvidence` / `rebuildReusedGeoNarrative` / `rerenderStoredAuditReport`, with its
    own test over saved data.
11. **Provider proxies, disclosed.** The instrument is provider APIs with provider-default search mode and
    no explicit location; the report says so in "What was measured" on every execution path.
12. **Sampling is descriptive, fixed and bounded.** No adaptive stopping, no client-facing inferential
    intervals, no independence claims; stability is described per combination as observed outcomes.
13. **Experiments never run inside customer audits.** Research acquisition uses an isolated harness over the
    same adapters and classifiers; it cannot create, overwrite or deliver a customer audit.
14. **Presentation never invents structured facts.** If the data model lacks a location, link, role or ID,
    the report shows the honest fallback; the schema gap goes to the backlog.
15. **Scope is frozen.** No monitoring, subscriptions, dashboards, new engines, new report sections, or
    audit-engine changes without a stated reason tied to this roadmap.

## 5. Open PRE-A2 blockers

These are closed before any paid experiment is adjudicated and before A2 starts. They are bounded
corrections, not reopenings of A1/A3/A4.

### PX-0 — Alahli audit identity and R39 disposition (operator verification, no code)

**Why.** `STATUS.md` names two paid Alahli audits with different pending actions. Repository evidence
resolves their roles (below) but cannot confirm row-level facts (payment origin, delivery timestamp) or the
owner's intent for the older audit. Ambiguous IDs must not survive into experiment planning.

**Evidence timeline (repository + `STATUS.md`):**

| When | Event | Audit | Provider calls |
|---|---|---|---|
| 2026-08-25 | First paid acquisition; report "named in 1 of 15" (18 planned, 15 successful, Perplexity 3/6); code predates A3 (`9889879`, 08-27), R39 (`8d68d60`, 08-27) and RD-00 (`22da92d`, 09-02) | `63bfd278` | yes — original acquisition |
| 2026-08-25 → 08-27 | R39 specified, implemented, deployed; its post-deploy instruction: set aliases on `63bfd278`, run one full regeneration with fresh engines (`docs/archive/TASKS_BRAND_ALIASES.md`) | — | none |
| 2026-09-02, before 12:22Z | Fresh acquisition on Trigger `20260902.x` with RD-00 capture (shipped "before client run"); 18/18 successful; `geo_scan` stage cache 153,794 bytes; a later stage failed (A3 span) | `1e9122fe` | yes — the only provider calls for this audit; `$1.048264` total, 17 AI-call records across all stages |
| 2026-09-02 12:22:04–49Z | Cached-stage recovery on `20260902.4` / `24fcccf`; report `generated_at` 12:22:40Z | `1e9122fe` | none |
| 2026-09-03 | Re-render on `20260903.2` / `6cc69da` after operator competitors set (Al Rajhi Bank, Riyad Bank, Saudi Awwal Bank) | `1e9122fe` | none |
| 2026-09-04 12:48:58Z | Stored-evidence re-render on `319851d` / `20260904.5` (trust-proof patch); 30-page PDF reviewed page by page | `1e9122fe` | none |
| as of 2026-09-04 | `awaiting_review`; not delivered; owner still to read four reviewer notes | `1e9122fe` | — |
| as of 2026-09-04 | R39 verification line still open; no regeneration or re-render recorded since 08-25 | `63bfd278` | none since 08-25 |

**Roles as far as evidence permits.**

- `63bfd278` = original/first acquisition, pre-A3/pre-R39/pre-RD-00 evidence (`mixed_legacy` citation
  semantics, no retrieval provenance). Never regenerated. Must not be delivered as-is.
- `1e9122fe` = second acquisition for the same domain, run as the client run after RD-00 capture shipped.
  Its stored report carries the operator alias `"Saudi National Bank (SNB)"` in `business_context`, names
  the brand in 10 of 18 combinations, and lists no alias as a competitor (matched aliases are Al Rajhi Bank,
  Riyad Bank, Saudi Awwal Bank only). The R39 verification purpose — named count rises, no alias appears as
  a competitor — is therefore materially met on this audit, with a narrower alias string than the R39 spec
  prescribed (`Saudi National Bank; SNB; SNB AlAhli`).
- **Canonical delivered-client evidence: `1e9122fe`** (delivery candidate; not yet delivered).
  `63bfd278` is historical.

**Operator must verify (read-only) and record in `STATUS.md`:**

1. For both rows: `payment_status`, `stripe_session` (null means admin-created "comped, marked paid" per
   `app/api/admin/audits/create/route.ts`), `created_at`, `audit_status`, `last_generated_at`,
   `last_rerendered_at`, `last_delivered_at`, `business_context.brand_aliases`, `api_cost_usd`, and the
   count and dates of `audit_ai_call_logs` rows.
2. Confirm `1e9122fe` is the customer's deliverable and label it "canonical client evidence" in `STATUS.md`.
3. Decide the disposition of `63bfd278`: **(a) superseded by `1e9122fe` — recommended**: close the R39
   verification line as satisfied on `1e9122fe`, note the alias-string difference, leave the row undelivered;
   or **(b) still to be regenerated**: then it is a customer-audit operation with its own `STATUS.md` line,
   run after PX-5, with the current report version archived first (`report_versions`), knowing that
   regenerate without reuse clears `audit_stage_executions` and replaces all evidence with new provider
   calls (`app/api/audit/route.ts`).
4. Rule, either way: **no R39 regeneration, fresh regeneration or recovery of any customer audit may be
   counted as the E1/E2/E3 control or as any experiment cell unless the experiment manifest (§7.4)
   pre-declared it with plan hash, condition, schedule and protocol identity. Post-hoc reuse is
   prohibited.**

**Exit.** `STATUS.md` rewritten: canonical audit named, R39 line closed or retargeted, no ambiguous IDs;
§2 of this roadmap confirmed or corrected. **Blocking:** not for PX-1..PX-3 code work; required before
PX-5's `STATUS.md` update and before any provider-calling step (§8 fresh control, any R39 regeneration,
experiments).

### PX-1 — Evidence retention: measurement bounded by retained evidence (RD-04 exception) — ACCEPTED ARCHITECTURE

- **Defect.** `lib/geo/index.ts:443–466`: `brand_mentioned`, `brand_position`, `competitors_mentioned` are
  computed on `r.answer`; `resolveEntities` receives and evidence stores `r.answer.slice(0, 24_000)`. Reuse
  (`lib/audit-runner.ts:205–240`) recomputes from the slice. Any mention beyond the ceiling is lost on
  recompute; the response hash cannot restore it.
- **Guarantee.** Measurement uses only evidence that can later be deterministically recovered.
- **Decision (Fable, Amendment 1): unified measurement/retention ceiling, inline retention, explicit
  completeness state.** No PX-1A investigation is required; the viable options were compared here and
  Codex implements the accepted one. Codex does not choose a persistence architecture.

| Option | Verdict | Reason |
|---|---|---|
| A. Unified ceiling: one constant bounds both measurement and inline storage; text beyond it is never measured; hitting it is an explicit censored state | **ACCEPTED** | measurement ⊆ retained by construction; no new storage surface, no migration; consistent with A3 (entity spans must lie inside `answer_text`, which already receives the slice at `lib/geo/index.ts:434`); the ceiling is >5× the longest observed answer (4,649 chars; `1e9122fe` ledger, 18 rows, zero ceiling hits, 5 provider-side `max_tokens` stops); Claude requests are capped at 1,500 tokens, OpenAI and Perplexity requests carry no output cap |
| B. Complete inline retention, no ceiling | REJECTED | uncapped OpenAI/Perplexity output could inflate `audits.report`, which the admin list already selects in full (`ADMIN_AUDIT_SELECT`), and the PDF; violates the storage/cost-limit property |
| C. Overflow to immutable referenced storage keyed by `raw_response_sha256` (Supabase Storage) | DEFERRED — Horizon B trigger: ceiling hits observed on real answers in the fresh control or experiments | needs a bucket, access from both Vercel and Trigger recompute paths, a write-failure state, cost; no observed need |
| D. Measure the full text, store the slice (status quo) | REJECTED | violates the guarantee |
| E. Persist the raw provider payload | REJECTED | large, includes `encrypted_content`, unnecessary for deterministic measurement (G2 §17) |

- **Required properties → mechanism.**
  - *Complete evidence used for measurement is retained:* `brand_mentioned`, `brand_position`,
    `competitors_mentioned` are computed from the same `answer_text` that is stored; one named constant
    (`MEASUREMENT_TEXT_LIMIT`, value stays 24,000; `ANSWER_TEXT_LIMIT` may alias it) governs both, and its
    value is recorded in `acquisition_protocol.measurement_text_limit`.
  - *Immutable/referential integrity:* the evidence row stays inside `audits.report`, written atomically
    with the stage cache; `report_versions` archives prior renders; there is no external reference to break.
  - *`raw_response_sha256` remains meaningful:* unchanged — sha256 over the stable-serialised full provider
    payload (`lib/geo/engines.ts:49–57`), never over the sliced text; the schema comment states that scope.
    It identifies the acquisition; it does not reconstruct it.
  - *No silent truncation:* when the ceiling is hit, `truncated_at = MEASUREMENT_TEXT_LIMIT`,
    `evidence_completeness: 'storage_censored'`, `absence_observation: 'censored'` when the brand is not
    observed, client caption rendered; ledger `answer_length` keeps the full provider length so the loss is
    visible in admin.
  - *Recompute can determine completeness:* new optional evidence fields
    `evidence_completeness ∈ 'complete' | 'storage_censored' | 'legacy_excerpt' | 'not_retained'` and
    `measured_text_length` (= stored `answer_text.length` at acquisition); the validator asserts
    `measured_text_length === answer_text.length` and `truncated_at` consistency.
  - *Retention failure becomes explicit non-recomputable state:* a row whose `answer_text` is absent or
    shorter than `measured_text_length` is `not_retained`; every recompute path preserves that row's stored
    derived values, keeps the mark, and emits a validator warning naming the row. Legacy excerpt-only rows
    are labelled `legacy_excerpt` with behaviour unchanged.
  - *Reasonable limits:* 24,000 chars × 18 core rows ≈ 432 KB worst case at n=1 (observed `1e9122fe`
    report: 195,250 bytes). A2 sizing is a decision-record item (§12); "lighten the admin list select" is a
    backlog task if n>1 makes the admin list slow.
  - *No secrets in artifacts:* unchanged — text, URLs and hash only; `encrypted_content` is not persisted.
- **Accepted trade-off (decision log D-14).** A mention beyond the ceiling is no longer counted in fresh
  measurement; it becomes a disclosed censored observation. A claim is bounded by evidence that can be
  shown. The G2 addendum's "measure the full text" goal is kept up to the ceiling; its beyond-retention
  side effect is removed.
- **Not allowed.** Measuring any text that is not stored; external storage in Horizon A; changing the hash
  scope; silent recompute of a `not_retained` row.
- **Regressions.** (1) Late-mention fixture — brand and competitor mentioned only after position 24,000:
  fresh, stored and recomputed values identical (`brand_mentioned=false`, `competitors_mentioned=[]`,
  `truncated_at=24000`, `evidence_completeness='storage_censored'`, `absence_observation='censored'`),
  caption rendered, validator green through sanitisation. (2) Mention just inside the ceiling: counted on
  all paths, `complete`. (3) `not_retained` row: recompute preserves stored values and warns. (4) Size
  regression: worst-case fixture report size recorded; admin list select still returns.
- **Deploy.** Trigger + Vercel (`lib/geo/*`, recompute paths). Legacy reports unchanged; their rows are
  labelled `legacy_excerpt` only on recompute.

### PX-2 — Recompute replaces stale `entity_observations` (bounded A3-reuse defect)

- **Defect.** `lib/audit-runner.ts:328` keeps old observations when the new resolution yields none.
- **Required outcome.** Recompute always writes the new observations, including an empty array. No stale
  positive observation survives because the new result is empty. `competitors_mentioned` and
  `competitor_visibility` follow the same rule (they already do; the test must assert it).
- **Regressions.** Fresh/reuse parity: (i) evidence with prior observations + operator competitors cleared
  → observations empty, A3 validator green, report shows no competitor; (ii) URL-form competitor fields →
  same; (iii) legacy excerpt-only evidence → `unconfirmed(legacy_excerpt_only)` behaviour unchanged.
- **Deploy.** Vercel and Trigger (reuse runs on both).

### PX-3 — Methodology disclosure parity across fresh / reuse / regenerate (RD-06 closure)

- **Defect.** §2 finding 3. Fresh `buildMeasurementMethodology` omits the untested-language and search-mode
  lines; only the reuse path receives `requestedMarketsLanguages`.
- **Required outcome.** One shared builder used by the fresh path (`runGeoScan` → `runFullAudit`), the reuse
  path and the re-render path, fed the same inputs (`requestedMarketsLanguages`, `acquisition_protocol`).
  The Trigger regenerate path (`app/api/audit/route.ts` → `trigger/audit-task.ts` → `runFullAudit`) threads
  the intake markets/languages through. Output for the Alahli inputs is identical on all three paths.
- **Regressions.** Methodology parity test over one fixture with `target_markets_languages` naming Arabic:
  fresh, reuse and re-render produce the same `untested_languages_disclosure` and `search_mode_disclosure`;
  a fixture with no requested languages produces none on all paths.
- **Deploy.** Trigger + Vercel.

### PX-4 — 27 entity labels approved by the owner (no code)

`evals/labels/entities.v0.json`: each row's `human` block filled by the owner with
`status ∈ approved | rejected | unknown`, labeler and date. Suggestions and provisional reviews are never
copied. Required before any entity-sensitive experimental conclusion (E1 competitor sets, E2
competitor-change metrics). Query and sample labels are not required before raw acquisition starts.

### PX-5 — Deploy and zero-call baseline check (operator, after PX-1..3)

Trigger deploy from `C:\csdeploy` at the merged SHA, Vercel at the same SHA. Then one stored-evidence
re-render of a controlled audit (not a customer deliverable): zero provider calls, deterministic
measurements identical to the previous render except where PX-2 legitimately empties observations, and
`STATUS.md` updated with both versions. This is the "baseline preflight" before paying for experiments.

**Related but not blocking experiments:** R38 (paid audit and test run share one spend cap and one alert)
is a delivery-reliability defect. It is SHOULD before experiments (the harness spends outside the cap, so
paid work must not be starved) and MUST before Horizon A is declared complete (§18).

## 6. A5a-GATE — pre-experiment checkpoint (GATE-A)

One evaluation system, two milestones (GATE and COMPLETE). GATE has two checkpoints: GATE-A before
experimental adjudication (this section) and GATE-B before A2 release (§14). All GATE-A checks are
deterministic vitest tests over fixtures or the approved-label runner; none calls a provider.

| ID | Check | Expected behaviour (rewritten where V2.1/G2 was obsolete) | Exists today? |
|---|---|---|---|
| MT-1 | Baseline outage accounting | Remove all Perplexity rows from a golden ledger/evidence: Claude and OpenAI per-engine figures unchanged; gate fails naming Perplexity; **planned population preserved** (expected cells stay 18, missing cells recorded as `provider_error`/`skipped`, never erased). Pool changes; index not printed. | partial (`geo-coverage-gate`, `admin-engine-coverage`); population-preservation assertion missing |
| MT-3 | Citation attachment semantics | Move the brand URL from `cited_urls` to `retrieved_urls`: `brand_mentioned` unchanged, `brand_cited` false, `brand_retrieved` true; an `unresolved` attachment row leaves the citation denominator and is never promoted to cited. **Rewritten:** the old expectation "citation_rate falls" is only asserted when the rate was non-zero. | partial (`rd-pre-delivery-hardening`); unresolved-never-promoted assertion missing |
| MT-5 | Censoring and storage overflow | (a) `stop_reason: max_tokens` with no mention → `absence_observation: censored`, client caption present, index does not rise. (b) Application-storage overflow: valid answer whose relevant mention lies beyond the measurement/retention ceiling → identical fresh, stored and recomputed results (`brand_mentioned=false`, `evidence_completeness='storage_censored'`, `absence_observation='censored'`, caption rendered); a mention just inside the ceiling is counted on all paths (PX-1 regressions). **Rewritten:** truncation need not make every composite monotonically decrease. | partial (`geo-capture` covers the flag only) |
| MT-6 | Zero accepted comparison universe | Filter out every accepted competitor: `share_of_voice: null`, `avg_position: null`, `position_score: null`, `ai_visibility_score: null` with `unavailable_reason`; weights unchanged; **no renormalisation** (the V2.1/G2 "renormalised index" expectation is deleted). Card hidden, caption present. | exists (`rd-pre-delivery-hardening` first test) — confirm it asserts `null` composite and no renormalised value |
| MT-15 | Bounded concurrency and retry | Fake timers, per-provider limit 2: never more than 2 in flight per provider; independent providers parallel; retry increments `attempts` without changing terminal status semantics; planned cells all reach a terminal outcome. | partial (`provider-limiter` 2 tests; `engine-retry`); combined burst + retry test missing |
| PAR-1 | Fresh/reuse parity, n=1 | Same raw answers through `runGeoScan`'s deterministic step and `recomputeReusedGeoEvidence`: identical `brand_mentioned`, `brand_cited`, `brand_position`, `competitors_mentioned`, `entity_observations`, `citation_evaluable`, coverage, gate. Includes PX-1 late-mention fixture. | partial (`a3-reuse-parity`, `a4-legacy-reuse-parity`) |
| PAR-2 | Empty resolution replaces stale observations | PX-2 regressions (i)–(iii). | missing |
| PAR-3 | Disclosure parity | PX-3 regression. | missing |
| RES-1 | Same-pair repetition invariant at resolver level | Three repeated answers of one (query_id, engine) pair naming a candidate: `distinct_queries = 1`, `distinct_engines = 1`, state `unconfirmed` unless operator-provided or `domain_corroborated`. Operator and domain-corroboration paths are excluded from the negative assertion. | missing |
| AD-1 | Perplexity without `[n]` markers | **Rewritten:** `citation_attachment: unresolved`, `cited_urls: null`, row outside the citation denominator, `retrieved_urls` retained. The G2 expectation `cited = retrieved` is deleted. | partial (`rd-pre-delivery-hardening`); assert explicitly |
| LBL-1 | Approved-label entity precision runner | Minimal runner (`evals/run.ts` or a vitest file) that loads only `human.status === 'approved'` rows, runs `resolveEntities` over the golden evidence, and prints numerator, denominator, unknowns and fixture limitations. Threshold `entity_precision_min 0.90` on the 27 labels blocks experiment adjudication; it is **not** presented as broad production precision. | missing |

**Exit criteria for GATE-A:** all rows above green on `main`; PX-1..PX-3 merged and deployed (PX-5 done);
PX-4 labels approved; LBL-1 printed with numerator/denominator; `STATUS.md` records the gate as passed
with the commit SHA. Historical excerpt-only golden records cannot validate current complete-answer capture;
the runner must say so in its output.

## 7. Experiment harness (disposable infrastructure, not A2)

### 7.1 Why a harness

Experiments require a recorder and executor; production A2 requires experiment results. A production
admin override (V2.1 per-audit `samples_per_combination`, G2 RD-10) would import customer task recovery,
persistence and rollout semantics into a research decision before those semantics are chosen. The harness
breaks the cycle without defining a provisional customer contract.

### 7.2 Must / must not

The harness **must**:

- Load a validated, frozen query plan (`QueryProvenance[]` with `query_plan_hash`) and an explicit manifest
  (§7.4). It never generates queries.
- Use the same `queryEngine` adapters, request construction, `classifyEngineResponse`, `textMentions`,
  `citationsInclude`, `resolveEntities`, `createProviderLimiter` as production (imported from `lib/geo/*`),
  so results transfer to A2 unchanged.
- Record every planned cell before execution, then every attempt with: `manifest_id`, `experiment`,
  `plan_id`, `query_plan_hash`, `query_id`, `engine`, `condition` (location `provider_default` or explicit
  `{country, city}` plus provider support status), `schedule_id`, logical sample id (`wave`/`repeat`),
  `attempt`, requested configuration (an `acquisition_protocol`-shaped snapshot including `user_location`
  and requested schedule), actual configuration (observed `model`, tool version, HTTP status),
  `started_at`/`finished_at`, terminal `status` and reason, `tool_events`, the **complete** answer text,
  `retrieved_urls`, `cited_urls`, `citation_attachment`, `engine_issued_queries`, `stop_reason`,
  `raw_response_sha256`, usage/cost, latency, error text.
- Preserve failed, skipped and unresolved cells as first-class records; never drop a planned cell.
- Compute deterministic measurements per cell with the production functions against a frozen operator
  competitor set and record the resolution version; entity resolution runs once per block with the
  candidates and outputs stored.
- Enforce `max_calls` and `max_spend_usd` from the manifest and stop cleanly when either is reached.
- Resume: cells with a terminal outcome are skipped on rerun; incomplete cells get a new attempt id.
- Write isolated artifacts under `evals/experiments/<manifest_id>/` (raw cells git-ignored, summaries
  committed) and a one-line spend record the operator copies into `STATUS.md`.

The harness **must not**:

- Create, modify, recover or deliver any audit row; write to production tables; enqueue Trigger tasks.
- Define production sampling semantics, add fields to `GeoResultSchema`, or duplicate the metric engine.
- Be reachable from the app or bundled into the Vercel or Trigger builds (lives under `scripts/` or
  `evals/`, excluded from `next build` and the Trigger bundle).
- Exceed production per-provider concurrency defaults.

### 7.3 Isolation from paid work (RD-05 scope)

The limiter is per-process. Nothing in code prevents a harness run and a paid audit from hitting a
provider at the same time. Operational rule: experiments run in declared windows when `/admin` shows no
queued or generating paid audit; if a paid audit arrives, the operator pauses the harness (resume is
supported). Harness spend is outside `enforceDailyAiSpendCap`; the operator keeps the daily total
(audits + harness) under the declared ceiling and records both. R38 closure (paid audits counted, not
refused) removes the starvation risk and is preferred before the first pilot block.

### 7.4 Manifest and budget (required before any provider call)

A manifest lists plans, queries, engines, conditions, repetitions, requested schedule, total planned calls,
per-provider cost estimate from measured `audit_ai_call_logs` figures, maximum allowed spend, expected
elapsed time, and which cells are legitimately shared across experiments. Cells are shared only when plan,
provider, location condition, timing/schedule, sampling rules and protocol identity are all identical.

Corrected arithmetic for the G2 §18 designs (six core queries per plan, three engines):

| Experiment | G2 stated | Full design | Calls |
|---|---|---|---|
| E1 location | 108 | 3 plans × 6 queries × 3 engines × 2 conditions × n=2 | **216** |
| E2 repeats | 270 | 3 plans × 18 pairs × n=5 (burst) | **270**; 162 marginal if E1's default-location arm (n=2) is reused under an identical schedule |
| E3 schedule | 108 | 1 plan × 18 pairs × 3 repeats × 2 schedules × 3 days (G2's own design) | **324** |
| Upper bound before sharing | — | — | **810** |

Planning cost: measured production cost is ~$0.06 per call (`$1.06`/18 calls on `dad3447c`, `$1.05`/17 on
Alahli) → ~$49 upper bound; this is a planning figure, not a budget. Provider mix differs (Claude web search
is the expensive path), so the manifest must use per-provider measured cost. G2's "<$30 / <$60" estimates
are superseded until the manifest is reconciled. Elapsed time: burst blocks fit in a day; E3 spans at
least the number of days in its schedule design.

## 8. Fresh control / experiment integration

One fresh, no-reuse acquisition on the current production revision is the **integration canary** for the
acquisition-to-report path after PX-1..PX-3. It is integrated into the experiment programme as the first
reference block where the plan permits; it is not a ceremonial standalone audit followed by identical
experimental calls.

- **Audit to use.** A controlled, non-customer audit (the `getclearsignal.io` plan, or one golden plan that
  E1/E2/E3 will reuse). Never a customer's deliverable; never `1e9122fe`. Any R39 or fresh regeneration
  of `63bfd278` (if PX-0 keeps it) is a customer-audit operation; it is **not** this control and not an
  experiment cell unless the manifest pre-declared it (PX-0 rule 4).
- **Preconditions.** PX-5 done; `STATUS.md` shows Vercel and Trigger at the same SHA; frozen validated plan
  saved with `query_plan_hash`; `reuseGeoEvidence: false` confirmed in the payload.
- **Must demonstrate.** Exact production revision and configuration (health endpoint, Trigger version,
  runtime); frozen plan executed unchanged; zero GEO reuse; planned-vs-executed cell reconciliation
  (expected 18 core + supplemental, each with a terminal outcome); complete acquisition provenance
  (`acquisition_protocol`, `acquisition_operational`, per-row timestamps, `raw_response_sha256`); complete
  retained measurement evidence (no measured text lost — compare fresh signal values with a recompute);
  truthful language and search-mode disclosures on the fresh path; validator success; recorded cost, elapsed
  time and failure reasons; a subsequent stored-evidence recomputation producing identical deterministic
  measurements with zero new provider calls.
- **Report separately.** Integrity outcome (did the path behave) and coverage outcome (did providers answer).
  A provider outage can pass integrity and still leave coverage unsuitable as an experimental reference.
- **What it is not.** Proof that n=1 is sufficient, proof of provider reliability, proof of sampling
  independence, or a source for a location arm or spaced repeat it did not plan.
- **Sharing.** Its cells count as E1 default-location, burst-schedule reference cells only if the manifest
  pre-declared them so and the plan/protocol match.

## 9. E1 — explicit location

**Question.** Does supported explicit `user_location` (country and city derived from the plan's market)
provide **useful, market-relevant** information beyond ordinary repeat variability, at acceptable
reliability and cost?

**Design.** Plans with a real local market (Rozie/Malta, Vertex/Marbella, the Riga clinic plan; Snoika and
ClearSignal are global and excluded). Matched arms `provider_default` vs `explicit_location`, run in the
same time block with counterbalanced order, n=2 per arm as the within-arm repeat-variability reference.
Per engine, the manifest records `location_support: supported | unsupported | unknown` for the current
adapter (`web_search_preview` support is `UNCONFIRMED`); unsupported engines are not silently run as
default and counted as "no change".

**Metrics.** Per pair: `brand_mentioned` class change between arms vs between repeats within an arm;
accepted-competitor set difference (after PX-4 labels) vs within-arm difference; coverage per arm; cost and
latency per arm; a human market-relevance review of the changed competitors and answers (relevant to the
market / irrelevant / cannot tell).

**Decision rules.**
- ADOPT (per provider) only if: between-arm change materially exceeds within-arm repeat variability **and**
  the human review rates the explicit-location answers as more market-relevant **and** coverage and cost are
  not materially worse. Adoption means a new `acquisition_protocol` version (not a silent parameter change)
  and inclusion in the §12 decision record.
- REJECT if changes are within repeat variability or relevance does not improve.
- INCONCLUSIVE if coverage is insufficient in either arm, support is unknown, or the reviewers disagree.
  Production stays `provider_default`. Adoption is never forced.
- "Answers changed" or "competitor Jaccard changed" alone is not success.

**Timing dependency.** If E3 finds that schedule materially changes outcomes, an E1 conclusion observed only
in one burst is provisional and E1 is finalised under the accepted schedule.

## 10. E3 — acquisition schedule

**Question.** Which feasible observation schedule gives useful repeatability information at acceptable
operational cost? This is a scheduling decision, not an independence test; "no detected difference" is not
proof that repeats are independent.

**Candidate schedules (values fixed in the manifest, not here).** S0 immediate burst (all repeats
back-to-back inside one stage); S1 short spacing inside one Trigger stage window (minutes); S2 long spacing
across separate tasks (hours to a day). G2's six-hour figure is one S2 candidate, not a requirement.

**Design.** One plan with stable coverage (`getclearsignal.io` or the plan with the best fresh-control
coverage), 18 pairs, ≥3 repeats per schedule, each schedule replicated across ≥2 time blocks (days) so a
day effect is not read as a schedule effect. Same protocol identity throughout.

**Metrics.** Within-schedule disagreement rate per pair (class changes among repeats), coverage per
schedule, elapsed wall-clock per schedule, operational cost (task count, recovery complexity), provider
error profile per schedule.

**Decision rules.**
- If a spaced schedule shows materially more disagreement than burst at acceptable cost, A2 models repeats
  as **resumable acquisition waves/tasks** with an explicit observation window; it never pretends hour-spaced
  repeats occur inside a five-minute stage. Actual per-sample timestamps and the window are persisted.
- If burst and spaced are indistinguishable within the tested blocks, burst is acceptable **for this plan
  and period**; the decision record says so and the disclosure remains descriptive.
- INCONCLUSIVE if coverage differs materially between schedules or blocks disagree; add a second plan only
  if the result is ambiguous or plausibly business-specific.
- No independence claim is written anywhere.

## 11. E2 — repeat count

**Question.** What is the smallest tested repeat count that provides enough decision-relevant information
under the selected acquisition condition and schedule?

**Design.** n ∈ {1, 2, 3, 5} evaluated on the same cells: acquire n=5 per pair on ≥3 plans under the
schedule selected by E3 and the location condition selected by E1; compute every quantity at the first 1,
2, 3 and all 5 repeats. n=5 is the reference sample, not truth. Reuse earlier cells only under identical
plan, condition, schedule, sampling rules and protocol.

**Metrics (all per engine and per plan).** Observed brand outcome per pair (0/n → k/n); observed rates and
their change between candidate n; disagreement state (all positive / mixed / none observed / single sample);
accepted-competitor set and action-relevant changes (after labels); missingness and coverage per n; cost and
latency per n; reviewer decision impact (would the human reviewer's delivery decision or first action
change between n and n=5 — recorded by the owner per plan).

**Decision rules.**
- Predeclare tolerances in the manifest (for example: the share of pairs whose disagreement state or the
  per-engine rate differs from n=5 beyond a stated margin; the share of plans where the reviewer's decision
  changes). Choose the **smallest tested n** meeting all tolerances with acceptable cost and latency.
- Evaluate raw brand outcomes separately from competitor-driven changes; a competitor-acceptance change is
  an A3 observation, not a sampling result.
- INCONCLUSIVE if tolerances are not met by any n ≤ 5, if coverage is inadequate, or if plans disagree
  materially. Then production stays n=1 with descriptive disclosure until a further, separately budgeted
  block; n=3 is **not** the automatic fallback when n=2 fails.

## 12. A2 decision record (frozen before implementation)

File: `A2_DECISION_RECORD_<date>.md` at the repo root, written by Fable from the experiment artifacts,
signed off by the owner in `STATUS.md`. Implementation may not guess any of these later.

| Field | Content to freeze |
|---|---|
| Production default n | from E2; or "n=1 (inconclusive)" |
| Allowed configurable range | bounded integer range if retained (e.g. 1..5), who may set it, config source order |
| Acquisition schedule | S0/S1/S2 from E3; wave/task structure; observation window semantics |
| Location behaviour per provider | `provider_default` or explicit, per engine, with support status; protocol version bump if any |
| Query plan identity | frozen plan + `query_plan_hash`; regenerate-without-reuse creates a new plan and new identity |
| Sample logical identity | `(query_id, engine, sample_index)` plus schedule/wave id; stable across retries and recovery |
| Retry identity | attempts belong to one logical sample; a retry never creates a second completed sample; recovery never replaces a completed unfavourable answer |
| Denominator rules | per metric: mention over successful core samples; citation over `citation_attachment = resolved` samples; SOV/position over answers with ≥1 accepted competitor (else null) |
| Weighting | per-engine primary (successful-sample mean per engine); pooled global = successful observations, availability-weighted, labelled; no equal-engine reweighting |
| Missing / unknown states | acquisition failure, skipped (budget/time), censored, unresolved citation, unsupported capture — each kept distinct in ledger and bounds |
| Coverage requirements | query coverage (queries with ≥1 successful sample per engine) **and** repeat coverage (successful samples / planned samples per engine); gate thresholds; core-only |
| Budget expectations | measured cost per call per provider; expected per-audit cost at the default n; stage/time budget; `skipped(time_budget)` policy |
| Observation window | per-sample `started_at`/`finished_at`; `observed_at`/`observed_until` per audit; disclosure wording |
| `acquisition_protocol` additions | `samples_per_combination` (bounded int), `schedule`, `user_location` (nullable object), `location_support`, `measurement_text_limit` (from PX-1), protocol version string |
| `computation_version` additions | aggregation rule version, bounds rule version, stability rule version |
| Inconclusive handling | which values apply when a given experiment was inconclusive |
| Supplemental policy | supplemental n and its separate budget; never consumes core budget |

## 13. A2 implementation contract

### 13.1 MUST

- Configurable, bounded n with the production default from §12; requested and executed counts persisted;
  no adaptive stopping on observed brand success.
- Query × engine × run matrix with one stable logical identity per planned sample, including failed and
  skipped cells; individual observations preserved (`k/n` is a summary, never the stored matrix).
- Attempts/retries recorded inside a logical sample; recovery cannot duplicate a completed sample or
  replace a completed answer.
- Per-engine primary metrics with explicit numerator, denominator, query coverage and repeat coverage,
  and a declared weighting (successful-sample mean).
- Combination stability as observed outcomes: `all_observed_positive`, `mixed`, `none_observed`,
  `single_evaluable_sample`, `no_evaluable_sample`; incomplete coverage shown separately.
- Disagreement among repeats kept separate from disagreement among engines; acquisition failure, citation
  uncertainty and observed disagreement never collapsed.
- Binary missingness worst-case bounds for mention and citation over a fixed planned core population
  (§13.4).
- Acquisition identity extended with requested n, location, schedule; actual sample timestamps persisted;
  `samples_per_combination` literal replaced by a bounded integer with legacy `1` accepted.
- Computation identity versioned for aggregation, bounds and stability rules.
- Supplemental isolation: separate counts, separate outputs, separate budget.
- Deterministic representative-evidence selection per combination (rule fixed and documented; never the
  most favourable answer); disagreement visible; every sample traceable in the web report.
- Client-facing descriptive stability disclosure: tested frame, actual k/n per combination, missing
  observations, observation window; no confidence, stable-absence or independence claim.
- n=1 compatibility: legacy and n=1 reports validate and render unchanged apart from new optional fields.
- Reuse-path parity for every new field through sanitisation and final validation.

### 13.2 SHOULD

- Optional `anchor_audit_id` lineage pointer where a real anchor exists; the plan snapshot/hash is retained
  independently. No retest workflow is required to ship A2.
- Comparability metadata: recorded known differences and unknown metadata between two acquisitions; a
  matching visible model name is not proof of an unchanged backend. Full pairwise comparison waits.
- Pooled global compatibility result retained, explicitly availability-weighted with numerator and
  denominator; RD-01 composite guards retained.
- Compact display of representative evidence (PDF does not grow ×n; web shows all samples on demand).

### 13.3 LATER (not in A2)

SOV, position and composite worst-case bounds (binary arithmetic does not bound ratios with unknown
competitor counts or rankings — preserve unavailability instead); full retest delivery workflow; delta
reports.

### 13.4 Binary worst-case bounds

For a fixed planned core population: N = planned observations, k = known positives, u = metric-specific
unknowns; lower = k/N, upper = (k+u)/N, valid only when known positives, known negatives and unknowns
exhaust N. These are **not** confidence intervals and are shown alongside, never instead of, the current
observed evaluable rate. Unknowns differ per metric: an unresolved or unsupported citation attachment is
unknown for citation while the same answer is usable for mention; a censored answer with no observed
mention is unknown for the complete-answer mention frame; failed, skipped and empty cells are unknown for
both. Example presentation: "Observed evaluable citation rate: 0 of 12. Worst-case bound over all 18
planned observations: 0–33.3% (6 unresolved)." The observed rate is unchanged by introducing bounds; any
change to a denominator or weighting is an explicit computation decision recorded in §12.

### 13.5 REJECT for A2

Wilson intervals in client fields; the client-facing 0/n power table; central leave-one-query-out
sensitivity; a synthetic confidence score; adaptive sampling based on observed success. An internal
`diagnostics.wilson_fixed_frame` remains permissible only as an unexposed diagnostic with its assumptions
stated; it is not part of the contract.

## 14. A5a-GATE — pre-release checkpoint (GATE-B)

Run after A2 exists, before any production rollout. Obsolete expectations are rewritten first; a green
suite that enforces rejected semantics is a failure.

| ID | Check | Expected |
|---|---|---|
| MT-12 | n>1 fresh/reuse parity | fresh n=3 vs `recomputeReusedGeoEvidence` of the same data: identical matrix, stability classes, per-engine metrics, bounds, through sanitisation and `finalizeReportValidation` |
| MT-8 | mixed repeated outcomes | synthetic n=3 fixture with 0/3, 1/3, 2/3, 3/3 and one 1/1: correct classes, coverage and summaries; no intervals in client fields |
| MT-9 | engine disagreement | brand named by one engine only: per-engine visible; pool computed with the accepted availability weighting and labelled; per-engine table primary |
| MT-14 | sample identity | repeated samples never masquerade as distinct queries or engines in coverage, provenance, resolver or validator; `combination_id` and `sample_index` unique per logical sample |
| MT-2 | bounds | start from a complete fixed-population fixture, mask observations progressively: bounds contain the complete-population value and expand outward monotonically; unknowns are metric-specific |
| MT-4 | unrelated citation isolation | injecting `https://unrelated.example/x` into `cited_urls` changes `cited_domains_ranked` only; brand metrics unchanged |
| MT-10 / MT-13 | core/supplemental and query identity | supplemental never enters core metrics, gate or bounds; a changed query text under the same `query_id` is a validator error |
| PROTO-1 | protocol/model metadata | changed `model`, tool version, n, location or schedule is recorded in the right identity (acquisition vs computation); comparability classification tests if that classification ships |
| OPS-1 | duplicate delivery, retry, recovery, timeout, partial wave | recovery after a mid-wave failure completes the remaining logical samples without duplicating completed ones; `skipped(time_budget)` cells preserved; no double delivery |
| COMPAT-1 | n=1 compatibility | golden and legacy reports validate and render unchanged; `samples_per_combination: 1` accepted |
| BUILD | `npx tsc --noEmit`, `npm run build`, full vitest | green |

Exit: all green on the release candidate SHA; `STATUS.md` records GATE-B passed.

## 15. Production A2 verification

- Deploy the release candidate (Vercel + Trigger from `C:\csdeploy`) with the production default still at
  n=1 unless §12 says otherwise; the frozen configuration is applied to controlled audits first.
- Run ≥2 controlled, non-customer audits on production infrastructure under the frozen n, schedule and
  location behaviour. Verify: ledger reconciliation (planned = terminal outcomes), logical-sample
  uniqueness after a deliberate recovery/requeue during a wave, actual timestamps and observation window,
  cost per audit and per provider, stage/task elapsed time, disclosure text, validator zero errors, PDF
  size and page count, admin responsiveness, zero-call stored-evidence recomputation parity.
- Record everything in `STATUS.md` with versions. Only then set the production default from §12.
- One verified audit is an integration check; provider reliability claims still require the ledger history
  across audits.

## 16. A5a-COMPLETE

After production A2 verification: market and language diversity in fixtures (Baltic, Malta, Spain,
Saudi-English), alias and adversarial cases (from `DEFECTS_CLOSED` history and the G2 §13 list not already
in GATE), `npm run eval` as a single command with `evals/thresholds.json` and CI integration (no provider
calls in CI), human-reviewed query and sample labels (30 and 61 rows), evidence-to-action relevance
warnings (`evidence_link` data from A5b, warning-only), threshold calibration with documented reasons,
coverage reporting (what the fixtures do and do not cover), error analysis, and documented label
limitations (small set, single labeler, historical excerpt-only records). A5a is complete when the system
demonstrably detects the known failure classes (denominators, citation semantics, censoring, stale reuse,
sample identity) and supports a release decision — not when a command prints green.

## 17. A5b — narrow structured review

Targets: `entity`, `sample`, `query`, `evidence_link`, each with a named evaluation consumer
(`resolveEntities` precision/recall; `classifyEngineResponse`; `validateGeneratedQuery`;
`filterGeoActionEvidenceIds` warning-only). Stored fields: stable target id, measurement/computation
reference (`computation_version`, `acquisition_protocol.version`), decision, controlled reason, reviewer,
timestamp, append-only history with explicit supersession of a prior decision. Export to evaluation data
keeps human approval separate from generated suggestions. Required demonstration: one reviewed error becomes
a regression/evaluation case end to end. Default behaviour is data collection; applying a correction to a
report is an explicit recomputation with a new derived revision (`report_versions`) and preserved raw
acquisition. Existing delivery approval stays separate. Not built: report CMS, generic annotation platform,
free-form report editor, automatic retrospective mutation of raw acquisition or of historical metrics.

## 18. Horizon A completion gate

Horizon A is complete when all of the following hold, verified on production and recorded in `STATUS.md`:

- Acquisition reliable under the selected sampling contract (≥2 controlled audits + the next paying audits
  pass the coverage gate or fail it for provider reasons only).
- Recovery does not duplicate logical samples (OPS-1 on production, not only in tests).
- Measurement evidence retained and recomputable with zero provider calls (PX-1 in production).
- Truthful methodology disclosures on every execution path (PX-3).
- Deterministic metrics with explicit denominators, weighting and unknown states (§13).
- Entity precision guardrails: LBL-1 on approved labels, RES-1, PX-2.
- Eval gate capable of detecting the known failure classes (GATE-A + GATE-B suites; A5a-COMPLETE scope may
  continue afterwards).
- Human review decisions produce structured evaluation data (A5b minimum demonstrated once).
- Next-client delivery remains human-approved; R38 closed so a paid audit is never refused by the owner's
  own test spend.
- Acquisition cost, total audit latency and reviewer effort recorded for the next five paying audits (§21).
- Implementation handoff observed: for those audits, the implementer can identify each action's task and
  acceptance criterion without a clarification round, or the failure is recorded.

Long-term outcome causality is not a completion criterion.

## 19. Parallel Report Delivery / UX track

Direction: Diagnosis → Decision → Implementation → Evidence (IA review §3). It runs alongside the
measurement sequence and may ship before A2. Its inputs are `TASKS_REPORT_DESIGN_LAB_R2.md` (visual
foundation), the IA review, and the prototype task it references (not present in the repo root — §25 U-2).

It may change: report order, layout, implementation tickets (one per `top_fixes[]` entry plus brief-only
tickets), role presentation (Owns / Builds / Writes, labelled as inferred), acceptance-criteria presentation,
evidence navigation, page references derived from the rendered slot map.

It may not change: metric meaning, any denominator, evidence semantics, claim level, citation semantics,
acquisition identity, query semantics, or the "What was measured" content.

Data-model rule: where the model lacks a structured action location, fix-id link, asset link, clarity
dimension IDs or a consistent role taxonomy (IA review §2.2), the presentation shows the honest fallback
("Implementation location: confirm with website owner", "Ready-made asset: none provided", "No single
action is linked to this finding") and the schema improvement (`target_location`, `implementation_briefs[].fix_id`,
`fix.assets`, `clarity.<dimension>.related_fix_ids`) goes to the backlog for a later architecture pass.
Acceptance for anything this track ships: a measurement-preservation check — the rendered numbers,
captions, counts and disclosures equal the stored `report.geo` values on a golden fixture, and the
production validator stays green.

## 20. Horizon B / C boundary

| Item | Horizon | Boundary decision | Evidence trigger |
|---|---|---|---|
| Retest / delta delivery | B | Full anchor execution and pairwise reporting are outside A2; lineage (`anchor_audit_id`, plan snapshot/hash, comparability metadata) preserved now | a customer with documented implementation requesting a retest, plus comparable acquisition or explicit qualification; no causal attribution from a before/after pair |
| Recommendation classification (B1) | B | the historical n≥3 prerequisite is removed — repetition count does not validate a role classifier | demonstrated agency demand; independently reviewed role labels; measured held-out performance appropriate to the claims |
| Query paraphrase families | B | separate from adaptive allocation; not bundled | E4 shows decision-relevant information beyond repeat variation across >1 plan |
| Arabic / second-language cores | B (validation pilot) | not a Horizon A blocker; the Alahli audit is **not bilingual** — English was tested, Arabic was not; no auto-combination of languages into one score | two paying prospects requesting Arabic, or an agency/customer commitment of comparable strength; plus a qualified language reviewer, validated Arabic query plan, entity/alias evaluation, provider-response review, separate language measurement semantics |
| Progressive multi-page crawl (R22) | B | outside A; prioritised on documented implementation failures, not "first clients" alone | repeated paid-audit findings unresolvable from the audited page; a bounded crawl proving useful incremental findings within budget |
| Evidence-triggered provider/tool migrations (`web_search_preview` → `web_search`, model updates) | B, may precede A2 if mandatory | "after A2" replaced by an evidence trigger; each adopted change gets its own distinct protocol identity; `mp-2` is not reserved simultaneously for location and migration | mandatory deprecation/operational need, or measured benefit from matched runs |
| Monitoring / drift product | C | an internal, time-bounded research cohort is distinct from a customer product; no automatic promotion | real retest demand and evidence that between-period differences are distinguishable from within-window variability at affordable cost |
| Longitudinal outcomes / causality | C | accumulated retests never imply causal effectiveness; observational associations only | verified implementation dates, repeated measurements, acquisition comparability, a defensible attribution design |
| Retrieval/source moat claims | C | "≥100 audits" is not a sufficient trigger | corpus-quality and utility gate: coverage by market/category/provider, lawful reuse, demonstrable held-out diagnostic or decision improvement |
| Adaptive allocation | C | separate idea from paraphrase families | its own later justification |

## 21. Commercial evidence to collect (next five paying audits)

Recorded per audit in `STATUS.md` (or a small `validation/delivery-log.csv`), not a dashboard:

- acquisition cost (`api_cost_usd`, per provider) and planned/executed cells;
- total audit latency (payment → `awaiting_review` → delivered) and stage durations;
- reviewer time (minutes) and the number of reviewer notes that needed a re-render;
- clarification requests from the client before and after delivery;
- implementation handoff failures (the implementer could not identify the task, location or acceptance
  criterion; an action was disputed as unsupported);
- agreed market/language scope at intake and whether the disclosure matched it;
- which of the four Alahli-class reviewer notes recur (own-domain citation caption, undercounted named
  competitor, `Language: en` label, Ship-first count mismatch).

These observations govern later investment (Report IA priorities, A5b targets, Horizon B triggers).

## 22. Exact execution order from today

```
BASELINE (Phase 0, A1, A4, A3, RD-00..06 as implemented)
  → PRE-EXPERIMENT INTEGRITY FIXES: PX-0 audit-identity verification (owner, in parallel, before any provider call),
    PX-1, PX-2, PX-3 (Codex), PX-4 labels (owner), PX-5 deploy + zero-call check
  → GATE-A (A5a pre-experiment suites + LBL-1 runner)
  → EXPERIMENT HARNESS (Codex, non-production) + MANIFEST (Fable drafts, owner approves budget)
  → FRESH CONTROL as integrated reference block (operator)
  → E1 screening block + E3 schedule blocks (can overlap; counterbalanced; never confounded)
  → adjudicate E3 schedule → finalise E1 under it
  → E2 under the selected condition and schedule
  → A2 DECISION RECORD frozen (Fable writes, owner signs)
  → A2 IMPLEMENTATION (Codex, several sessions)
  → GATE-B (A5a pre-release suites)
  → PRODUCTION A2 VERIFICATION (controlled audits) → default set
  → A5a-COMPLETE
  → A5b narrow
  → HORIZON A COMPLETE (§18 criteria)
PARALLEL throughout: Report Delivery / UX track (§19); owner items (live Stripe, legal); sales test.
```

Cells may be shared between E1/E2/E3 only under §7.4's identity rule; otherwise the order is not reshuffled.

## 23. Explicit DO NOT START YET list

- A2 implementation, any `samples_per_combination > 1` in production, any admin/per-audit n override.
- `user_location` in any production adapter (E1 decides; adoption is a protocol version).
- Retest/delta reports, anchor execution, comparability UI.
- Arabic or any second full-language core; translating English queries; extending `SUPPORTED_LANGUAGES`
  for one client.
- Recommendation/sentiment classification, paraphrase families, adaptive allocation.
- Multi-page crawl, provider/tool migration (unless a provider deprecation forces it), new engines.
- Monitoring, drift cohort as a product, dashboards, subscriptions, auth, white-label.
- Report CMS / annotation platform / free-form report editor.
- Wilson intervals, power tables, LOO sensitivity, confidence scores, index renormalisation.
- Any experiment call before the manifest, GATE-A and PX-5 are done.
- Counting the R39 regeneration of `63bfd278`, or any customer-audit regeneration or recovery, as an
  experiment cell or control unless the manifest pre-declared it (PX-0 rule 4).

## 24. Superseded V2.1 / G2 requirements

SUPERSEDED / REJECTED for Horizon A (source in brackets):

- Fixed production n=3 (V2.1 A2) and fixed production n=2 (G2 §12) — E2 decides.
- Choosing n before E2; choosing `user_location` before E1 (G2 RD-10 sequencing) — experiments first.
- Wilson client confidence intervals (V2.1 A2, EVALS §1) — rejected client-facing.
- Client-facing 0/n power table (G2 §6.7, §12.3; kept "unchanged" by the addendum) — rejected (Astra).
- Central leave-one-query-out `query_sensitivity` with a 10 pp flag (V2.1 A2) — rejected.
- Adaptive n based on observed success — rejected.
- Composite renormalisation over available components (G2 H1/RD-01 body) — rejected by the addendum;
  code implements `null` + reason.
- `cited = retrieved` fallback for unresolved Perplexity markers (G2 H2 body, AD-1) — rejected by the
  addendum; `citation_attachment: unresolved`.
- Equal-engine global reweighting `M = mean_e M_e` (G2 §3.3, §12) — rejected by the addendum; pooled
  availability-weighted result with a label; per-engine primary.
- Retrieved-only URLs entering the citation denominator — rejected (RD-02 as implemented).
- Assuming repeated samples are independent (V2.1 "Graphite variance ratio 1.02"; any interval arithmetic
  on pooled repeats) — rejected.
- Treating a matching model name as proof of backend comparability — rejected.
- Measuring on the stored slice for parity (G2 H4 body) — rejected by the addendum; PX-1 retains the measured
  text instead.
- Running E1–E3 through admin regenerate with a per-audit A2 override (G2 §18, RD-10) — replaced by the
  harness (§7).
- G2 §18 call counts (108/270/108) and "<$30 / <$60" — replaced by §7.4 arithmetic and the manifest.
- E3 hard-coded six-hour spacing — replaced by candidate schedules in the manifest.
- V2.1's "Horizon A in ~2 weeks with A2 code shipped at n=1 default" — superseded by this sequence.
- V2.1 A2 go/no-go criteria (cost ≤$3, stage ≤300 s, etc.) — replaced by the §12 decision record; the
  measurements they asked for become §15 verification records.
- EVALS §12 "cross-run consistency at n=3 monthly" — replaced by the E2/E3 programme and, later, a Horizon
  C cohort decision.
- Obsolete test expectations: MT-6 renormalisation, AD-1 retrieved-to-cited fallback, MT-3 "citation rate
  must fall" when already zero, MT-5 "every composite decreases under truncation", any test that turns an
  unresolved citation into a confirmed one — all rewritten in §6/§14.

## 25. Decision log / source authority

Conflicts resolved (rule → outcome):

| # | Conflict | Resolution |
|---|---|---|
| D-1 | `STATUS.md` labels A3 "READY FOR A2"; brief and Astra require pre-experiment work first | STATUS is authority on verification state, not on sequencing; the roadmap (this file) sequences. A3 stays DONE; A2 does not start. |
| D-2 | G2 body vs G2 addendum (renormalisation, cited=retrieved, equal weights, n=2 target, truncated-text measurement) | Addendum wins (authority 3); code at `319851d` already reflects it. |
| D-3 | G2/addendum "E1–E3 via admin regenerate with A2 payload override" vs Astra harness | Astra amendment accepted (authority 4 overrides 3 on this point): harness, no production override. |
| D-4 | Addendum keeps the 0/n power table; Astra rejects it client-facing | Astra amendment accepted; no client-facing power table; internal diagnostics optional and unexposed. |
| D-5 | G2 E3 six-hour spacing as a design constant | Candidate only; manifest fixes values; A2 models resumable waves if spacing is adopted. |
| D-6 | G2 §18 call counts vs full factorial designs | Counts corrected in §7.4; manifest is the budget authority. |
| D-7 | V2.1 A2 (Wilson, LOO, n=3, 2-week scope) vs G2/Astra | V2.1 superseded (authority 5). |
| D-8 | EVALS 2026-08-21 §1 (Wilson intervals, stability requires n≥3, sample pool) | Wilson superseded; stability classes retained as descriptive outcomes at any n; pool retained as labelled compatibility field. |
| D-9 | V2.1 A5a threshold `entity_precision_min 0.90` on approved labels vs Astra "27 labels are groundwork, not proof" | Threshold retained as a GATE-A blocker on the 27 labels; wording must state numerator, denominator and limitation; never presented as broad precision. |
| D-10 | IA review's data-model gaps vs the frozen-scope rule | Presentation fallbacks now; schema fields to backlog; no invented values (§19). |
| D-11 | RD-05 described by G2 as reducing MNAR across audits vs code (per-scan) | Code wins (authority 2): per-scan only; experiments isolated operationally (§7.3). |
| D-12 | Astra's A5a "two milestones" vs V2.1 single `npm run eval` initiative | One system, GATE-A / GATE-B / COMPLETE (§6, §14, §16). |
| D-13 | Packet filename `CLEARSIGNAL_FRONTIER_REVIEW_G2_20260902.md` vs repo `…_2026-09-02.md` | Same content (packet copies differ from local only by CRLF line endings; sizes match exactly after accounting for them). Repo filename is canonical. |
| D-14 | G2 addendum #9 ("measure on the full text and store the full text; the 24k ceiling is protective") vs Amendment 1 ("measurement uses only evidence that can later be deterministically recovered") | Amendment wins (operator direction above G2). Unified ceiling (PX-1): the full-text goal is kept up to the ceiling; measuring beyond retained text is removed; a ceiling hit is a disclosed censored state. Referenced overflow storage is deferred with an evidence trigger. |
| D-15 | `STATUS.md` "R39 PRODUCTION VERIFICATION PENDING" on `63bfd278` vs `1e9122fe` evidence (operator alias set, named 10 of 18, no alias as competitor) | Repository evidence says the verification purpose is met on `1e9122fe`; `STATUS.md` stays authority until the operator records the disposition → PX-0. |

Open items after Amendment 1 (none blocks PX-1):

- **U-1 — RESOLVED as far as repository evidence permits; residual confirmation = PX-0.** Roles,
  acquisition/regenerate/re-render/delivery events and provider-call vs zero-call events are tabulated in
  §5 PX-0. Canonical client evidence is `1e9122fe`; `63bfd278` is historical. The operator confirms the
  row-level facts and records the disposition of `63bfd278` in `STATUS.md` before any provider-calling
  step. No customer-audit regeneration is an experiment cell unless the manifest pre-declared it.
- **U-2 — NON-BLOCKING for PX-1 (parallel track only).** The IA review refers to
  `TASKS_REPORT_IA_PROTOTYPE.md` (Section 5), which is not in the repo root or the Astra packet. The
  parallel track proceeds from the IA review and the R2 design-lab spec until the prototype task is
  located or rewritten.
- **U-3 — split.** *Resolved for PX-1:* empirical answer lengths — 18 answers on `1e9122fe` range 527 to
  4,649 characters, zero storage-ceiling hits, five provider-side `max_tokens` stops; PX-1's design does not
  depend on the remaining unknowns (it instruments ceiling hits instead). *Moot:* Supabase Storage
  acceptability (option C deferred). *Explicit experiment-preparation unknowns, resolved in the manifest
  and verification steps, not before PX-1:* whether the current OpenAI `web_search_preview` adapter accepts
  `user_location` (E1 manifest records support status); whether Trigger env changes apply without a
  redeploy (checked at PX-5 / production verification).
- **U-4 — NON-BLOCKING for PX-1.** Astra reported "28 existing tests across five selected suites" passing
  on 2026-09-07; the exact suite selection is not recoverable from the packet and is not re-derived here.
  The relevant suites and their test names are listed in §6 by inspection.

Sources read for this document: `STATUS.md` (2026-09-04), `CLAUDE.md`, `AGENTS.md`, `DEPLOY.md`,
`DEFECTS_BACKLOG.md`, `TASKS_FRONTIER_HORIZON_A_V2_1.md`, `HORIZON_A_V2_1_CHANGELOG.md`,
`CLEARSIGNAL_FRONTIER_REVIEW_G2_2026-09-02.md` (with addendum),
`CLEARSIGNAL_EVALS_AND_MEASUREMENT_2026-08-21.md`, the Astra review (Sections A–G in the brief),
`PARALLEL_TRACK_REPORT_IA_RESET_REVIEW.md`, `evals/README.md`, `evals/labels/SCHEMA.md`,
`evals/baseline/BASELINE_2026-08-21.md`, `evals/golden/MANIFEST.md`, `package.json`, and the code paths
cited inline (`lib/geo/index.ts`, `lib/geo/coverage.ts`, `lib/geo/provider-limiter.ts`,
`lib/audit-runner.ts`, `lib/schemas.ts`, `trigger/audit-task.ts`, `tests/*`).

---

## Execution queue (operator-ready)

Each step: name · purpose · prerequisites · Codex scope · Fable scope · exit gate · next allowed step.
One step = one session (Codex) unless marked owner/operator.

0. **PX-0 Alahli audit identity and R39 disposition** (owner, read-only, no code) · remove ambiguous
   audit IDs from the roadmap and `STATUS.md`; fix the customer-audit-is-not-an-experiment rule · none ·
   none · verify the §5 PX-0 timeline against the recorded row facts; correct §2 if needed · `STATUS.md`
   names `1e9122fe` as canonical client evidence and closes or retargets the R39 line · runs in parallel
   with **1–3**; must be done before **4** and before any provider-calling step
1. **PX-1 Evidence retention (accepted architecture)** · measurement bounded by retained evidence · none
   (PX-0 not required) · `lib/geo/index.ts` detection on the stored `answer_text` under one
   `MEASUREMENT_TEXT_LIMIT`, `evidence_completeness` + `measured_text_length` fields, `acquisition_protocol.
   measurement_text_limit`, `lib/audit-runner.ts` recompute guard for `not_retained` rows, validator
   consistency checks, censored caption on all paths, late-mention / inside-ceiling / not-retained / size
   regressions · review against §5 PX-1 line by line; reject any measurement of unstored text, any external
   storage, any change to the hash scope, any silent recompute of a `not_retained` row; verify tests exercise
   >24,000 chars · tsc, build, vitest green; the four PX-1 regressions present · **2**
2. **PX-2 Stale observation replacement** · recompute always writes new observations · none (may follow 1
   in a separate session) · `lib/audit-runner.ts:328` wholesale replacement; parity tests (i)–(iii) ·
   confirm A3 semantics unchanged elsewhere; confirm validator behaviour on empty observations · tests green
   · **3**
3. **PX-3 Disclosure parity** · identical methodology on fresh/reuse/regenerate · none · shared builder,
   thread `requestedMarketsLanguages` through `runFullAudit`/`runGeoScan`/Trigger payload; parity test with
   an Arabic-requested fixture · verify the three paths call one builder; verify Alahli-equivalent output
   · tests green · **4**
4. **PX-5 Deploy + zero-call baseline check** (operator) · put fixes live and prove recompute parity ·
   0 done; 1–3 merged · none · none · Vercel and Trigger at the same SHA; one stored-evidence re-render of a
   controlled audit with zero provider calls; `STATUS.md` updated · **5** (and **PX-4** labels in parallel)
5. **GATE-A suites + LBL-1 runner** · pre-experiment integrity checks · 4 · rewrite MT-6/AD-1
   expectations; add MT-1 population preservation, MT-3 unresolved-never-promoted, MT-5 overflow,
   MT-15 burst+retry, PAR-1/2/3, RES-1; minimal approved-label runner printing numerator/denominator/
   unknowns · confirm no test enforces a rejected semantic; confirm the runner reads only `approved` rows ·
   all §6 rows green; runner output recorded; PX-4 labels approved · **6**
6. **Experiment harness** · isolated executor/recorder for E1/E2/E3 · 5 · non-production script under
   `scripts/` or `evals/`, importing production adapters/classifiers, manifest loader, cell records,
   budget stop, resume, artifact writer; excluded from builds; unit tests with mocked adapters · check the
   must/must-not list in §7.2 line by line; check no production table writes · dry run with mocked
   adapters reproduces a manifest end to end; zero provider calls · **7**
7. **Manifest + budget** (Fable drafts, owner approves) · declare cells, schedules, conditions, shared
   cells, spend ceiling · 6; measured per-provider cost from `audit_ai_call_logs` · none · write the
   manifest and reconcile arithmetic with §7.4 · owner signs the spend ceiling in `STATUS.md` · **8**
8. **Fresh control as reference block** (operator) · integration canary on the current revision · 0 and 7;
   no paid audit queued; the audit is pre-declared in the manifest · none · verify the §8 evidence list;
   separate integrity from coverage outcome · all
   §8 items recorded in `STATUS.md`; recompute parity with zero calls · **9**
9. **E1 screening + E3 schedule blocks** (operator runs the harness; Fable adjudicates) · location value;
   feasible schedule · 8 · none · apply §9/§10 decision rules including INCONCLUSIVE; write
   `evals/experiments/<id>/SUMMARY.md` · E3 schedule adjudicated; E1 provisional or final · **10**
10. **E2 repeat-count block** · smallest sufficient n · 9 (selected condition and schedule) · none ·
    apply §11 rules with predeclared tolerances; record reviewer-decision impact · E2 adjudicated or
    INCONCLUSIVE · **11**
11. **A2 decision record** (Fable writes, owner signs) · freeze every §12 field · 10 · none · write
    `A2_DECISION_RECORD_<date>.md` · owner sign-off line in `STATUS.md` · **12**
12. **A2 implementation** (several Codex sessions, one concern each: matrix/identity; waves/schedule/
    recovery; metrics/bounds/stability; schemas/validator/reuse parity; report/PDF display) · ship the §13
    contract · 11 · as listed · review each session against §13 MUST and the decision record; reject any
    guessed value · tsc/build/vitest green per session · **13**
13. **GATE-B suites** · pre-release integrity · 12 · §14 tests · confirm rewritten expectations; confirm
    no rejected semantic is enforced · all §14 rows green on the release SHA · **14**
14. **Production A2 verification** (operator) · prove the contract on production infrastructure · 13
    deployed · none · verify §15 records · `STATUS.md` records cost, elapsed, recovery, parity; default
    set per §12 · **15**
15. **A5a-COMPLETE** · broaden evaluation to the §16 scope · 14 · eval command, thresholds, CI wiring,
    fixtures, label export · confirm known-failure detection · `npm run eval` demonstrably fails on each
    seeded known failure · **16**
16. **A5b narrow** · structured review decisions as evaluation data · 15 (A3 baseline suffices technically;
    sequenced after A5a-COMPLETE) · `ReviewDecision` storage, admin API, export, one recomputation path ·
    confirm append-only, supersession, raw acquisition preserved · one reviewed error becomes a regression
    case · **17**
17. **Horizon A close** (owner + Fable) · declare completion against §18 · 16; five paying audits observed
    per §21; R38 closed · none · write the closure note; move this file and V2.1 to `docs/archive/` ·
    `STATUS.md` records Horizon A complete · Horizon B planning may begin
