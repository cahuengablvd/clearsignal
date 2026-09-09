import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ callClaudeJSON: vi.fn(), queryEngine: vi.fn() }))
vi.mock('../lib/anthropic', () => ({ callClaudeJSON: mocks.callClaudeJSON }))
vi.mock('../lib/geo/engines', () => ({ availableEngines: () => ['openai'], queryEngine: mocks.queryEngine }))
vi.mock('../lib/supabase', () => ({ supabaseAdmin: {} }))

import { recomputeReusedGeoEvidence } from '../lib/audit-runner'
import { runGeoScan } from '../lib/geo'
import type { GeoResult } from '../lib/schemas'

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
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
const accepted = (geo: GeoResult) => geo.entity_resolution?.entities
  .filter((entity) => entity.role === 'competitor' && entity.state === 'accepted')
  .map((entity) => ({ entity_id: entity.entity_id, display_name: entity.display_name, state: entity.state }))
  .sort((left, right) => left.entity_id.localeCompare(right.entity_id))

function parityProjection(geo: GeoResult) {
  return {
    accepted: accepted(geo),
    competitors_mentioned: geo.evidence.map((item) => item.competitors_mentioned),
    competitor_visibility: geo.competitor_visibility,
    brand_position: geo.evidence.map((item) => item.brand_position),
    share_of_voice: geo.share_of_voice,
    avg_position: geo.avg_position,
    ai_visibility_score: geo.ai_visibility_score,
    score_breakdown: geo.score_breakdown,
    entity_observations: geo.evidence.map((item) => item.entity_observations),
  }
}

async function freshThenRecompute(competitors: string[]) {
  const fresh = await runGeoScan({
    brand: 'Target',
    url: 'https://target.example',
    competitors,
    providedQueries: ['first buyer question', 'second buyer question'],
    engines: ['openai'],
    discoverCompetitors: false,
    analyzeSources: false,
    narrative: false,
  })
  const freshCalls = mocks.queryEngine.mock.calls.length
  mocks.queryEngine.mockClear()
  mocks.callClaudeJSON.mockClear()
  const recomputed = recomputeReusedGeoEvidence(clone(fresh), { explicitCompetitors: competitors })
  expect(mocks.queryEngine).not.toHaveBeenCalled()
  expect(mocks.callClaudeJSON).not.toHaveBeenCalled()
  expect(freshCalls).toBe(2)
  expect(parityProjection(recomputed)).toEqual(parityProjection(fresh))
  return { fresh, recomputed }
}

beforeEach(() => {
  mocks.queryEngine.mockReset()
  mocks.callClaudeJSON.mockReset()
  mocks.queryEngine.mockResolvedValue(response('al rajhi bank appears before Target in this comparison.'))
})

afterEach(() => {
  mocks.queryEngine.mockReset()
  mocks.callClaudeJSON.mockReset()
})

describe('PC-1 operator competitor identity parity', () => {
  it('keeps a name-form operator competitor identical through fresh storage and repeated zero-call recompute', async () => {
    const { fresh, recomputed } = await freshThenRecompute(['al rajhi bank'])
    expect(accepted(fresh)).toEqual([{ entity_id: 'entity-alrajhibank', display_name: 'al rajhi bank', state: 'accepted' }])
    expect(fresh.evidence.flatMap((item) => item.competitors_mentioned)).toEqual(['al rajhi bank', 'al rajhi bank'])
    const twice = recomputeReusedGeoEvidence(clone(recomputed), { explicitCompetitors: ['al rajhi bank'] })
    expect(parityProjection(twice)).toEqual(parityProjection(recomputed))
    expect(fresh.share_of_voice).toBe(50)
    expect(fresh.avg_position).toBe(2)
  })

  it('preserves the supported domain-form operator competitor path', async () => {
    mocks.queryEngine.mockResolvedValue(response('url-rival.test appears before Target in this comparison.'))
    const { fresh } = await freshThenRecompute(['url-rival.test'])
    expect(accepted(fresh)?.[0]).toMatchObject({ display_name: 'url-rival.test', state: 'accepted' })
    expect(fresh.competitor_visibility).toEqual([{ name: 'url-rival.test', mention_rate: 100 }])
  })

  it('leaves comparison metrics unavailable when an accepted operator competitor is absent from core evidence', async () => {
    mocks.queryEngine.mockResolvedValue(response('Target is listed here without a competing brand.'))
    const { fresh, recomputed } = await freshThenRecompute(['al rajhi bank'])
    expect(accepted(fresh)).toEqual([{ entity_id: 'entity-alrajhibank', display_name: 'al rajhi bank', state: 'accepted' }])
    expect(fresh.evidence.map((item) => item.competitors_mentioned)).toEqual([[], []])
    expect(fresh.competitor_visibility).toEqual([])
    expect(fresh.share_of_voice).toBeNull()
    expect(fresh.avg_position).toBeNull()
    expect(fresh.score_breakdown.position_score).toBeNull()
    expect(fresh.score_breakdown.unavailable_reason).toBe('required comparison or citation component unavailable; weights were not renormalized')
    expect(fresh.ai_visibility_score).toBeNull()
    expect(parityProjection(recomputed)).toEqual(parityProjection(fresh))
  })

  it('keeps URL-form and name-form operator entities distinct when their old SLD lookup keys collide', async () => {
    const urlInput = 'https://url-rival.test/pricing'
    mocks.queryEngine.mockResolvedValue(response(`${urlInput} appears before Target in this comparison.`))
    const { fresh, recomputed } = await freshThenRecompute([urlInput, 'URL Rival'])
    expect(accepted(fresh)).toEqual([
      { entity_id: 'entity-urlrival', display_name: 'URL Rival', state: 'accepted' },
      { entity_id: 'entity-urlrivaltest', display_name: urlInput, state: 'accepted' },
    ])
    expect(fresh.evidence.map((item) => item.competitors_mentioned)).toEqual([[urlInput], [urlInput]])
    expect(fresh.competitor_visibility).toEqual([{ name: urlInput, mention_rate: 100 }])
    expect(parityProjection(recomputed)).toEqual(parityProjection(fresh))
  })

  it('does not surface the audited brand alias as a competitor', async () => {
    mocks.queryEngine.mockResolvedValue(response('Target Group appears in this comparison.'))
    const fresh = await runGeoScan({ brand: 'Target', brandAliases: ['Target Group'], url: 'https://target.example', competitors: ['target group'], providedQueries: ['buyer question'], engines: ['openai'], discoverCompetitors: false, analyzeSources: false, narrative: false })
    expect(fresh.competitor_visibility).toEqual([])
    expect(fresh.evidence[0]?.competitors_mentioned).toEqual([])
  })

  it('keeps similarly named unconfirmed candidates and channels out of accepted competitor status', async () => {
    mocks.queryEngine.mockResolvedValue(response('Al Rajhi Banking and Facebook are mentioned once.'))
    mocks.callClaudeJSON.mockResolvedValue({ competitors: ['Al Rajhi Bank', 'Facebook'] })
    const fresh = await runGeoScan({ brand: 'Target', url: 'https://target.example', providedQueries: ['buyer question'], engines: ['openai'], analyzeSources: false, narrative: false })
    expect(fresh.entity_resolution?.entities.find((entity) => entity.display_name === 'Al Rajhi Bank')).toMatchObject({ state: 'rejected', state_reason: 'quote_not_found' })
    expect(fresh.entity_resolution?.entities.find((entity) => entity.display_name === 'Facebook')).toMatchObject({ role: 'channel_or_directory', state: 'channel' })
    expect(fresh.competitor_visibility).toEqual([])
  })
})
