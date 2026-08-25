import { describe, expect, it } from 'vitest'
import { hasInsufficientQueryPlan } from '../lib/admin-preview'

describe('admin preview client contract', () => {
  it('accepts the serialized 422 diagnostic plan for rendering', () => {
    const body = {
      error: 'query_plan_insufficient',
      status: 'query_plan_insufficient',
      plan: {
        valid_core_slots: 0,
        review_required: true,
        provenance: [{
          query_id: 'Q1',
          slot: 'category_discovery',
          language: 'lv',
          scope: 'core',
          state: 'unavailable',
          unavailable_reason: 'missing_slot',
          validation: { errors: ['missing_slot'], warnings: [] },
        }],
      },
    }

    expect(hasInsufficientQueryPlan(body)).toBe(true)
    expect(hasInsufficientQueryPlan({ status: 'query_plan_insufficient' })).toBe(false)
    expect(hasInsufficientQueryPlan({ status: 'other', plan: body.plan })).toBe(false)
  })
})
