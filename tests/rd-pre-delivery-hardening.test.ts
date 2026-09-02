import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { recomputeReusedGeoEvidence, rebuildReusedGeoNarrative } from '../lib/audit-runner'
import { sanitizeGeneratedReportValue } from '../lib/sanitize'
import { validateReport } from '../lib/report-validator'
import type { ClearSignalReport, GeoResult } from '../lib/schemas'

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
    saved.acquisition_protocol = { version: 'rd-00', engines: [{ engine: 'claude', model_requested: 'claude-sonnet-4-6', tool_type_version: 'v1', max_uses: 2, max_tokens: 1500, web_search_mode: 'provider_default' }], user_location: null, samples_per_combination: 1, query_plan_hash: 'a'.repeat(64) }
    const result = recomputeReusedGeoEvidence(saved, { requestedMarketsLanguages: 'Saudi Arabia, Arabic and English' })
    expect(result.measurement_methodology).toMatchObject({ market: 'Saudi Arabia', languages_tested: ['English'], core_queries: 1, supplemental_queries: 0, samples_per_combination: 1, user_location: null })
    expect(result.measurement_methodology?.untested_languages_disclosure).toBe('Only the languages listed above were tested. Arabic buyer questions were not tested in this audit.')
    expect(result.measurement_methodology?.search_mode_disclosure).toContain('not literal consumer ChatGPT UI')
  })

  it('drops stale retrieved-only source analysis and uses citation-evaluable reuse denominators', () => {
    const saved = geo([
      row({ citation_attachment: 'resolved', cited_urls: ['https://cited.example/page'], retrieved_urls: ['https://retrieved-only.example/page'] }),
      ...Array.from({ length: 5 }, () => row({ citation_attachment: 'resolved', cited_urls: ['https://cited.example/page'] })),
      ...Array.from({ length: 6 }, () => row({ engine: 'perplexity', citation_attachment: 'unresolved', cited_urls: null, citations: ['https://retrieved-only.example/page'] })),
    ])
    saved.source_gap_analysis = [{ cited_source: 'retrieved-only.example', signals_found: [], target_missing_signals: [], why_this_source_gets_cited: 'stale', recommended_fix: 'stale' }]
    const result = rebuildReusedGeoNarrative(saved)
    expect(result.source_gap_analysis).toEqual([])
    expect(result.missing_signals.join(' ')).toContain('Among 6 responses where citation attachment could be evaluated')
    expect(result.missing_signals.join(' ')).toContain('6 additional successful responses could not be evaluated')
  })

  it('keeps the reuse citation denominator through sanitize and final validation', () => {
    const saved = geo([
      ...Array.from({ length: 12 }, () => row({ citation_attachment: 'resolved', cited_urls: ['https://other.example/page'] })),
      ...Array.from({ length: 6 }, () => row({ engine: 'perplexity', citation_attachment: 'unresolved', cited_urls: null })),
    ])
    saved.test_counts = { configured_queries: 9, configured_engines: 2, expected_combinations: 18, successful_combinations: 18, failed_combinations: 0, skipped_combinations: 0 }
    const rebuilt = rebuildReusedGeoNarrative(saved)
    const report = JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/golden-report-rozie.json'), 'utf8')) as ClearSignalReport
    report.geo = rebuilt
    const sanitized = sanitizeGeneratedReportValue(report, 0, 18)
    const final = validateReport(sanitized)
    const wording = final.report.geo?.missing_signals.join(' ') || ''
    expect(wording).toContain('Among 12 responses where citation attachment could be evaluated, target.example was cited in 0.')
    expect(wording).toContain('Citation attachment could not be resolved for 6 additional successful responses.')
    expect(wording).not.toContain('not cited in the successfully tested responses')
    expect(final.errors.filter((error) => error.startsWith('geo_'))).toEqual([])
  })

  it('seeds name-form operator competitors on reuse without inventing absent mentions', () => {
    const saved = geo([
      row({ engine: 'claude', answer_text: 'Al Rajhi Bank is an option.', answer_excerpt: 'Al Rajhi Bank is an option.' }),
      row({ engine: 'perplexity', answer_text: 'Riyad Bank is also an option.', answer_excerpt: 'Riyad Bank is also an option.' }),
    ])
    const raw = JSON.stringify(saved.evidence)
    const result = recomputeReusedGeoEvidence(saved, {
      explicitCompetitors: ['Al Rajhi Bank', 'Riyad Bank', 'Saudi Awwal Bank'],
    })
    expect(result.competitor_visibility).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Al Rajhi Bank', mention_rate: 50 }),
      expect.objectContaining({ name: 'Riyad Bank', mention_rate: 50 }),
    ]))
    expect(result.competitor_visibility.map((item) => item.name)).not.toContain('Saudi Awwal Bank')
    expect(result.evidence[0]?.competitors_mentioned).toEqual(['Al Rajhi Bank'])
    expect(result.evidence[1]?.competitors_mentioned).toEqual(['Riyad Bank'])
    expect(JSON.stringify(saved.evidence)).toBe(raw)
  })
})
