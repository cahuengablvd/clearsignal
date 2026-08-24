import { describe, expect, it } from 'vitest'
import { validateGeneratedQuery, type GeneratedQuery } from '../lib/geo/query-validation'

const base: GeneratedQuery = { query: 'best cleaning service in Riga for families', slot: 'category_discovery', language: 'en', market: 'Riga', geo_scope: 'explicit', rationale: 'Category discovery in the target market.' }
const context = { brandAliases: ['CleanCo', 'cleanco.lv'], markets: ['Riga'], language: 'en', engineNames: ['Claude'], siblings: [] as GeneratedQuery[], categoryTerms: ['cleaning', 'service'] }
describe('A4 deterministic query validation', () => {
  it('accepts a valid query and rejects core hazards', () => {
    expect(validateGeneratedQuery(base, context).passed).toBe(true)
    expect(validateGeneratedQuery({ ...base, query: 'best CleanCo service in Riga for families' }, context).errors).toContain('brand_leak')
    expect(validateGeneratedQuery({ ...base, query: 'best service Riga' }, context).errors).toContain('length_words')
    expect(validateGeneratedQuery({ ...base, query: 'write a ChatGPT prompt for cleaning in Riga' }, context).errors).toContain('meta_words')
    expect(validateGeneratedQuery({ ...base, query: 'best cleaning service for families' }, context).errors).toContain('geo_scope_missing')
  })
  it('flags duplicates, engine names and unknown language without rejecting unknown alone', () => {
    expect(validateGeneratedQuery(base, { ...context, siblings: [{ ...base, query: 'best cleaning service in Riga for families today' }] }).errors).toContain('duplicate')
    expect(validateGeneratedQuery({ ...base, query: 'best Claude cleaning service in Riga' }, context).errors).toContain('engine_name')
    expect(validateGeneratedQuery({ ...base, query: 'xqz blrp qwe rty', language: 'en' }, { ...context, markets: [] }).warnings).toContain('language_unknown')
  })
  it('reports language and slot mismatches through production validation', () => {
    expect(validateGeneratedQuery({ ...base, query: '\u043a\u0430\u043a \u0432\u044b\u0431\u0440\u0430\u0442\u044c \u043b\u0443\u0447\u0448\u0438\u0439 \u0441\u0435\u0440\u0432\u0438\u0441 \u0432 \u0420\u0438\u0433\u0435', language: 'en' }, context).errors).toContain('language_mismatch')
    expect(validateGeneratedQuery({ ...base, query: 'compare cleaning services in Riga for families' }, context).warnings).toContain('slot_mismatch')
  })
})
