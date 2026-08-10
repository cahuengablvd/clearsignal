import { describe, expect, it } from 'vitest'
import { assembleMaterials, materialCategoryForContext } from '../lib/materials'
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

  it('uses the operator-selected SaaS model before contradictory observed prose', () => {
    expect(
      materialCategoryForContext(
        context({ business_model: 'saas_software', verified_facts: 'A software product for agencies.' }),
        { inferred_business_type: 'Moving service', observed_service_category: 'Moving services' }
      )
    ).toBe('default')
  })

  it('does not infer a category from an unrecognized custom business model', () => {
    expect(
      materialCategoryForContext(
        context({ business_model: 'Custom category', verified_facts: 'A moving company in Toronto.' }),
        { inferred_business_type: 'Moving service', observed_service_category: 'Moving services' }
      )
    ).toBe('default')
  })

  it('ships generic Organization and FAQPage materials when no category is established', () => {
    const materials = assembleMaterials(
      'ClearSignal',
      'https://getclearsignal.io',
      {
        meta_title: '',
        meta_description: '',
        faq: [],
        cta_variants: [],
      },
      { businessContext: context({ business_model: 'unknown' }) }
    )
    const jsonLd = JSON.parse(materials.json_ld.replace(/<\/?script[^>]*>/g, '').trim())
    expect(jsonLd['@graph'].map((node: { '@type': string }) => node['@type'])).toEqual(['Organization', 'FAQPage'])
    expect(materials.meta_description).toMatch(/category was not established/i)
  })

  it('keeps an explicitly operator-confirmed moving service on the moving path', () => {
    expect(materialCategoryForContext(context({ business_model: 'moving_service' }))).toBe('moving_service')
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
