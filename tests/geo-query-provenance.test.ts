import { describe, expect, it } from 'vitest'
import { applyOperatorEdits, validateSavedQueryPlan } from '../lib/geo'
import { intentForSlot, QUERY_SLOTS } from '../lib/geo/query-taxonomy'
import type { QueryProvenance } from '../lib/schemas'

function plan() {
  const provenance: QueryProvenance[] = QUERY_SLOTS.map((slot, index) => ({ query_id: `Q${index + 1}`, query: `best service in Riga for buyer ${index + 1}`, slot, intent: intentForSlot(slot), language: 'en', language_source: 'intake' as const, market: 'Riga', geo_scope: 'explicit' as const, scope: 'core' as const, source: 'operator' as const, rationale: 'Buyer situation in the target market.', validation: { passed: true, errors: [], warnings: [], regenerated: false }, state: 'valid' as const }))
  return { core: provenance.map(({ query, slot, language, market, geo_scope, rationale }) => ({ query, slot, language, market, geo_scope, rationale })), supplemental: [], provenance, valid_core_slots: 6, review_required: false, primary_language: 'en', markets: ['Riga'] }
}
describe('A4 persisted query-plan validation', () => {
  it('accepts an ordered six-slot saved plan', () => expect(validateSavedQueryPlan(plan()).valid).toBe(true))
  it('rejects duplicate slots and supplemental scope masquerading as core', () => {
    const duplicate = plan(); duplicate.provenance[1] = { ...duplicate.provenance[1], slot: 'category_discovery' }
    expect(validateSavedQueryPlan(duplicate)).toMatchObject({ valid: false, reason: 'query_plan_core_identity' })
    const malformed = plan(); malformed.provenance[0] = { ...malformed.provenance[0], scope: 'supplemental', query_id: 'S1' }
    expect(validateSavedQueryPlan(malformed).valid).toBe(false)
  })
  it('records valid edits as operator provenance and preserves invalid errors unless explicitly overridden', () => {
    const saved = validateSavedQueryPlan(plan())
    if (!saved.valid) throw new Error(saved.reason)
    const valid = applyOperatorEdits(saved.plan, ['best cleaning service in Riga for families'], { brandAliases: ['cleanco'], markets: ['Riga'] })
    expect(valid.plan.provenance[0]).toMatchObject({ source: 'operator', state: 'valid' })
    const invalid = applyOperatorEdits(saved.plan, ['best cleanco service in Riga'], { brandAliases: ['cleanco'], markets: ['Riga'] })
    expect(invalid.rejected).toBe(true)
    expect(invalid.plan.provenance[0].validation.errors).toContain('brand_leak')
    const overridden = applyOperatorEdits(saved.plan, ['best cleanco service in Riga'], { brandAliases: ['cleanco'], markets: ['Riga'], override: true })
    expect(overridden.plan.provenance[0].validation).toMatchObject({ passed: false, overridden_by_operator: true })
  })
  it('rejects duplicate operator edits while retaining positional identities', () => {
    const saved = validateSavedQueryPlan(plan())
    if (!saved.valid) throw new Error(saved.reason)
    const duplicate = 'best cleaning service in Riga for families'
    const result = applyOperatorEdits(saved.plan, [duplicate, duplicate], { brandAliases: ['cleanco'], markets: ['Riga'] })
    expect(result.rejected).toBe(true)
    expect(result.plan.provenance[0]).toMatchObject({ query_id: 'Q1', query: duplicate, state: 'unavailable' })
    expect(result.plan.provenance[1]).toMatchObject({ query_id: 'Q2', query: duplicate, state: 'unavailable' })
    expect(result.plan.provenance.slice(0, 2).every((item) => item.validation.errors.includes('duplicate'))).toBe(true)
  })
})
