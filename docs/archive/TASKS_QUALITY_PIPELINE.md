# Multi-pass audit quality pipeline (Phases 1–5)

Context for the implementer (Codex). Reviewer: Claude Code — each phase ends with a
review checkpoint; do not start the next phase until the previous one is reviewed.

Goal: catch the defect classes that still reach PDFs (replacement-phrase leaks, empty
action items, FAQ answers that don't answer their question, foreign-industry schema
types, unverified claims in publishable copy) with a bounded critic→repair→final-review
pipeline, WITHOUT regenerating the whole report and WITHOUT creating a new parallel
validation layer.

## Architectural rules (non-negotiable)

1. **Single source of truth for phrases.** The critic/validators must import
   `REPLACEMENT_SENTENCES` / `CLIENT_VISIBLE_REPLACEMENT_SENTENCES` from
   `lib/trust/decisions.ts` and the shared lists in `lib/trust-phrases.ts`. Never
   define a second denylist. If a phrase family is missing, add it to the existing
   module.
2. **Extend `validateReport`, don't fork it.** All new deterministic checks go into
   `lib/report-validator.ts` (or modules it calls). There must remain exactly one
   deterministic validation entry point.
3. **Protected paths are hard-coded and patch application rejects them:** everything
   under `geo.evidence`, `geo.test_counts`, `geo.*_rate`, `geo.ai_visibility_score`,
   `geo.share_of_voice`, `technical_findings`, `meta.*` identity fields
   (`canonical_brand`, `alternative_brand_forms`, `brand_domain`), `evidence_id(s)`,
   `validation_warnings`, and anything matched by the validator's `RAW_KEYS` /
   `RAW_PREFIXES`. Reuse `isRawPath` — do not duplicate the list.
4. **Quote-leakage rule (documented failure mode, see report-validator.ts ~line 52):**
   critic issues quote defective text verbatim (`currentText`). Everything stored under
   the new `quality` JSONB (issues, patches, reviews) MUST be excluded from artifact
   scanning the same way `validation_warnings` is (add its path prefix to
   `RAW_PREFIXES`), or every critic run will re-trigger the artifact detector on its
   own output.
5. **Bounded calls.** Per audit generation: max 1 critic + 1 repair + 1 final review +
   1 optional repair (only when final review returns `repairable`). Never loop. All
   four run as stages through `runAuditStage` (lib/audit-execution.ts) so Trigger.dev
   retries cannot re-execute completed passes, and all calls go through
   `callClaudeJSON` with `onUsage` wired to the audit's `CostTracker` and
   `meta` wired to `logAnthropicCall` (they land in `audit_ai_call_logs`).
6. **Real schema paths only.** Issue/patch paths address the actual
   `ClearSignalReport` shape (lib/schemas.ts): `action.top_fixes[2].title`,
   `ready_materials.faq[1].answer`, `implementation_briefs[0].steps[2]`,
   `gap.ai_search.finding`, `clarity.cta.suggested_rewrite`. The spec draft used
   invented names (`actionPlan`, `readyMaterials`) — do not copy them.
7. **Feature flags.** `QUALITY_CRITIC_ENABLED` (phase 2), `QUALITY_REPAIR_ENABLED`
   (phase 3), `QUALITY_GATE_ENABLED` (phase 4). Default all to off; each phase ships
   dark and is enabled after review.

---

## Phase 1 — Deterministic validator extensions (no AI, all tiers)

New checks inside the existing `validateReport` pass. Each pushes a warning or error
with a stable prefix so tests can assert on them.

### 1.1 Empty client-facing structures → error
For `action.top_fixes[]` (title/problem/fix), `implementation_briefs[]`
(title/steps[]/acceptance_criteria[]), `ready_materials` (meta_title,
meta_description, faq[].question, faq[].answer, cta_variants[]),
`clarity.*.suggested_rewrite` where present: empty/whitespace-only after trim, or a
bare label like `Fix:` with nothing after it → error `empty_field at <path>`.

### 1.2 FAQ structural sanity → error/warning
- answer shorter than 20 chars or equal to its question → error.
- answer that is one of `CLIENT_VISIBLE_REPLACEMENT_SENTENCES` → error (this is the
  "Contact the business to confirm appointment details" leak).
- (Semantic question↔answer match is phase 2 critic work, not deterministic.)

### 1.3 Schema-type category allowlist → error
New module `lib/industry-profiles/schema-allowlist.ts`:
`allowedSchemaTypes(category: string): string[] | null` (null = unknown category, skip
check). Seed with: moving_service, video_production, art_gallery, tailoring,
marketplace (values from the spec). Validator parses `ready_materials.json_ld` and any
`@type` mentions in briefs; a type outside the allowlist for the audit's category →
error `schema_mismatch at <path>`. Keep the map next to `industry-profiles/` — it will
grow.

### 1.4 Policy wording → error on publishable copy, warning elsewhere
Astroturfing family: `seed discussions|seed (brand )?mentions|establish presence on
(reddit|forums)|undisclosed promotion` + fake-review phrasing. Add the detection regex
to `lib/trust-phrases.ts` and reference it from both the validator and (later) the
critic prompt.

### 1.5 Tests
Extend the golden/mutation suites (tests/): each new check gets one injected-defect
fixture asserting the exact error prefix. Re-run the 4 real fixtures (az-moving,
blvdprod, latvianart, monokelriga) — they must still pass clean (or the diff must be
reviewed as a real caught defect, which is a win, not a regression).

**Review checkpoint 1:** diff of report-validator.ts + new module + tests. No new
validation entry points, no duplicated phrase lists.

---

## Phase 2 — Critic in shadow mode (logs only, changes nothing)

### 2.1 Schemas (lib/schemas.ts)
```ts
AuditIssueSchema: {
  id: string            // critic-assigned, stable within one run
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: 'wrong_business' | 'foreign_industry' | 'unverified_claim'
    | 'replacement_leak' | 'broken_sentence' | 'empty_section'
    | 'question_answer_mismatch' | 'schema_mismatch' | 'evidence_mismatch'
    | 'internal_contradiction' | 'policy_violation' | 'grammar' | 'duplicate' | 'other'
  path: string          // real ClearSignalReport path
  explanation: string
  currentText?: string
  suggestedReplacement?: string
  canAutoFix: boolean
}
```
Cap: `.max(25)` issues per run (order by severity in the prompt).

### 2.2 Critic stage (new `lib/quality/critic.ts`)
- Runs inside `runFullAudit` after `validateReport`, before save, as
  `runAuditStage(ctx, 'quality_critic', ...)`. Gated by `QUALITY_CRITIC_ENABLED`.
- Model: `claude-haiku-4-5-20251001` (add `MODEL_QUALITY_CRITIC` to lib/prompts.ts).
  Upgrade decision happens after shadow-mode data, not before.
- Input (compact — cost control): the report JSON **minus** `geo.evidence` (send
  per-engine counts + up to 5 answer excerpts only if a mention/contradiction issue
  needs them — start WITHOUT them), plus business_context, verified_facts,
  canonical brand + aliases, category, schema allowlist for the category.
- System prompt includes `SHARED_POLICY_BLOCK` pieces + explicit list of issue
  categories + "identify issues only; never rewrite; never question GEO numbers".
- Output validated with `AuditIssueSchema`; paths validated against the actual report
  (a path that doesn't resolve → drop that issue with a console.warn, don't fail).

### 2.3 Persistence (shadow)
Single JSONB column `audits.quality` (migration `010_audit_quality.sql`):
```ts
{ critic?: { issues: AuditIssue[], model, ranAt, attempt },
  patches?: ..., finalReview?: ..., repairAttempts?: number }
```
Add `quality` to the validator's `RAW_PREFIXES` equivalent handling (rule 4 above).
Critic failure must NEVER fail the audit — catch, log, `notify` only if you add a new
AlertEvent (optional).

### 2.4 Admin UI (app/admin/page.tsx)
Read-only block per audit: `Critic: X critical / Y high / Z medium / N low` +
expandable issue list (path, explanation, suggestion). Clearly labeled "shadow mode —
not applied".

### 2.5 Shadow evaluation script
`tests/` or a small script: run the critic over the 4 stored fixtures and print
issues + token cost. Acceptance data for the phase-2 review: (a) cost per critic pass,
(b) hallucination rate judged manually, (c) issues deterministic validators missed.

**Review checkpoint 2:** critic prompt, schema, persistence, shadow results. GO/NO-GO
on phase 3 based on shadow data.

---

## Phase 3 — Targeted repair engine (feature-flagged)

### 3.1 Patch schema + applier (`lib/quality/patch.ts`)
```ts
AuditPatchSchema: { path, operation: 'replace' | 'remove', value?, reason }
applyPatches(report, patches): { report, applied: AuditPatch[], rejected: {patch, reason}[] }
```
Pure function. Rejection rules: protected path (rule 3), path doesn't resolve, value
fails the zod type of the target field, `remove` on a required field, or removal that
would violate schema minimums (e.g. faq min 4, cta_variants min 3, outreach = 3).
**Apply array patches in descending index order per parent array** (removals shift
indices). Unit-test the index-shift case explicitly.

### 3.2 Repair stage (`lib/quality/repair.ts`)
- `runAuditStage(ctx, 'quality_repair', ...)`, gated by `QUALITY_REPAIR_ENABLED`.
- Input: only issues with `canAutoFix && severity in (critical, high)` + the affected
  field values + verified facts + category. NOT the whole report.
- Output: patches (validated). Apply via `applyPatches`, then **re-run
  `validateReport`** on the patched report. If the patched report validates worse
  (new errors), discard ALL patches and keep the pre-repair report — log this to
  `quality.patches` as `discarded: true`.
- Store applied + rejected patches in `audits.quality.patches`.

### 3.3 Tests
- Protected-path rejection (each family).
- Index-shift correctness.
- "Repair made it worse → discarded" path.
- Mutation test: inject a replacement-phrase FAQ answer → critic issue fixture →
  patch → final report has a real answer and passes validateReport.

**Review checkpoint 3:** patch applier is pure + fully unit-tested; repair cannot
touch protected paths; worse-after-repair rolls back.

---

## Phase 4 — Final review, export gate, statuses, recovery

### 4.1 Final review stage (`lib/quality/final-review.ts`)
`runAuditStage(ctx, 'quality_final_review', ...)`. Same model as critic. Returns
`{ status: 'pass' | 'repairable' | 'blocked', score: number, issues: AuditIssue[] }`.
If `repairable` → exactly ONE more repair cycle (3.2) + deterministic revalidate, then
final status is whatever the re-check says — no further AI calls.

### 4.2 Statuses
Keep the existing lifecycle small. Add ONE new status: `needs_operator_review`
(alongside existing `queued/processing/awaiting_review/failed/failed-validation/
delivered/delivery_failed`). Pipeline sub-state (critic/repairing/final_review) lives
in `audits.quality.stage`, NOT in `audit_status` — this keeps `audit-recovery.ts`
correct without changes, because the audit stays `processing` for the whole pipeline
and stage-locks make recovery re-entry safe. Verify: a kill during the critic stage is
recovered by the existing sweep and does not re-run completed generation stages.

### 4.3 Export gate (gated by `QUALITY_GATE_ENABLED`)
PDF export (`app/api/audit/[id]/pdf/route.ts`) and auto-delivery allowed only when:
deterministic validation errors == 0 AND (quality pipeline disabled OR
`finalReview.status === 'pass'` with zero remaining critical/high). Otherwise status →
`needs_operator_review`; admin can still view the report and manually approve
(existing approve endpoint overrides the gate — operator judgment wins).

### 4.4 Admin UI
Extend the phase-2 block: `Auto-fixed: N`, `Final score: XX/100`,
`Status: Ready / Needs operator review`, applied-patch list. Never rendered into the
client PDF.

**Review checkpoint 4:** recovery kill-test evidence, gate override path works, no new
audit_status values beyond `needs_operator_review`.

---

## Phase 5 — Tier gating

- Free score (`app/api/score/route.ts`): deterministic validators only — no change.
- Paid audit: full pipeline (flags on).
- Config: single `qualityTierFor(audit)` helper so the tier logic isn't scattered.
- Marketing copy ("Multi-pass AI quality review") is out of scope for this repo task.

---

## Cost controls summary (applies to every phase)
- Critic/repair/final-review: haiku until shadow data justifies otherwise.
- Compact inputs: no raw HTML, no full engine answers, no `geo.evidence` by default.
- `maxTokens`: critic 2048, repair 1536, final review 1024.
- Every call: `purpose` set (`quality:critic` etc.), `onUsage` → CostTracker, `meta` →
  `audit_ai_call_logs`. The phase-0 cost ceiling alert
  (`audit_cost_threshold_exceeded`) must fire on the SUM including quality stages.

## Definition of done (whole plan)
1. A report containing a `CLIENT_VISIBLE_REPLACEMENT_SENTENCES` phrase in any
   client-facing field cannot be exported.
2. Empty top_fix/brief/FAQ fields cannot be exported.
3. A `MovingCompany` schema type on a non-moving business cannot be exported.
4. Repair provably cannot change GEO metrics or evidence (rejection unit tests).
5. Max 4 quality AI calls per audit, each visible in `audit_ai_call_logs` with cost.
6. Killing the worker mid-pipeline loses no completed stage and burns no duplicate
   Claude calls (stage-lock test).
7. The 4 real fixtures pass end-to-end; injected-defect mutations are caught at the
   phase that owns them (deterministic first, critic second).
