import type { GeoEvidence, GeoQueryAnalysis, GeoQueryIntent } from '../schemas'

export const DEFAULT_PAID_QUERY_INTENT_PLAN = [
  'category/discovery',
  'problem/need',
  'comparison or alternatives',
  'ICP/use case',
  'trust or pricing, whichever fits the business',
  'local if geography is material; otherwise a second decision/use-case question',
] as const

const INTENT_ORDER: GeoQueryIntent[] = [
  'category_discovery',
  'comparison',
  'alternatives',
  'problem',
  'local',
  'trust',
  'pricing',
  'use_case',
  'other',
]

function round(n: number): number {
  return Math.round(n * 10) / 10
}

function rate(n: number, total: number): number {
  return total > 0 ? round((n / total) * 100) : 0
}

/**
 * Conservative, deterministic taxonomy for an already-selected buyer query.
 * Specific commercial intents win over broad discovery/problem wording.
 */
export function classifyQueryIntent(query: string): GeoQueryIntent {
  const q = query.toLowerCase().replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim()

  if (/\b(alternatives?|substitutes?|instead of|similar to)\b/.test(q)) return 'alternatives'
  if (/\b(vs\.?|versus|compare|comparison|difference between|better than)\b/.test(q)) return 'comparison'
  if (/\b(price|pricing|cost|costs|how much|budget|affordable|cheap(?:er|est)?|quote)\b/.test(q)) return 'pricing'
  if (/\b(near me|nearby|local(?:ly)?|in my area|closest|service area)\b/.test(q)) return 'local'
  if (/\b(review|reviews|rating|ratings|rated|reliable|trusted|trustworthy|reputable|certified|licensed|insured|safe|proof)\b/.test(q)) return 'trust'
  if (/\b(use cases?|suited for|works? for|designed for|best for|(?:software|service|services|tool|tools|platform|provider|agency) for)\b/.test(q)) return 'use_case'
  if (/^(?:how|why|what should|where can|can i|help me|need to)\b|\b(solve|fix|improve|handle|choose)\b/.test(q)) return 'problem'
  if (/\b(best|top|recommend|recommendation|who should|which [a-z0-9 -]{0,30}(?:company|service|provider|vendor|platform|tool|agency))\b/.test(q)) {
    return 'category_discovery'
  }
  return 'other'
}

export function attachQueryIntents(evidence: GeoEvidence[]): GeoEvidence[] {
  return evidence.map((item) => ({
    ...item,
    query_intent: item.query_intent || classifyQueryIntent(item.query),
  }))
}

export function buildQueryAnalysis(evidenceInput: GeoEvidence[]): GeoQueryAnalysis {
  const evidence = attachQueryIntents(evidenceInput)
  const queries = new Map<string, GeoQueryIntent>()
  for (const item of evidence) queries.set(item.query, item.query_intent || 'other')

  const coverage = INTENT_ORDER.map((intent) => {
    const rows = evidence.filter((item) => item.query_intent === intent)
    const queryCount = [...queries.values()].filter((value) => value === intent).length
    const mentioned = rows.filter((item) => item.brand_mentioned).length
    const cited = rows.filter((item) => item.brand_cited).length
    return {
      intent,
      query_count: queryCount,
      successful_combinations: rows.length,
      mentioned_combinations: mentioned,
      cited_combinations: cited,
      mention_rate: rate(mentioned, rows.length),
      citation_rate: rate(cited, rows.length),
    }
  }).filter((item) => item.query_count > 0)

  return {
    taxonomy_version: 'v1',
    queries: [...queries.entries()].map(([query, intent]) => ({ query, intent })),
    coverage,
  }
}

export function queryIntentLabel(intent: GeoQueryIntent): string {
  return ({
    category_discovery: 'Category discovery',
    comparison: 'Comparison',
    alternatives: 'Alternatives',
    problem: 'Problem / need',
    local: 'Local',
    trust: 'Trust / risk',
    pricing: 'Pricing',
    use_case: 'Use case',
    other: 'Other',
  } as const)[intent]
}
