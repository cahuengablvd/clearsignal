import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ callClaudeJSON: vi.fn(), queryEngine: vi.fn() }))
vi.mock('../lib/anthropic', () => ({ callClaudeJSON: mocks.callClaudeJSON }))
vi.mock('../lib/geo/engines', () => ({ availableEngines: () => ['openai'], queryEngine: mocks.queryEngine }))
vi.mock('../lib/supabase', () => ({ supabaseAdmin: {} }))

import { recomputeReusedGeoEvidence } from '../lib/audit-runner'
import { runGeoScan } from '../lib/geo'
import { validateReport } from '../lib/report-validator'
import type { ClearSignalReport, GeoResult } from '../lib/schemas'

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
const loadReport = (name: 'rozie' | 'az-moving'): ClearSignalReport & { geo: GeoResult } =>
  JSON.parse(readFileSync(join(process.cwd(), `tests/fixtures/golden-report-${name}.json`), 'utf8'))

const response = (answer: string) => ({
  ok: true,
  answer: `${answer} `.repeat(8),
  citations: [],
  attempts: 1,
  citation_attachment: 'resolved' as const,
  cited_urls: [],
  retrieved_urls: [],
  retrieval_capture: 'resolved' as const,
  retrieved_meta: [],
  engine_issued_queries: [],
  stop_reason: 'end_turn',
})

function projection(geo: GeoResult) {
  return {
    channels_observed: geo.channels_observed,
    entity_resolution: geo.entity_resolution?.entities,
    entity_observations: geo.evidence.map((row) => row.entity_observations),
    competitors_mentioned: geo.evidence.map((row) => row.competitors_mentioned),
    competitor_visibility: geo.competitor_visibility,
    brand_position: geo.evidence.map((row) => row.brand_position),
    share_of_voice: geo.share_of_voice,
    avg_position: geo.avg_position,
    ai_visibility_score: geo.ai_visibility_score,
    unavailable_reason: geo.score_breakdown.unavailable_reason,
  }
}

function persistedRecomputes(geo: GeoResult, opts: { explicitCompetitors?: string[] } = {}) {
  const once = recomputeReusedGeoEvidence(clone(geo), opts)
  const twice = recomputeReusedGeoEvidence(clone(once), opts)
  const thrice = recomputeReusedGeoEvidence(clone(twice), opts)
  return { once, twice, thrice }
}

async function freshOperatorParity(queryCount: number) {
  const operator = 'https://url-rival.test/pricing'
  mocks.queryEngine.mockResolvedValue(response(`${operator} appears before Target in this comparison.`))
  const fresh = await runGeoScan({
    brand: 'Target', url: 'https://target.example', competitors: [operator],
    providedQueries: Array.from({ length: queryCount }, (_, index) => `buyer question ${index + 1}`),
    engines: ['openai'], discoverCompetitors: false, analyzeSources: false, narrative: false,
  })
  mocks.queryEngine.mockClear()
  const reuse = recomputeReusedGeoEvidence(clone(fresh), { explicitCompetitors: [operator] })
  expect(mocks.queryEngine).not.toHaveBeenCalled()
  expect(mocks.callClaudeJSON).not.toHaveBeenCalled()
  return { fresh, reuse }
}

beforeEach(() => {
  mocks.queryEngine.mockReset()
  mocks.callClaudeJSON.mockReset()
})

afterEach(() => {
  mocks.queryEngine.mockReset()
  mocks.callClaudeJSON.mockReset()
})

describe('PC-2 candidate lineage across stored-evidence recompute', () => {
  it('preserves a fresh discovered channel through three persisted zero-call recomputes', async () => {
    mocks.queryEngine.mockResolvedValue(response('Target has a Facebook page with current details.'))
    mocks.callClaudeJSON.mockResolvedValue({ candidates: [{ name: 'Facebook', role_guess: 'channel_or_directory', quote: 'Facebook', answer_index: 0 }] })
    const fresh = await runGeoScan({
      brand: 'Target', url: 'https://target.example', providedQueries: ['buyer question'], engines: ['openai'],
      discoverCompetitors: true, analyzeSources: false, narrative: false,
    })
    expect(fresh.channels_observed?.map((channel) => channel.name)).toEqual(['Facebook'])
    expect(fresh.entity_resolution?.entities.find((entity) => entity.display_name === 'Facebook')).toMatchObject({
      role: 'channel_or_directory', state: 'channel',
    })

    mocks.queryEngine.mockClear()
    mocks.callClaudeJSON.mockClear()
    const { once, twice, thrice } = persistedRecomputes(fresh)
    expect(mocks.queryEngine).not.toHaveBeenCalled()
    expect(mocks.callClaudeJSON).not.toHaveBeenCalled()
    expect(projection(twice)).toEqual(projection(once))
    expect(projection(thrice)).toEqual(projection(once))
    expect(once.channels_observed?.map((channel) => channel.name)).toEqual(['Facebook'])
    expect(once.competitor_visibility).toEqual([])
    expect(once.evidence[0]?.entity_observations?.[0]).toMatchObject({ entity_id: 'entity-facebook', role: 'channel_or_directory' })
    const report = loadReport('rozie')
    expect(validateReport({ ...report, geo: once }).errors.filter((error) => error.startsWith('a3:'))).toEqual([])
  })

  it.each(['rozie', 'az-moving'] as const)('keeps the %s golden stable from recompute 1 through 3', (golden) => {
    const { once, twice, thrice } = persistedRecomputes(loadReport(golden).geo)
    expect(projection(twice)).toEqual(projection(once))
    expect(projection(thrice)).toEqual(projection(once))
    expect(validateReport({ ...loadReport(golden), geo: thrice }).errors.filter((error) => error.startsWith('a3:'))).toEqual([])
  })

  it('re-seeds accepted, unconfirmed, and rejected inventory without treating stored state as authority', async () => {
    mocks.queryEngine.mockResolvedValue(response('Candidate Alpha appears once beside Target.'))
    const fresh = await runGeoScan({
      brand: 'Target', url: 'https://target.example', providedQueries: ['buyer question'], engines: ['openai'],
      discoverCompetitors: false, analyzeSources: false, narrative: false,
    })
    const stored = clone(fresh)
    stored.entity_resolution = {
      version: 'v1',
      entities: [
        { entity_id: 'entity-candidate-alpha', display_name: 'Candidate Alpha', aliases: ['Candidate Alpha'], role: 'competitor', role_source: 'extractor', state: 'accepted', occurrences: 3, distinct_queries: 3, distinct_engines: 1, domain_corroborated: false, operator_provided: false },
        { entity_id: 'entity-candidate-beta', display_name: 'Candidate Beta', aliases: ['Candidate Beta'], role: 'competitor', role_source: 'extractor', state: 'unconfirmed', occurrences: 1, distinct_queries: 1, distinct_engines: 1, domain_corroborated: false, operator_provided: false },
        { entity_id: 'entity-candidate-gamma', display_name: 'Candidate Gamma', aliases: ['Candidate Gamma'], role: 'competitor', role_source: 'extractor', state: 'rejected', occurrences: 0, distinct_queries: 0, distinct_engines: 0, domain_corroborated: false, operator_provided: false },
      ],
    }
    mocks.queryEngine.mockClear()
    const recomputed = recomputeReusedGeoEvidence(stored)
    expect(mocks.queryEngine).not.toHaveBeenCalled()
    expect(recomputed.entity_resolution?.entities.map((entity) => entity.display_name)).toEqual(['Candidate Alpha', 'Candidate Beta', 'Candidate Gamma'])
    expect(recomputed.entity_resolution?.entities.find((entity) => entity.display_name === 'Candidate Alpha')).toMatchObject({ state: 'unconfirmed', operator_provided: false })
    expect(recomputed.entity_resolution?.entities.find((entity) => entity.display_name === 'Candidate Beta')).toMatchObject({ state: 'rejected', state_reason: 'quote_not_found' })
    expect(recomputed.entity_resolution?.entities.find((entity) => entity.display_name === 'Candidate Gamma')).toMatchObject({ state: 'rejected', state_reason: 'quote_not_found' })
    expect(recomputed.competitor_visibility).toEqual([])
  })

  it.each([1, 2, 6])('keeps URL-form operator identity and measurements identical with %i distinct query mention(s)', async (queryCount) => {
    const { fresh, reuse } = await freshOperatorParity(queryCount)
    expect(projection(reuse)).toEqual(projection(fresh))
    expect(reuse.entity_resolution?.entities.find((entity) => entity.display_name === 'https://url-rival.test/pricing')).toMatchObject({
      role: 'competitor', state: 'accepted', operator_provided: true,
    })
  })
})
