import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { recomputeReusedGeoEvidence } from '../lib/audit-runner'
import { validateReport } from '../lib/report-validator'
import type { GeoResult } from '../lib/schemas'

const legacy = () => JSON.parse(readFileSync(join(process.cwd(), 'evals/golden/vertex.json'), 'utf8')).geo as GeoResult
const semantics = (geo: GeoResult) => ({
  ledger: geo.ledger?.map(({ query_id, query, engine, status, observed_at }) => ({ query_id, query, engine, status, observed_at })),
  evidence: geo.evidence.map(({ query, query_id, engine, query_intent, answer_text, answer_excerpt, excerpt_offset, status, observed_at }) => ({ query, query_id, engine, query_intent, answer_text, answer_excerpt, excerpt_offset, status, observed_at })),
  counts: geo.test_counts, coverage: geo.engine_coverage, gate: geo.coverage_gate, dates: [geo.observed_at, geo.observed_until],
})

describe('A4 legacy provenance compatibility and reuse parity', () => {
  it('synthesizes explicit minimal provenance without inventing historical claims', () => {
    const before = legacy()
    const after = recomputeReusedGeoEvidence(before)
    expect(after.query_provenance?.every((item) => item.source === 'legacy' && item.language === 'unknown' && !item.market)).toBe(true)
    expect(after.query_provenance?.map((item) => item.query)).toEqual([...new Set(before.evidence.map((item) => item.query))])
    for (const item of after.query_provenance ?? []) expect(item.intent).toBe(before.evidence.find((e) => e.query === item.query)?.query_intent || 'other')
    expect(validateReport({ ...JSON.parse(readFileSync(join(process.cwd(), 'evals/golden/vertex.json'), 'utf8')), geo: after }).errors.filter((e) => e.startsWith('geo_provenance'))).toEqual([])
  })

  it('keeps the golden legacy measurement semantics unchanged when A4 provenance is added', () => {
    const once = recomputeReusedGeoEvidence(legacy())
    const before = semantics(once)
    const after = recomputeReusedGeoEvidence(once)
    expect({ ...semantics(after), gate: { ...after.coverage_gate, evaluated_at: undefined } }).toEqual({ ...before, gate: { ...once.coverage_gate, evaluated_at: undefined } })
    expect(after.query_provenance).toBeDefined()
  })
})
