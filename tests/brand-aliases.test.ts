import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mergeBrandAliases, parseBrandAliases, resolveBrandEntity } from '../lib/brand'
import { recomputeReusedGeoEvidence } from '../lib/audit-runner'
import { BusinessContextSchema, type ClearSignalReport } from '../lib/schemas'
import { buildVariants, textMentions } from '../lib/geo/detect'

function reportFixture(): ClearSignalReport {
  return JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/golden-report-rozie.json'), 'utf8')) as ClearSignalReport
}

describe('operator-confirmed brand aliases', () => {
  it('recognizes an unrelated legal name and initialism in stored answer evidence', () => {
    const report = reportFixture()
    const geo = report.geo!
    geo.brand = 'Alahli'
    geo.brand_domain = 'alahli.com'
    geo.evidence = geo.evidence.map((item, index) => ({
      ...item,
      answer_text: index === 0 ? 'Saudi National Bank (SNB) offers a range of savings accounts.' : 'A different answer.',
      answer_excerpt: index === 0 ? 'Saudi National Bank (SNB) offers a range of savings accounts.' : 'A different answer.',
      brand_mentioned: false,
    }))

    const withoutAliases = recomputeReusedGeoEvidence(geo, { canonicalBrand: 'Alahli' })
    const withAliases = recomputeReusedGeoEvidence(geo, {
      canonicalBrand: 'Alahli',
      alternativeBrandForms: ['Saudi National Bank', 'SNB'],
    })

    expect(withoutAliases.evidence[0]?.brand_mentioned).toBe(false)
    expect(withAliases.evidence[0]?.brand_mentioned).toBe(true)
    expect(withAliases.evidence[0]?.competitors_mentioned).not.toContain('SNB')
  })

  it('trims and de-duplicates aliases while preserving operator spelling in the report entity', () => {
    expect(parseBrandAliases(' Saudi National Bank ; SNB; snb!; ; SNB AlAhli ')).toEqual([
      'Saudi National Bank',
      'SNB',
      'SNB AlAhli',
    ])
    const entity = mergeBrandAliases(resolveBrandEntity({ url: 'https://alahli.com' }), 'Saudi National Bank; SNB')
    expect(entity.alternative_brand_forms).toEqual(expect.arrayContaining(['Saudi National Bank', 'SNB']))
  })

  it('rejects more than ten non-empty aliases with a clear message', () => {
    const value = Array.from({ length: 12 }, (_, index) => `Alias ${index + 1}`).join('; ')
    const parsed = BusinessContextSchema.safeParse({ brand_aliases: value })
    expect(parsed.success).toBe(false)
    if (!parsed.success) expect(parsed.error.errors[0]?.message).toMatch(/10 names or fewer/)
  })

  it('keeps initialisms token-exact', () => {
    expect(textMentions('SNB is named.', buildVariants({ name: 'SNB' }).tokens)).toBe(true)
    expect(textMentions('snbc is unrelated.', buildVariants({ name: 'SNB' }).tokens)).toBe(false)
  })
})
