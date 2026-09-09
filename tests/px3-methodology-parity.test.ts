import { describe, expect, it } from 'vitest'
import { recomputeReusedGeoEvidence, rebuildReusedGeoNarrative } from '../lib/audit-runner'
import { buildMeasurementMethodology } from '../lib/geo/methodology'
import type { GeoResult } from '../lib/schemas'

const protocol: NonNullable<GeoResult['acquisition_protocol']> = {
  version: 'rd-00',
  engines: [{ engine: 'claude', model_requested: 'claude-sonnet-4-6', tool_type_version: 'web_search_20260209', max_uses: 2, max_tokens: 1500, web_search_mode: 'provider_default' }],
  user_location: null,
  samples_per_combination: 1,
  query_plan_hash: 'a'.repeat(64),
}

function provenance(language = 'en'): NonNullable<GeoResult['query_provenance']> {
  return [{ query_id: 'Q1', query: 'best service', slot: 'category_discovery', intent: 'category_discovery', language, language_source: 'intake' as const, geo_scope: 'none' as const, scope: 'core' as const, source: 'generator' as const, rationale: '', validation: { passed: true, errors: [], warnings: [], regenerated: false }, state: 'valid' as const }]
}

function evidence() {
  return [{ engine: 'claude', model: 'claude-sonnet-4-6', query: 'best service', query_id: 'Q1', scope: 'core' as const, answer_excerpt: 'Target appears here.', answer_text: 'Target appears here.', citations: [], cited_domains: [], competitors_mentioned: [], brand_mentioned: true, brand_cited: false, brand_position: 1 }]
}

function savedGeo(language = 'en'): GeoResult {
  const rows = evidence()
  return {
    brand: 'Target', brand_domain: 'target.example', queries_tested: 1, engines_tested: ['claude'],
    test_counts: { configured_queries: 1, configured_engines: 1, expected_combinations: 1, successful_combinations: 1, failed_combinations: 0, skipped_combinations: 0 },
    ai_visibility_score: 0, mention_rate: 100, citation_rate: 0, share_of_voice: 0, avg_position: null,
    score_breakdown: { mention_rate: 100, citation_rate: 0, position_score: 0, share_of_voice: 0, weights: { mention: .4, citation: .25, position: .2, share_of_voice: .15 } },
    evidence: rows, competitor_visibility: [], cited_domains_ranked: [], missing_signals: [], recommendations: [], summary: 'saved',
    query_provenance: provenance(language), query_plan: { valid_core_slots: 1, review_required: true, primary_language: language, markets: ['Saudi Arabia'] }, acquisition_protocol: protocol,
  }
}

function freshMethodology(requestedMarketsLanguages?: string, language = 'en') {
  return buildMeasurementMethodology({
    provenance: provenance(language), evidence: evidence(), engines: ['claude'], acquisitionProtocol: protocol,
    requestedMarketsLanguages, executedPlanMarkets: ['Saudi Arabia'],
  })
}

describe('PX-3 methodology disclosure parity', () => {
  it('keeps Arabic requested with English-only measurement identical across fresh, reuse, and rerender', () => {
    const requested = 'Saudi Arabia, Arabic and English'
    const fresh = freshMethodology(requested)
    const reuse = recomputeReusedGeoEvidence(savedGeo(), { requestedMarketsLanguages: requested }).measurement_methodology
    const rerender = rebuildReusedGeoNarrative(savedGeo(), { requestedMarketsLanguages: requested }).measurement_methodology

    expect(reuse).toEqual(fresh)
    expect(rerender).toEqual(fresh)
    expect(fresh).toMatchObject({ languages_tested: ['English'], untested_languages_disclosure: 'Only the languages listed above were tested. Arabic buyer questions were not tested in this audit.' })
    expect(fresh?.search_mode_disclosure).toContain('provider API responses')
  })

  it('does not invent an untested-language disclosure when requested and tested scopes match', () => {
    const fresh = freshMethodology('Saudi Arabia, English')
    const reuse = recomputeReusedGeoEvidence(savedGeo(), { requestedMarketsLanguages: 'Saudi Arabia, English' }).measurement_methodology
    const rerender = rebuildReusedGeoNarrative(savedGeo(), { requestedMarketsLanguages: 'Saudi Arabia, English' }).measurement_methodology

    expect(reuse).toEqual(fresh)
    expect(rerender).toEqual(fresh)
    expect(fresh.untested_languages_disclosure).toBeUndefined()
  })

  it('uses the same honest fallback for legacy input without requested language data', () => {
    const fresh = freshMethodology(undefined)
    const reuse = recomputeReusedGeoEvidence(savedGeo()).measurement_methodology
    const rerender = rebuildReusedGeoNarrative(savedGeo()).measurement_methodology

    expect(reuse).toEqual(fresh)
    expect(rerender).toEqual(fresh)
    expect(fresh.untested_languages_disclosure).toBeUndefined()
  })

  it('is stable across repeated stored-evidence recompute and rerender operations', () => {
    const requested = 'Saudi Arabia, Arabic and English'
    const once = recomputeReusedGeoEvidence(savedGeo(), { requestedMarketsLanguages: requested })
    const twice = recomputeReusedGeoEvidence(once, { requestedMarketsLanguages: requested })
    const rerendered = rebuildReusedGeoNarrative(once, { requestedMarketsLanguages: requested })

    expect(twice.measurement_methodology).toEqual(once.measurement_methodology)
    expect(rerendered.measurement_methodology).toEqual(once.measurement_methodology)
  })
})
