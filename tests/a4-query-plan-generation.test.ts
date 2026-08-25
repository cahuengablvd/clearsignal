import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ callClaudeJSON: vi.fn() }))
vi.mock('../lib/anthropic', () => ({ callClaudeJSON: mocks.callClaudeJSON }))

import { generateValidatedQueryPlan } from '../lib/geo'
import { detectLanguage } from '../lib/geo/language'
import { geoQueriesUserPrompt } from '../lib/prompts'
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
    expect(request.maxTokens).toBe(1800)
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

  it('repairs the controlled ClearSignal Latvia/Riga production defect once and keeps valid rows untouched', async () => {
    const initial = [...lvQueries.map((query) => ({ ...query })), ...ruQueries.map((query) => ({ ...query }))]
    initial[0] = { ...initial[0], query: 'what is the best AI visibility audit service', language: 'lv', market: '', geo_scope: 'none' }
    initial[6] = { ...initial[6], query: '\u043a\u0430\u043a\u043e\u0439 ChatGPT query \u043d\u0443\u0436\u0435\u043d \u0434\u043b\u044f \u0430\u0443\u0434\u0438\u0442\u0430 \u0432\u0438\u0434\u0438\u043c\u043e\u0441\u0442\u0438', language: 'ru', market: 'Riga', geo_scope: 'explicit' }
    const repairedQ1: GeneratedQuery = { ...lvQueries[0], query: 'k\u0101 izv\u0113l\u0113ties AI redzam\u012bbas auditu R\u012bg\u0101 Latvij\u0101' }
    const repairedS1: GeneratedQuery = { ...ruQueries[0], query: '\u0433\u0434\u0435 \u0437\u0430\u043a\u0430\u0437\u0430\u0442\u044c \u0430\u0443\u0434\u0438\u0442 AI-\u0432\u0438\u0434\u0438\u043c\u043e\u0441\u0442\u0438 \u0432 \u0420\u0438\u0433\u0435 \u041b\u0430\u0442\u0432\u0438\u044f' }
    mocks.callClaudeJSON
      .mockResolvedValueOnce(response(initial))
      .mockResolvedValueOnce(response([repairedQ1, repairedS1]))

    const plan = await generateValidatedQueryPlan({
      brand: 'ClearSignal',
      brandAliases: ['ClearSignal', 'getclearsignal.io'],
      category: 'AI visibility audit',
      icp: 'Marketing and SEO agencies',
      targetMarketsLanguages: 'Latvia, Riga - Latvian and Russian',
    })

    expect(mocks.callClaudeJSON).toHaveBeenCalledTimes(2)
    expect(plan.provenance.filter((item) => item.state === 'unavailable').map((item) => ({ id: item.query_id, errors: item.validation.errors }))).toEqual([])
    expect(plan.core).toHaveLength(6)
    expect(plan.supplemental).toHaveLength(2)
    expect(plan.core.every((query) => detectLanguage(query.query).lang === 'lv')).toBe(true)
    expect(plan.supplemental.every((query) => detectLanguage(query.query).lang === 'ru')).toBe(true)
    expect(plan.provenance.filter((item) => item.scope === 'core' && ['category_discovery', 'icp_use_case', 'local_or_second_decision'].includes(item.slot)).every((item) => item.validation.errors.includes('geo_scope_missing') === false)).toBe(true)
    expect(plan.provenance.every((item) => item.validation.errors.includes('meta_words') === false && item.validation.errors.includes('engine_name') === false && item.validation.errors.includes('category_missing') === false)).toBe(true)
    expect(plan.provenance.find((item) => item.query_id === 'Q2')?.query).toBe(lvQueries[1].query)
    expect(plan.provenance.find((item) => item.query_id === 'S2')?.query).toBe(ruQueries[1].query)

    const generationPrompt = mocks.callClaudeJSON.mock.calls[0][0].user
    expect(generationPrompt).toContain('query string itself MUST be fully written in the requested language')
    expect(generationPrompt).toContain('MUST include an accepted target-market form')
    expect(generationPrompt).toContain('Never mention query, prompt, testing mechanics, ChatGPT, Claude, Perplexity')
    expect(generationPrompt).toContain('category_discovery, include the actual buyer-facing product or service category')

    const repairPrompt = mocks.callClaudeJSON.mock.calls[1][0].user
    expect(repairPrompt).toContain('language_mismatch')
    expect(repairPrompt).toContain('previous query was not written in lv')
    expect(repairPrompt).toContain('geo_scope_missing')
    expect(repairPrompt).toContain('accepted target-market form')
    expect(repairPrompt).toContain('meta_words')
    expect(repairPrompt).toContain('Do not mention query, prompt, or testing mechanics')
    expect(repairPrompt).toContain('engine_name')
    expect(repairPrompt).toContain('Do not mention ChatGPT, Claude, Perplexity, or OpenAI')
  })

  it('normalizes language-name metadata before matching planned Latvia/Riga rows and preserves the declaration', async () => {
    const declaredNames = [...lvQueries, ...ruQueries].map((query) => ({
      ...query,
      language: query.language === 'lv' ? 'Latvian' : 'Russian',
    }))
    mocks.callClaudeJSON.mockResolvedValue(response(declaredNames))

    const plan = await generateValidatedQueryPlan({
      brand: 'ClearSignal',
      brandAliases: ['ClearSignal', 'getclearsignal.io'],
      category: 'AI visibility audit',
      icp: 'Marketing and SEO agencies',
      targetMarketsLanguages: 'Latvia, Riga - Latvian and Russian',
    })

    expect(mocks.callClaudeJSON).toHaveBeenCalledTimes(1)
    expect(plan.core).toHaveLength(6)
    expect(plan.supplemental).toHaveLength(2)
    expect(plan.core.every((query) => query.language === 'lv')).toBe(true)
    expect(plan.supplemental.every((query) => query.language === 'ru')).toBe(true)
    expect(plan.provenance.filter((item) => item.scope === 'core').every((item) => item.model_language === 'Latvian')).toBe(true)
    expect(plan.provenance.filter((item) => item.scope === 'supplemental').every((item) => item.model_language === 'Russian')).toBe(true)
  })

  it('states the complete repair contract for each validator failure', () => {
    const prompt = geoQueriesUserPrompt('ClearSignal', 'AI visibility audit', 'SEO agencies', 1, {
      primaryLanguage: 'lv',
      markets: ['Latvia', 'Riga'],
      plan: [{ slot: 'category_discovery', language: 'lv', scope: 'core' }],
      regenerate: [{ slot: 'category_discovery', language: 'lv', scope: 'core', errors: ['language_mismatch', 'geo_scope_missing', 'meta_words', 'engine_name', 'category_missing'] }],
    })

    expect(prompt).toContain('previous query was not written in lv')
    expect(prompt).toContain('accepted target-market form')
    expect(prompt).toContain('Do not mention query, prompt, or testing mechanics')
    expect(prompt).toContain('Do not mention ChatGPT, Claude, Perplexity, or OpenAI')
    expect(prompt).toContain('Include the buyer-facing product or service category')
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
