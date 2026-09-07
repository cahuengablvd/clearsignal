import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const providers = vi.hoisted(() => ({ queryEngine: vi.fn(), callClaudeJSON: vi.fn() }))
vi.mock('../lib/geo/engines', () => ({ availableEngines: () => [], queryEngine: providers.queryEngine }))
vi.mock('../lib/anthropic', () => ({ callClaudeJSON: providers.callClaudeJSON }))
vi.mock('../lib/supabase', () => ({ supabaseAdmin: {} }))

import { recomputeReusedGeoEvidence } from '../lib/audit-runner'
import { validateReport } from '../lib/report-validator'
import type { ClearSignalReport, GeoEvidence, GeoResult } from '../lib/schemas'

const loadReport = (name = 'rozie'): ClearSignalReport & { geo: GeoResult } => JSON.parse(readFileSync(join(process.cwd(), `tests/fixtures/golden-report-${name}.json`), 'utf8'))
const persist = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
const derived = ({ brand_mentioned, brand_position, competitors_mentioned, entity_observations, absence_observation, brand_cited, citation_evaluable, citation_semantics, cited_domains }: GeoEvidence) => ({
  brand_mentioned, brand_position, competitors_mentioned, entity_observations, absence_observation, brand_cited, citation_evaluable, citation_semantics, cited_domains,
})
const measurements = (geo: GeoResult) => ({
  // Legacy entity-observation replacement is the documented pre-existing PX-2
  // issue. Compare deterministic measurements here, not that changing inventory.
  rows: geo.evidence.map((row) => { const { entity_observations, ...values } = derived(row); return values }),
  mention_rate: geo.mention_rate, citation_rate: geo.citation_rate,
  share_of_voice: geo.share_of_voice, avg_position: geo.avg_position, score: geo.ai_visibility_score,
  breakdown: geo.score_breakdown, competitors: geo.competitor_visibility,
})
const retentionValidation = (report: ClearSignalReport) => {
  const validation = validateReport(persist(report))
  return {
    errors: validation.errors.filter((value) => value.startsWith('geo_retention:')),
    warnings: validation.warnings.filter((value) => value.startsWith('geo_retention:')),
  }
}

afterEach(() => {
  expect(providers.queryEngine).not.toHaveBeenCalled()
  expect(providers.callClaudeJSON).not.toHaveBeenCalled()
})

describe('PX-1 stored retention state', () => {
  it.each(['rozie', 'az-moving'])('keeps %s excerpt-only evidence stable through three persisted recomputes', (name) => {
    const report = loadReport(name)
    const indices = report.geo.evidence.flatMap((row, index) => row.answer_text === undefined && row.answer_excerpt ? [index] : [])
    expect(indices.length).toBeGreaterThan(0)
    let geo = report.geo
    let firstMeasurements: ReturnType<typeof measurements> | undefined
    let firstValidation: ReturnType<typeof retentionValidation> | undefined
    for (let pass = 1; pass <= 3; pass++) {
      geo = persist(recomputeReusedGeoEvidence(persist(geo)))
      for (const index of indices) {
        expect(geo.evidence[index], `pass ${pass}, row ${index}`).toMatchObject({ evidence_completeness: 'legacy_excerpt' })
        expect(geo.evidence[index]).not.toHaveProperty('answer_text')
        expect(geo.evidence[index]).not.toHaveProperty('measured_text_length')
      }
      expect(geo.evidence.filter((row) => row.evidence_completeness === 'not_retained')).toEqual([])
      const validation = retentionValidation({ ...report, geo })
      firstMeasurements ??= measurements(geo)
      firstValidation ??= validation
      expect(measurements(geo)).toEqual(firstMeasurements)
      expect(validation).toEqual(firstValidation)
      expect(validation).toEqual({ errors: [], warnings: [] })
    }
  })

  it('does not infer retention failure from a previously backfilled legacy excerpt length', () => {
    const geo = loadReport().geo
    geo.evidence = [{ ...geo.evidence[0]!, answer_text: undefined, evidence_completeness: 'legacy_excerpt', measured_text_length: 698 }]
    for (let pass = 0; pass < 3; pass++) {
      geo.evidence = recomputeReusedGeoEvidence(persist(geo)).evidence
      expect(geo.evidence[0]).toMatchObject({ evidence_completeness: 'legacy_excerpt', measured_text_length: 698 })
    }
  })

  it.each(['complete', 'storage_censored'] as const)('rejects %s without answer_text even without a recorded length (P7)', (state) => {
    const report = loadReport()
    const row: GeoEvidence = {
      ...report.geo.evidence[0]!, evidence_id: 'GEO-QUERY-001', answer_text: undefined, measured_text_length: undefined,
      answer_excerpt: 'No relevant business appears in this surviving excerpt.', evidence_completeness: state,
      brand_mentioned: true, brand_position: 2, competitors_mentioned: ['Stored Rival'], absence_observation: 'not_applicable',
    }
    report.geo.evidence = [row]
    expect(retentionValidation(report).errors).toContain(`geo_retention: GEO-QUERY-001 ${state} row is missing answer_text`)
    for (let pass = 0; pass < 3; pass++) {
      report.geo = persist(recomputeReusedGeoEvidence(persist(report.geo)))
      expect(report.geo.evidence[0]!.evidence_completeness).toBe('not_retained')
      expect(derived(report.geo.evidence[0]!)).toEqual(derived(row))
      expect(report.geo.evidence[0]).not.toHaveProperty('measured_text_length')
      expect(retentionValidation(report).warnings).toContain('geo_retention: GEO-QUERY-001 not_retained; stored deterministic measurements were preserved and not recomputed')
    }
  })

  it.each(['complete', 'storage_censored'] as const)('preserves %s measurements when retained text is shorter than measured text', (state) => {
    const report = loadReport()
    const row: GeoEvidence = {
      ...report.geo.evidence[0]!, evidence_id: 'GEO-QUERY-001', answer_text: 'Partial text without the business.',
      measured_text_length: 24000, evidence_completeness: state, brand_mentioned: true, brand_position: 2,
      competitors_mentioned: ['Stored Rival'], absence_observation: 'not_applicable',
    }
    report.geo.evidence = [row]
    for (let pass = 0; pass < 3; pass++) {
      report.geo = persist(recomputeReusedGeoEvidence(persist(report.geo)))
      expect(report.geo.evidence[0]!.evidence_completeness).toBe('not_retained')
      expect(derived(report.geo.evidence[0]!)).toEqual(derived(row))
      const validation = retentionValidation(report)
      expect(validation.errors).toContain('geo_retention: GEO-QUERY-001 measured_text_length does not equal answer_text.length')
      expect(validation.warnings.some((value) => value.includes('GEO-QUERY-001 not_retained'))).toBe(true)
    }
  })

  it('uses an explicitly retained empty answer instead of falling back to a positive excerpt', () => {
    const geo = loadReport().geo
    geo.evidence = [{ ...geo.evidence[0]!, answer_text: '', answer_excerpt: 'Rozie is mentioned.', evidence_completeness: 'complete', measured_text_length: 0 }]
    expect(recomputeReusedGeoEvidence(geo).evidence[0]).toMatchObject({ brand_mentioned: false, brand_position: null, evidence_completeness: 'complete', measured_text_length: 0 })
  })
})
