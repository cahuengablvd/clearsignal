import { describe, expect, it } from 'vitest'
import { recomputeReusedGeoEvidence } from '../lib/audit-runner'
import type { GeoResult } from '../lib/schemas'

function geo(evidence: Record<string, unknown>[]): GeoResult {
  return {
    brand: 'Target', brand_domain: 'target.example', queries_tested: 1, engines_tested: ['claude', 'perplexity'],
    test_counts: { configured_queries: 1, configured_engines: 2, expected_combinations: 2, successful_combinations: evidence.length, failed_combinations: 0, skipped_combinations: 0 },
    ai_visibility_score: 0, mention_rate: 0, citation_rate: 0, share_of_voice: 0, avg_position: null,
    score_breakdown: { mention_rate: 0, citation_rate: 0, position_score: 0, share_of_voice: 0, weights: { mention: .4, citation: .25, position: .2, share_of_voice: .15 } },
    evidence: evidence as GeoResult['evidence'], competitor_visibility: [], cited_domains_ranked: [], missing_signals: [], recommendations: [], summary: 'saved',
  }
}

function row(overrides: Record<string, unknown> = {}) {
  return { engine: 'claude', query: 'best service', answer_excerpt: 'Target appears here.', answer_text: 'Target appears here.', citations: ['https://retrieved.example/a'], brand_mentioned: false, brand_cited: false, brand_position: null, competitors_mentioned: [], cited_domains: ['retrieved.example'], ...overrides }
}

describe('RD pre-delivery hardening', () => {
  it('does not turn zero accepted competitors into 100% SOV or a renormalized composite', () => {
    const result = recomputeReusedGeoEvidence(geo([row()]))
    expect(result.share_of_voice).toBeNull()
    expect(result.score_breakdown.position_score).toBeNull()
    expect(result.ai_visibility_score).toBeNull()
    expect(result.score_breakdown.unavailable_reason).toMatch(/not renormalized/)
  })

  it('uses resolved cited URLs, excludes unresolved attachment, and keeps retrieval separate', () => {
    const result = recomputeReusedGeoEvidence(geo([
      row({ retrieved_urls: ['https://target.example/page'], cited_urls: ['https://other.example/page'], citation_attachment: 'resolved' }),
      row({ engine: 'perplexity', retrieved_urls: ['https://target.example/page'], cited_urls: null, citation_attachment: 'unresolved', citations: ['https://target.example/page'] }),
    ]))
    expect(result.evidence[0].brand_cited).toBe(false)
    expect(result.evidence[1].citation_evaluable).toBe(false)
    expect(result.citation_rate).toBe(0)
    expect(result.cited_domains_ranked.map((item) => item.domain)).toEqual(['other.example'])
  })

  it('marks legacy citation precision as mixed and retains raw evidence while separating censoring', () => {
    const before = geo([row({ answer_excerpt: 'No match in visible text.', answer_text: 'No match in visible text.', stop_reason: 'max_tokens', truncated_at: null })])
    const raw = JSON.stringify(before.evidence)
    const result = recomputeReusedGeoEvidence(before)
    expect(result.evidence[0].citation_semantics).toBe('mixed_legacy')
    expect(result.evidence[0].absence_observation).toBe('censored')
    expect(JSON.stringify(before.evidence)).toBe(raw)
    expect(result.acquisition_protocol).toBeUndefined()
    expect(result.computation_version).toBe('rd-01-06')
    expect(result.computed_by?.source).toBe('reused')
  })

  it('discloses the actual English-only Saudi measurement frame independently of intake intent', () => {
    const saved = geo([row({ query_id: 'Q1', scope: 'core' })])
    saved.query_plan = { valid_core_slots: 1, review_required: true, primary_language: 'English', markets: ['Saudi Arabia'] }
    saved.query_provenance = [{ query_id: 'Q1', query: 'best service', slot: 'category_discovery', intent: 'category_discovery', language: 'English', language_source: 'intake', geo_scope: 'none', scope: 'core', source: 'generator', rationale: '', validation: { passed: true, errors: [], warnings: [], regenerated: false }, state: 'valid' }]
    const result = recomputeReusedGeoEvidence(saved)
    expect(result.measurement_methodology).toMatchObject({ market: 'Saudi Arabia', languages_tested: ['English'], core_queries: 1, supplemental_queries: 0, samples_per_combination: 1, user_location: null })
  })
})
