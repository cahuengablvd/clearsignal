import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { recomputeReusedGeoEvidence } from '../lib/audit-runner'
import { intentForSlot, QUERY_SLOTS } from '../lib/geo/query-taxonomy'
import { validateReport } from '../lib/report-validator'
import type { ClearSignalReport, GeoResult } from '../lib/schemas'

const load = () => JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/golden-report-rozie.json'), 'utf8')) as ClearSignalReport

function freshReport(): ClearSignalReport {
  const report = load()
  const reused = recomputeReusedGeoEvidence(report.geo as GeoResult)
  const uniqueEvidence = [...new Map(reused.evidence.map((item) => [item.query, item])).values()]
  const provenance = QUERY_SLOTS.map((slot, index) => {
    const query_id = `Q${index + 1}`
    const evidence = uniqueEvidence[index]
    return {
      query_id, query: evidence?.query || `query ${index + 1}`, slot, intent: evidence?.query_intent || intentForSlot(slot), language: 'en', language_source: 'intake' as const,
      market: 'Malta', geo_scope: 'explicit' as const, scope: 'core' as const, source: 'generator' as const, rationale: 'Tests this buyer situation in the selected market.',
      validation: { passed: true, errors: [], warnings: [], regenerated: false }, state: 'valid' as const,
    }
  })
  return { ...report, geo: { ...reused, evidence: reused.evidence.map((item) => {
    const itemProvenance = provenance.find((candidate) => candidate.query === item.query)
    return { ...item, query_id: itemProvenance?.query_id, query_intent: itemProvenance?.intent, scope: 'core' as const }
  }), query_provenance: provenance, query_plan: { valid_core_slots: 6, review_required: false, primary_language: 'en', markets: ['Malta'] } } }
}

function errors(report: ClearSignalReport) { return validateReport(report).errors.filter((error) => error.startsWith('geo_')) }

describe('A4 fresh-report provenance validator', () => {
  it('reconciles successful ledger rows against core provenance only', () => {
    const base = freshReport()
    const geo = base.geo!
    const supplementalIds = ['S1', 'S1', 'S2', 'S2']
    const supplementalEvidence = supplementalIds.map((query_id, index) => ({ ...geo.evidence[index]!, query_id, scope: 'supplemental' as const }))
    const supplementalLedger = supplementalIds.map((query_id, index) => ({ ...geo.ledger![index]!, query_id }))
    const supplementalProvenance = ['S1', 'S2'].map((query_id, index) => ({ ...geo.query_provenance![index]!, query_id, scope: 'supplemental' as const }))
    const report = {
      ...base,
      geo: {
        ...geo,
        evidence: [...geo.evidence, ...supplementalEvidence],
        ledger: [...geo.ledger!, ...supplementalLedger],
        query_provenance: [...geo.query_provenance!, ...supplementalProvenance],
        test_counts: { ...geo.test_counts!, supplemental_expected_combinations: 4, supplemental_successful_combinations: 4 },
      },
    }
    expect(errors(report).join('\n')).not.toMatch(/ledger successful rows/)

    const mismatched = { ...report, geo: { ...report.geo!, ledger: report.geo!.ledger!.map((row, index) => index === 0 ? { ...row, status: 'provider_error' as const } : row) } }
    expect(errors(mismatched).join('\n')).toMatch(/ledger successful rows/)
  })

  it('rejects every malformed fresh A4 provenance relationship', () => {
    const base = freshReport()
    const geo = base.geo!
    const first = geo.evidence[0]!
    const cases: Array<[string, ClearSignalReport, RegExp]> = [
      ['unknown evidence id', { ...base, geo: { ...geo, evidence: [{ ...first, query_id: 'Q99' }, ...geo.evidence.slice(1)] } }, /evidence query_id Q99 has no provenance/],
      ['intent mismatch', { ...base, geo: { ...geo, evidence: [{ ...first, query_intent: first.query_intent === 'other' ? 'problem' : 'other' }, ...geo.evidence.slice(1)] } }, /intent mismatch/],
      ['core points to supplemental', { ...base, geo: { ...geo, query_provenance: geo.query_provenance!.map((item) => item.query_id === first.query_id ? { ...item, scope: 'supplemental' as const } : item) } }, /scope mismatch/],
      ['supplemental points to core', { ...base, geo: { ...geo, evidence: [{ ...first, scope: 'supplemental' as const }, ...geo.evidence.slice(1)] } }, /scope mismatch/],
      ['duplicate core id', { ...base, geo: { ...geo, query_provenance: [{ ...geo.query_provenance![0] }, { ...geo.query_provenance![1], query_id: 'Q1' }, ...geo.query_provenance!.slice(2)] } }, /duplicate core query_id Q1/],
      ['duplicate core slot', { ...base, geo: { ...geo, query_provenance: [{ ...geo.query_provenance![0] }, { ...geo.query_provenance![1], slot: 'category_discovery' }, ...geo.query_provenance!.slice(2)] } }, /duplicate core slot category_discovery/],
      ['supplemental leaks into counts', { ...base, geo: { ...geo, evidence: [{ ...first, scope: 'supplemental' as const }, ...geo.evidence.slice(1)] } }, /core evidence length/],
      ['plan count disagrees', { ...base, geo: { ...geo, query_plan: { ...geo.query_plan!, valid_core_slots: 5 } } }, /valid_core_slots 5 does not equal valid core provenance 6/],
    ]
    for (const [name, report, expected] of cases) expect(errors(report).join('\n'), name).toMatch(expected)
  })
})
