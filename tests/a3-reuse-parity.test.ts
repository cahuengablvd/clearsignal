import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { recomputeReusedGeoEvidence } from '../lib/audit-runner'
import type { GeoResult } from '../lib/schemas'

const golden = () => JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/golden-report-rozie.json'), 'utf8')).geo as GeoResult
const unaffected = (geo: GeoResult) => ({ ledger: geo.ledger, counts: geo.test_counts, coverage: geo.engine_coverage, gate: { ...geo.coverage_gate, evaluated_at: undefined }, provenance: geo.query_provenance, dates: [geo.observed_at, geo.observed_until], answers: geo.evidence.map(({ answer_text, answer_excerpt, excerpt_offset, query_id, scope }) => ({ answer_text, answer_excerpt, excerpt_offset, query_id, scope })) })

describe('A3 reuse entity parity', () => {
  it('preserves A1/A4 data while resolving only entity data', () => {
    const once = recomputeReusedGeoEvidence(golden())
    const after = recomputeReusedGeoEvidence(once)
    expect(unaffected(after)).toEqual(unaffected(once))
  })
  it('uses answer text first and makes excerpt-only missing candidates unconfirmed', () => {
    const geo = golden()
    geo.evidence = geo.evidence.slice(0, 1).map((item) => ({ ...item, answer_text: undefined, answer_excerpt: 'No candidate in this excerpt.', competitors_mentioned: ['Missing Rival'] }))
    geo.competitor_visibility = [{ name: 'Missing Rival', mention_rate: 100 }]
    const after = recomputeReusedGeoEvidence(geo)
    const entity = after.entity_resolution?.entities.find((item) => item.display_name === 'Missing Rival')
    expect(entity).toMatchObject({ state: 'unconfirmed', state_reason: 'legacy_excerpt_only' })
    expect(after.competitor_visibility.map((item) => item.name)).not.toContain('Missing Rival')
  })
  it('applies bounded entity spans to saved full answers', () => {
    const geo = golden()
    geo.evidence = geo.evidence.slice(0, 2).map((item, index) => ({ ...item, answer_text: index ? 'embarked again' : 'embarked', answer_excerpt: 'embarked', competitors_mentioned: ['Bark'] }))
    geo.competitor_visibility = [{ name: 'Bark', mention_rate: 100 }]
    const after = recomputeReusedGeoEvidence(geo)
    expect(after.entity_resolution?.entities.find((item) => item.display_name === 'Bark')).toMatchObject({ state: 'channel', occurrences: 0 })
    expect(after.competitor_visibility).toEqual([])
  })
})
