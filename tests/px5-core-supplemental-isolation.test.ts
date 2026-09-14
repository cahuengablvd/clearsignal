import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabaseAdmin: {} }))
vi.mock('../lib/anthropic', () => ({ callClaudeJSON: vi.fn() }))

import { recomputeReusedGeoEvidence } from '../lib/audit-runner'
import { validateReport } from '../lib/report-validator'
import type { ClearSignalReport, GeoEvidence, GeoResult, QueryProvenance } from '../lib/schemas'

const load = () => JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/golden-report-rozie.json'), 'utf8')) as ClearSignalReport
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

type FixtureShape = { core: { claude: number; perplexity: number; openai: number }; supplemental: number }
type FixtureOptions = { firstCoreCitationAttachment?: 'resolved' | 'unresolved' | 'unsupported' }

function storedEvidenceFixture(shape: FixtureShape, options: FixtureOptions = {}): ClearSignalReport {
  const report = load()
  const source = report.geo!.evidence[0]!
  const slots = ['category_discovery', 'problem_need', 'comparison_alternatives', 'icp_use_case', 'trust_or_pricing', 'local_or_second_decision'] as const
  const engines = ['claude', 'perplexity', 'openai'] as const
  const coreRows: GeoEvidence[] = []
  const supplementalRows: GeoEvidence[] = []
  const ledger: NonNullable<GeoResult['ledger']> = []
  const provenanceFor = (query_id: string, query: string, slot: typeof slots[number], scope: 'core' | 'supplemental'): QueryProvenance => ({
    query_id, query, slot, intent: 'other', language: 'en', geo_scope: 'none', rationale: '',
    language_source: 'operator', scope, source: 'operator', validation: { passed: true, errors: [], warnings: [], regenerated: false }, state: 'valid',
  })
  const provenance: QueryProvenance[] = slots.map((slot, index) => provenanceFor(`Q${index + 1}`, `core query ${index + 1}`, slot, 'core'))
  const evidenceFor = (query_id: string, engine: typeof engines[number], scope: 'core' | 'supplemental', grounded: boolean): GeoEvidence => ({
    ...clone(source), query_id, query: scope === 'core' ? `core query ${query_id.slice(1)}` : `supplemental query ${query_id}`, query_intent: 'other', scope,
    engine, sample_index: 1, answer_text: `Target appears in ${query_id} for this stored-evidence regression. `.repeat(5),
    answer_excerpt: `Target appears in ${query_id}.`, evidence_completeness: 'complete', measured_text_length: `Target appears in ${query_id} for this stored-evidence regression. `.repeat(5).length,
    citation_attachment: 'resolved', citation_evaluable: true, citations: grounded ? ['https://source.example/article'] : [],
    cited_urls: grounded ? ['https://source.example/article'] : [], cited_domains: grounded ? ['source.example'] : [],
  })
  let coreIndex = 0
  for (const engine of engines) {
    for (let index = 0; index < shape.core[engine]; index++) {
      const query_id = `Q${index + 1}`
      const grounded = coreIndex++ % 2 === 0
      const evidence = evidenceFor(query_id, engine, 'core', grounded)
      if (coreIndex === 1 && options.firstCoreCitationAttachment) {
        evidence.citation_attachment = options.firstCoreCitationAttachment
      }
      coreRows.push(evidence)
      ledger.push({ query_id, query: evidence.query, engine, sample_index: 1, status: grounded ? 'ok_grounded' : 'ok_no_citations', attempts: 1, answer_length: evidence.answer_text!.length, citations_count: evidence.citations.length, observed_at: '2026-09-10T00:00:00.000Z' })
    }
  }
  for (let index = 0; index < 6; index++) {
    provenance.push(provenanceFor(`S${index + 1}`, `supplemental query S${index + 1}`, slots[index], 'supplemental'))
  }
  for (let index = 0; index < shape.supplemental; index++) {
    const query_id = `S${index + 1}`
    const evidence = evidenceFor(query_id, engines[index % engines.length], 'supplemental', true)
    supplementalRows.push(evidence)
    ledger.push({ query_id, query: evidence.query, engine: evidence.engine, sample_index: 1, status: 'ok_grounded', attempts: 1, answer_length: evidence.answer_text!.length, citations_count: 1, observed_at: '2026-09-10T00:00:00.000Z' })
  }
  for (let index = shape.core.perplexity; index < 6; index++) {
    ledger.push({ query_id: `Q${index + 1}`, query: `core query ${index + 1}`, engine: 'perplexity', sample_index: 1, status: 'provider_error', attempts: 1, answer_length: 0, citations_count: 0, observed_at: '2026-09-10T00:00:00.000Z' })
  }
  const coreSuccessful = coreRows.length
  const geo = recomputeReusedGeoEvidence({
    ...report.geo!, brand: 'Target', brand_domain: 'target.example', queries_tested: 6, engines_tested: [...engines], evidence: [...coreRows, ...supplementalRows], ledger,
    query_provenance: provenance, query_plan: { valid_core_slots: 6, review_required: false, primary_language: 'en', markets: [] },
    test_counts: { configured_queries: 6, configured_engines: 3, expected_combinations: 18, successful_combinations: coreSuccessful, failed_combinations: 18 - coreSuccessful, skipped_combinations: 0, supplemental_expected_combinations: shape.supplemental, supplemental_successful_combinations: shape.supplemental },
  } as GeoResult)
  return { ...report, geo }
}

function geoErrors(report: ClearSignalReport) {
  return validateReport(report).errors
}

describe('PX-5 reused core and supplemental population isolation', () => {
  it('keeps 14 core successes separate from 3 supplemental successes', () => {
    const report = storedEvidenceFixture({ core: { claude: 6, perplexity: 2, openai: 6 }, supplemental: 3 })
    const geo = report.geo!
    const coverage = Object.fromEntries(geo.engine_coverage!.map((row) => [row.engine, row.successful_samples]))
    expect(geo.test_counts).toMatchObject({ successful_samples: 14, supplemental_successful_combinations: 3 })
    expect(coverage).toEqual({ claude: 6, perplexity: 2, openai: 6 })
    expect(Object.values(coverage).reduce((total, value) => total + value, 0)).toBe(14)
    expect((geo.test_counts!.grounded_samples ?? 0) + (geo.test_counts!.no_citation_samples ?? 0)).toBe(14)
    expect(geo.evidence.filter((row) => row.scope === 'supplemental')).toHaveLength(3)
    expect(geoErrors(report)).toEqual([])
  })

  it('keeps 13 core successes separate from 5 supplemental successes', () => {
    const report = storedEvidenceFixture({ core: { claude: 6, perplexity: 1, openai: 6 }, supplemental: 5 })
    const geo = report.geo!
    expect(geo.test_counts).toMatchObject({ successful_samples: 13, supplemental_successful_combinations: 5 })
    expect(geo.engine_coverage!.reduce((total, row) => total + row.successful_samples, 0)).toBe(13)
    expect((geo.test_counts!.grounded_samples ?? 0) + (geo.test_counts!.no_citation_samples ?? 0)).toBe(13)
    expect(geo.evidence).toHaveLength(18)
    expect(geoErrors(report)).toEqual([])
  })

  it('keeps unsupported citation attachment orthogonal to successful ledger accounting', () => {
    const report = storedEvidenceFixture(
      { core: { claude: 1, perplexity: 0, openai: 0 }, supplemental: 0 },
      { firstCoreCitationAttachment: 'unsupported' },
    )
    const geo = report.geo!
    expect(geo.ledger![0].status).toBe('ok_grounded')
    expect(geo.evidence[0]).toMatchObject({ citation_attachment: 'unsupported', citation_evaluable: false })
    expect(geo.test_counts).toMatchObject({ successful_samples: 1, grounded_samples: 1, no_citation_samples: 0 })
    expect(geo.citation_rate).toBeNull()
    expect(geo.score_breakdown.citation_rate).toBeNull()
    expect(geoErrors(report)).toEqual([])
  })

  it('rejects successful samples omitted from grounded and no-citation accounting', () => {
    const report = storedEvidenceFixture({ core: { claude: 3, perplexity: 0, openai: 0 }, supplemental: 0 })
    report.geo!.test_counts = { ...report.geo!.test_counts!, grounded_samples: 1, no_citation_samples: 1 }
    expect(geoErrors(report)).toContain('geo_counts: grounded + no_citation does not equal successful samples')
  })
})
