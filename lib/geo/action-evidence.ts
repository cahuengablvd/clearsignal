import {
  GeoActionEvidenceCatalogSchema,
  type ActionBlock,
  type GeoActionEvidenceCatalog,
  type GeoResult,
} from '../schemas'
import { buildQueryAnalysis } from './query-taxonomy'

const STOP_WORDS = new Set([
  'about', 'action', 'answer', 'based', 'content', 'could', 'evidence', 'from',
  'into', 'more', 'page', 'source', 'that', 'their', 'these', 'this', 'with',
])

function ordinalId(prefix: string, index: number): string {
  return `${prefix}-${String(index + 1).padStart(3, '0')}`
}

function intentEvidenceId(intent: string): string {
  return `GEO-INTENT-${intent.replace(/_/g, '-').toUpperCase()}`
}

/** Build the bounded, deterministic GEO facts sent to the action model. */
export function buildGeoActionEvidenceCatalog(geo: GeoResult): GeoActionEvidenceCatalog {
  // The report validator also sees historical/partially stored reports. Treat
  // missing measurement arrays as no catalog evidence instead of throwing.
  const evidence = Array.isArray(geo.evidence)
    ? geo.evidence.filter((item) => typeof item?.query === 'string')
    : []
  const queryAnalysis = geo.query_analysis || buildQueryAnalysis(evidence)
  const competitors = Array.isArray(geo.competitor_visibility) ? geo.competitor_visibility : []
  const citedDomains = Array.isArray(geo.cited_domains_ranked) ? geo.cited_domains_ranked : []
  const sourceGaps = Array.isArray(geo.source_gap_analysis) ? geo.source_gap_analysis : []
  const catalog = {
    query_intent_coverage: queryAnalysis.coverage.map((item) => ({
      evidence_id: intentEvidenceId(item.intent),
      ...item,
    })),
    top_competitors: [...competitors]
      .sort((a, b) => b.mention_rate - a.mention_rate || a.name.localeCompare(b.name))
      .slice(0, 5)
      .map((competitor, index) => ({
        evidence_id: ordinalId('GEO-COMP', index),
        name: competitor.name,
        mention_count: evidence.filter((item) =>
          Array.isArray(item.competitors_mentioned) &&
          item.competitors_mentioned.some((name) => name.toLowerCase() === competitor.name.toLowerCase())
        ).length,
        mention_rate: competitor.mention_rate,
      })),
    cited_domains: citedDomains.slice(0, 8).map((item, index) => ({
      evidence_id: ordinalId('GEO-DOMAIN', index),
      domain: item.domain,
      citation_count: item.count,
    })),
    source_gaps: sourceGaps.slice(0, 6).map((item, index) => ({
      evidence_id: ordinalId('GEO-SOURCE', index),
      cited_source: item.cited_source,
      observed_characteristics: item.signals_found,
      target_missing_signals: item.target_missing_signals,
    })),
  }
  return GeoActionEvidenceCatalogSchema.parse(catalog)
}

type CatalogItem = {
  evidence_id: string
  terms: string[]
}

function catalogItems(catalog: GeoActionEvidenceCatalog): CatalogItem[] {
  return [
    ...catalog.query_intent_coverage.map((item) => ({
      evidence_id: item.evidence_id,
      terms: [item.intent.replace(/_/g, ' ')],
    })),
    ...catalog.top_competitors.map((item) => ({ evidence_id: item.evidence_id, terms: [item.name] })),
    ...catalog.cited_domains.map((item) => ({ evidence_id: item.evidence_id, terms: [item.domain] })),
    ...catalog.source_gaps.map((item) => ({
      evidence_id: item.evidence_id,
      terms: [item.cited_source, ...item.observed_characteristics, ...item.target_missing_signals],
    })),
  ]
}

function meaningfulTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token))
}

function isRelevant(fixText: string, terms: string[]): boolean {
  const normalized = fixText.toLowerCase()
  const fixTokens = new Set(meaningfulTokens(normalized))
  return terms.some((term) => {
    const normalizedTerm = term.toLowerCase().trim()
    if (normalizedTerm.length >= 4 && normalized.includes(normalizedTerm)) return true
    return meaningfulTokens(normalizedTerm).some((token) => fixTokens.has(token))
  })
}

/** Keep only selected IDs that exist in the catalog and match the fix prose. */
export function filterGeoActionEvidenceIds(
  fix: ActionBlock['top_fixes'][number],
  catalog: GeoActionEvidenceCatalog
): string[] {
  const selected = new Set(fix.evidence_ids || [])
  const fixText = [fix.title, fix.description, fix.observed, fix.inferred, fix.recommended]
    .filter(Boolean)
    .join(' ')
  return catalogItems(catalog)
    .filter((item) => selected.has(item.evidence_id) && isRelevant(fixText, item.terms))
    .map((item) => item.evidence_id)
}
