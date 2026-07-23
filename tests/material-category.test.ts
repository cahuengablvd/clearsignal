import { describe, expect, it } from 'vitest'
import { materialCategoryForContext } from '../lib/materials'
import type { BusinessContext } from '../lib/schemas'

function context(overrides: Partial<BusinessContext>): BusinessContext {
  return {
    business_model: 'unknown',
    primary_conversion_goal: 'unknown',
    purchase_availability: 'unknown',
    ships_internationally: 'unknown',
    provenance_or_authentication: 'unknown',
    target_markets_languages: '',
    verified_facts: '',
    ...overrides,
  }
}

describe('material category classification', () => {
  it('uses the operator-selected marketplace model before prose inference', () => {
    expect(
      materialCategoryForContext(context({
        business_model: 'two_sided_marketplace',
        verified_facts:
          'Customers compare cleaners and select the offer that suits them.',
      }))
    ).toBe('marketplace')
  })

  it('does not classify ordinary use of "suits" as tailoring', () => {
    expect(
      materialCategoryForContext(context({
        verified_facts: 'Customers select the offer that suits them.',
      }))
    ).toBe('default')
  })

  it('still classifies strong tailoring language', () => {
    expect(
      materialCategoryForContext(context({
        verified_facts: 'A bespoke atelier offering made-to-measure suits.',
      }))
    ).toBe('tailoring_atelier')
  })
})
