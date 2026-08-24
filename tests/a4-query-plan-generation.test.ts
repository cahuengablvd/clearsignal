import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ callClaudeJSON: vi.fn() }))
vi.mock('../lib/anthropic', () => ({ callClaudeJSON: mocks.callClaudeJSON }))

import { generateValidatedQueryPlan } from '../lib/geo'
import type { GeneratedQuery } from '../lib/geo/query-validation'
import { QUERY_SLOTS } from '../lib/geo/query-taxonomy'

const lvQueries: GeneratedQuery[] = [
  ['labākais zobārsts Rīgā Latvijā', 'category_discovery'],
  ['kā atrast zobārstu Rīgā Latvijā', 'problem_need'],
  ['zobārsts Rīgā Latvijā salīdzinājums', 'comparison_alternatives'],
  ['zobārsts ģimenēm Rīgā Latvijā', 'icp_use_case'],
  ['uzticams zobārsts Rīgā Latvijā', 'trust_or_pricing'],
  ['vietējais zobārsts Rīgā Latvijā', 'local_or_second_decision'],
].map(([query, slot]) => ({ query, slot: slot as GeneratedQuery['slot'], language: 'lv', market: 'Riga', geo_scope: 'explicit', rationale: 'Pircēja izvēles situācija Rīgā.' }))

const ruQueries: GeneratedQuery[] = [
  ['лучший стоматолог в Риге Латвия', 'category_discovery'],
  ['как выбрать стоматолога в Риге Латвия', 'trust_or_pricing'],
].map(([query, slot]) => ({ query, slot: slot as GeneratedQuery['slot'], language: 'ru', market: 'Riga', geo_scope: 'explicit', rationale: 'Запрос покупателя в целевом рынке.' }))

function response(queries: GeneratedQuery[]) { return { queries } }

describe('A4 paid query-plan generation', () => {
  beforeEach(() => mocks.callClaudeJSON.mockReset())

  it('constructs the paid Latvia/Riga plan with scoped Russian probes and passes intake context to the structured prompt', async () => {
    mocks.callClaudeJSON.mockResolvedValue(response([...lvQueries, ...ruQueries]))

    const plan = await generateValidatedQueryPlan({
      brand: 'Dental Riga',
      brandAliases: ['Dental Riga', 'dentalriga.lv', 'DentalRiga'],
      category: 'Family dentistry and dental hygiene',
      icp: 'Families in Riga',
      targetMarketsLanguages: 'Latvia, Riga - Latvian and Russian',
    })

    expect(plan.core).toHaveLength(6)
    expect(plan.core.every((query) => query.language === 'lv')).toBe(true)
    expect(plan.provenance.filter((item) => item.scope === 'core').map((item) => item.query_id)).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'])
    expect(plan.markets).toEqual(expect.arrayContaining(['Latvia', 'Riga']))
    expect(plan.supplemental).toHaveLength(2)
    expect(plan.supplemental.every((query) => query.language === 'ru')).toBe(true)
    expect(plan.provenance.filter((item) => item.scope === 'supplemental').map((item) => item.query_id)).toEqual(['S1', 'S2'])
    expect(plan.provenance.filter((item) => item.scope === 'supplemental').every((item) => !plan.core.some((core) => core.query === item.query))).toBe(true)

    const request = mocks.callClaudeJSON.mock.calls[0][0]
    expect(request.user).toContain('Target markets: Latvia, Riga')
    expect(request.user).toContain('category_discovery: lv, core')
    expect(request.user).toContain('category_discovery: ru, supplemental')
    expect(request.user).toContain('Brand forms that must not appear: Dental Riga, dentalriga.lv, DentalRiga')
  })

  it('uses the supplied intake rather than hardcoding the Latvia/Riga plan', async () => {
    const englishQueries = [
      'best accounting service in Toronto for startups',
      'how can startups find accountant Toronto',
      'accounting alternatives in Toronto for startups',
      'accountant software Toronto startup teams',
      'trusted accountant Toronto for startups',
      'local accountant Toronto startups today',
    ]
    const english = QUERY_SLOTS.map((slot, index): GeneratedQuery => ({ query: englishQueries[index], slot, language: 'en', geo_scope: 'none', rationale: 'Buyer research question.' }))
    mocks.callClaudeJSON.mockResolvedValue(response(english))

    const plan = await generateValidatedQueryPlan({ brand: 'Northstar', category: 'Accounting service', targetMarketsLanguages: 'Toronto; English' })

    expect(plan.primary_language).toBe('en')
    expect(plan.markets).toEqual(['Toronto'])
    expect(plan.supplemental).toEqual([])
    expect(mocks.callClaudeJSON.mock.calls[0][0].user).toContain('Target markets: Toronto')
  })

  it('repairs only invalid slots once, keeps valid slots, and records an unavailable slot without a fallback query', async () => {
    const initial = lvQueries.map((query) => ({ ...query }))
    initial[1] = { ...initial[1], query: 'Dental Riga zobārsts Rīgā Latvijā' }
    initial[3] = { ...initial[3], query: 'ChatGPT zobārsts Rīgā Latvijā ģimenēm' }
    const repairedQ4 = { ...lvQueries[3], query: 'zobārsts bērniem Rīgā Latvijā' }
    mocks.callClaudeJSON
      .mockResolvedValueOnce(response(initial))
      .mockResolvedValueOnce(response([{ ...initial[1] }, repairedQ4]))

    const plan = await generateValidatedQueryPlan({ brand: 'Dental Riga', brandAliases: ['Dental Riga'], targetMarketsLanguages: 'Latvia, Riga - Latvian' })

    expect(mocks.callClaudeJSON).toHaveBeenCalledTimes(2)
    expect(mocks.callClaudeJSON.mock.calls[1][0].user).toContain('Regenerate only these invalid slots')
    expect(mocks.callClaudeJSON.mock.calls[1][0].user).toContain('problem_need')
    expect(mocks.callClaudeJSON.mock.calls[1][0].user).toContain('icp_use_case')
    expect(mocks.callClaudeJSON.mock.calls[1][0].user).not.toContain('category_discovery: lv, core')
    expect(plan.provenance.find((item) => item.query_id === 'Q1')?.query).toBe(lvQueries[0].query)
    expect(plan.provenance.find((item) => item.query_id === 'Q2')).toMatchObject({ state: 'unavailable', unavailable_reason: expect.stringContaining('brand_leak') })
    expect(plan.provenance.find((item) => item.query_id === 'Q2')?.query).toBe(initial[1].query)
    expect(plan.core.some((item) => item.query === initial[1].query)).toBe(false)
    expect(plan.valid_core_slots).toBe(5)
    expect(plan.review_required).toBe(true)
  })

  it('repairs a core slot without regenerating its valid supplemental counterpart', async () => {
    const initial = [...lvQueries.map((query) => ({ ...query })), ...ruQueries.map((query) => ({ ...query }))]
    initial[0] = { ...initial[0], query: 'Dental Riga zobārsts Rīgā Latvijā' }
    mocks.callClaudeJSON
      .mockResolvedValueOnce(response(initial))
      .mockResolvedValueOnce(response([{ ...lvQueries[0], query: 'labākais zobārsts Rīgā Latvijā ģimenēm' }]))

    const plan = await generateValidatedQueryPlan({ brand: 'Dental Riga', brandAliases: ['Dental Riga'], targetMarketsLanguages: 'Latvia, Riga - Latvian and Russian' })

    const repairRequest = mocks.callClaudeJSON.mock.calls[1][0]
    expect(repairRequest.user).toContain('category_discovery: lv, core')
    expect(repairRequest.user).not.toContain('category_discovery: ru, supplemental')
    expect(plan.provenance.find((item) => item.query_id === 'S1')).toMatchObject({ query: ruQueries[0].query, validation: { regenerated: false }, state: 'valid' })
  })

  it('fails deterministically when fewer than four core slots validate', async () => {
    const invalid = lvQueries.map((query, index) => index < 3 ? query : { ...query, query: `Dental Riga zobārsts Rīgā Latvijā ${index}` })
    mocks.callClaudeJSON.mockResolvedValue(response(invalid))

    await expect(generateValidatedQueryPlan({ brand: 'Dental Riga', brandAliases: ['Dental Riga'], targetMarketsLanguages: 'Latvia, Riga - Latvian' }))
      .rejects.toMatchObject({ message: 'query_plan_insufficient', deterministic: true })
    expect(mocks.callClaudeJSON).toHaveBeenCalledTimes(2)
  })

  it('honors GEO_SECONDARY_PROBES=0 without changing the six core slots', async () => {
    const previous = process.env.GEO_SECONDARY_PROBES
    process.env.GEO_SECONDARY_PROBES = '0'
    try {
      mocks.callClaudeJSON.mockResolvedValue(response(lvQueries))
      const plan = await generateValidatedQueryPlan({ brand: 'Dental Riga', brandAliases: ['Dental Riga'], targetMarketsLanguages: 'Latvia, Riga - Latvian and Russian' })
      expect(plan.core).toHaveLength(6)
      expect(plan.provenance.filter((item) => item.scope === 'core').map((item) => item.slot)).toEqual(QUERY_SLOTS)
      expect(plan.supplemental).toEqual([])
      expect(plan.provenance.filter((item) => item.scope === 'supplemental')).toEqual([])
    } finally {
      if (previous === undefined) delete process.env.GEO_SECONDARY_PROBES
      else process.env.GEO_SECONDARY_PROBES = previous
    }
  })
})
