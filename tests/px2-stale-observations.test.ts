import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const providers = vi.hoisted(() => ({ queryEngine: vi.fn(), callClaudeJSON: vi.fn() }))
vi.mock('../lib/geo/engines', () => ({ availableEngines: () => [], queryEngine: providers.queryEngine }))
vi.mock('../lib/anthropic', () => ({ callClaudeJSON: providers.callClaudeJSON }))
vi.mock('../lib/supabase', () => ({ supabaseAdmin: {} }))

import { recomputeReusedGeoEvidence } from '../lib/audit-runner'
import { validateReport } from '../lib/report-validator'
import type { ClearSignalReport, GeoResult } from '../lib/schemas'

const loadReport = (): ClearSignalReport & { geo: GeoResult } => JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/golden-report-rozie.json'), 'utf8'))
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

function storedGeo(answer: string, oldName = 'Old Rival'): GeoResult {
  const geo = loadReport().geo
  geo.evidence = geo.evidence.slice(0, 2).map((row) => ({
    ...row,
    answer_text: answer,
    answer_excerpt: answer,
    evidence_completeness: 'complete' as const,
    measured_text_length: answer.length,
    competitors_mentioned: [oldName],
    entity_observations: [{ entity_id: 'entity-old-rival', name_as_written: oldName, role: 'competitor', span_start: 0, span_end: oldName.length, matched_alias: oldName, text_source: 'answer_text' as const }],
  }))
  geo.competitor_visibility = [{ name: oldName, mention_rate: 100 }]
  return geo
}

function a3Errors(report: ClearSignalReport): string[] {
  return validateReport(clone(report)).errors.filter((error) => error.startsWith('a3:'))
}

afterEach(() => {
  expect(providers.queryEngine).not.toHaveBeenCalled()
  expect(providers.callClaudeJSON).not.toHaveBeenCalled()
})

describe('PX-2 stale entity-observation replacement', () => {
  it('replaces old observations and all competitor-derived fields when recomputation is empty', () => {
    const report = loadReport()
    report.geo = recomputeReusedGeoEvidence(storedGeo('Target has no named alternative.'))
    expect(report.geo.evidence.every((row) => row.entity_observations?.length === 0)).toBe(true)
    expect(report.geo.evidence.every((row) => row.competitors_mentioned.length === 0)).toBe(true)
    expect(report.geo.competitor_visibility).toEqual([])
    expect(report.geo.entity_resolution?.entities.find((entity) => entity.display_name === 'Old Rival')).toMatchObject({ state: 'rejected' })
    expect(report.geo.share_of_voice).toBeNull()
    expect(report.geo.avg_position).toBeNull()
    expect(report.geo.ai_visibility_score).toBeNull()
    expect(a3Errors(report)).toEqual([])
  })

  it('drops an accepted operator competitor when its current input and retained evidence are cleared', () => {
    const initial = recomputeReusedGeoEvidence(storedGeo('Old Rival is an alternative.'), { explicitCompetitors: ['Old Rival'] })
    expect(initial.entity_resolution?.entities.find((entity) => entity.display_name === 'Old Rival')).toMatchObject({ state: 'accepted' })
    const changed = clone(initial)
    changed.evidence = changed.evidence.map((row) => ({ ...row, answer_text: 'Target has no named alternative.', answer_excerpt: 'Target has no named alternative.' }))
    const after = recomputeReusedGeoEvidence(changed, { explicitCompetitors: [] })
    expect(after.evidence.every((row) => row.entity_observations?.length === 0 && row.competitors_mentioned.length === 0)).toBe(true)
    expect(after.competitor_visibility).toEqual([])
    expect(after.share_of_voice).toBeNull()
    expect(after.avg_position).toBeNull()
  })

  it('does not retain a stale observation when the former operator input is URL-form', () => {
    const geo = storedGeo('Target has no named alternative.', 'url-rival.test')
    const after = recomputeReusedGeoEvidence(geo, { explicitCompetitors: ['https://url-rival.test/pricing'] })
    expect(after.evidence.every((row) => row.entity_observations !== undefined)).toBe(true)
    expect(after.evidence.every((row) => row.entity_observations?.length === 0 && row.competitors_mentioned.length === 0)).toBe(true)
    expect(after.competitor_visibility).toEqual([])
  })

  it('replaces empty observations with newly resolved ones, then replaces a different old inventory', () => {
    const empty = storedGeo('New Rival is an alternative.')
    empty.evidence = empty.evidence.map((row) => ({ ...row, competitors_mentioned: [], entity_observations: [] }))
    empty.competitor_visibility = []
    const added = recomputeReusedGeoEvidence(empty, { explicitCompetitors: ['New Rival'] })
    expect(added.evidence.every((row) => row.entity_observations?.[0]?.name_as_written === 'New Rival')).toBe(true)
    expect(added.evidence.every((row) => row.competitors_mentioned.includes('New Rival'))).toBe(true)
    expect(added.competitor_visibility.map((item) => item.name)).toEqual(['New Rival'])

    const replaced = recomputeReusedGeoEvidence(storedGeo('New Rival is an alternative.'), { explicitCompetitors: ['New Rival'] })
    expect(replaced.evidence.every((row) => row.entity_observations?.every((item) => item.name_as_written === 'New Rival'))).toBe(true)
    expect(replaced.evidence.every((row) => row.competitors_mentioned.includes('New Rival'))).toBe(true)
    expect(replaced.competitor_visibility.map((item) => item.name)).toEqual(['New Rival'])
  })

  it('preserves PX-1 not_retained observations and is idempotent for recomputable empty rows', () => {
    const unsafe = storedGeo('Partial retained text')
    unsafe.evidence = unsafe.evidence.map((row) => ({ ...row, measured_text_length: 24000, evidence_completeness: 'storage_censored' as const }))
    const protectedRows = recomputeReusedGeoEvidence(unsafe)
    expect(protectedRows.evidence.every((row) => row.evidence_completeness === 'not_retained' && row.entity_observations?.[0]?.name_as_written === 'Old Rival')).toBe(true)

    const once = recomputeReusedGeoEvidence(storedGeo('Target has no named alternative.'))
    const twice = recomputeReusedGeoEvidence(clone(once))
    expect(twice.evidence.map((row) => row.entity_observations)).toEqual(once.evidence.map((row) => row.entity_observations))
    expect(twice.competitor_visibility).toEqual(once.competitor_visibility)
  })
})
