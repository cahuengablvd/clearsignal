import marketForms from './market-forms.json'
import { detectLanguage } from './language'
import { classifyQueryIntent, type QuerySlot } from './query-taxonomy'

export type GeoScope = 'explicit' | 'implicit' | 'none'
export type GeneratedQuery = { query: string; slot: QuerySlot; intent_choice?: 'trust' | 'pricing' | 'local' | 'use_case' | 'comparison' | 'alternatives'; language: string; model_language?: string; market?: string; geo_scope: GeoScope; rationale: string }
export type QueryValidation = { passed: boolean; errors: string[]; warnings: string[] }

const META = /\b(query|prompt|ai assistant|chatgpt|perplexity|claude)\b/i
const normalize = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
const tokens = (value: string) => new Set(normalize(value).split(' ').filter(Boolean))
function overlap(a: string, b: string) { const x = tokens(a); const y = tokens(b); const shared = [...x].filter((t) => y.has(t)).length; return shared / Math.max(1, x.size + y.size - shared) }

export function validateGeneratedQuery(q: GeneratedQuery, ctx: { brandAliases: string[]; markets: string[]; language: string; engineNames: string[]; siblings: GeneratedQuery[]; categoryTerms?: string[] }): QueryValidation {
  const errors: string[] = []; const warnings: string[] = []
  const wordCount = (q.query.match(/[\p{L}\p{N}]+/gu) || []).length
  if (wordCount < 4 || wordCount > 18) errors.push('length_words')
  const n = normalize(q.query)
  if (ctx.brandAliases.filter(Boolean).some((alias) => { const a = normalize(alias); return a && new RegExp(`(?:^| )${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?: |$)`).test(n) })) errors.push('brand_leak')
  if (ctx.siblings.some((other) => normalize(other.query) === n || overlap(other.query, q.query) >= 0.8)) errors.push('duplicate')
  const detected = detectLanguage(q.query)
  if (detected.lang === 'unknown') warnings.push('language_unknown')
  else if (detected.lang !== q.language && detected.confidence >= 0.6) errors.push('language_mismatch')
  const forms = [...ctx.markets.flatMap((market) => [market, ...Object.entries(marketForms as Record<string, string[]>).filter(([key]) => normalize(market).includes(key)).flatMap(([, values]) => values)])]
  const hasMarket = forms.some((form) => normalize(form) && n.includes(normalize(form)))
  const geoRequired = q.slot === 'category_discovery' || q.slot === 'icp_use_case' || (q.slot === 'local_or_second_decision' && q.intent_choice === 'local')
  if (ctx.markets.length && !hasMarket && geoRequired) errors.push('geo_scope_missing')
  else if (ctx.markets.length && !hasMarket && q.slot === 'problem_need') warnings.push('geo_scope_missing')
  if (META.test(q.query)) errors.push('meta_words')
  if (ctx.engineNames.some((name) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(q.query))) errors.push('engine_name')
  if (q.slot === 'category_discovery' && ctx.categoryTerms?.length && !ctx.categoryTerms.some((term) => n.includes(normalize(term)))) warnings.push('category_missing')
  if (q.language === 'en') { const actual = classifyQueryIntent(q.query); if (actual !== 'other' && actual !== intentForSlotForWarning(q)) warnings.push('slot_mismatch') }
  return { passed: !errors.length, errors, warnings }
}
function intentForSlotForWarning(q: GeneratedQuery) { const map: Record<QuerySlot, string> = { category_discovery: 'category_discovery', problem_need: 'problem', comparison_alternatives: q.intent_choice === 'alternatives' ? 'alternatives' : 'comparison', icp_use_case: 'use_case', trust_or_pricing: q.intent_choice === 'pricing' ? 'pricing' : 'trust', local_or_second_decision: q.intent_choice === 'use_case' ? 'use_case' : 'local' }; return map[q.slot] }
