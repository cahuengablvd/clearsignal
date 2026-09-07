import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ callClaudeJSON: vi.fn(), queryEngine: vi.fn() }))
vi.mock('../lib/anthropic', () => ({ callClaudeJSON: mocks.callClaudeJSON }))
vi.mock('../lib/geo/engines', () => ({ availableEngines: () => ['claude'], queryEngine: mocks.queryEngine }))

import { runGeoScan } from '../lib/geo'
import { recomputeReusedGeoEvidence } from '../lib/audit-runner'
import { GeoResultSchema } from '../lib/schemas'
import type { GeoEvidence, GeoResult } from '../lib/schemas'

const retentionMeasurement = ({ brand_mentioned, brand_position, competitors_mentioned, entity_observations, evidence_completeness, measured_text_length, truncated_at, absence_observation }: GeoEvidence) => ({
  brand_mentioned, brand_position, competitors_mentioned, entity_observations, evidence_completeness, measured_text_length, truncated_at, absence_observation,
})
function expectStoredRecomputeParity(fresh: GeoResult) {
  const stored = JSON.parse(JSON.stringify(fresh)) as GeoResult
  mocks.queryEngine.mockClear()
  mocks.callClaudeJSON.mockClear()
  const recomputed = recomputeReusedGeoEvidence(stored)
  expect(recomputed.evidence.map(retentionMeasurement)).toEqual(fresh.evidence.map(retentionMeasurement))
  expect(mocks.queryEngine).not.toHaveBeenCalled()
  expect(mocks.callClaudeJSON).not.toHaveBeenCalled()
}

const longAnswer = (n: number) => 'Target is an appropriate option. '.repeat(n)
const base = { engine: 'claude', ok: true, attempts: 1, citations: ['https://target.example/page'], tool_events: { search_requests: 1, search_results: 1, tool_errors: [], protocol: 'claude_web_search' as const }, retrieved_urls: ['https://retrieved.example'], cited_urls: ['https://target.example/page'], citation_attachment: 'resolved' as const, engine_issued_queries: ['provider query'], stop_reason: 'end_turn', raw_response_sha256: 'a'.repeat(64), started_at: '2026-09-02T10:00:00.000Z', finished_at: '2026-09-02T10:00:01.000Z' }

describe('RD-00 persisted GEO capture', () => {
  beforeEach(() => { mocks.callClaudeJSON.mockReset(); mocks.queryEngine.mockReset(); mocks.callClaudeJSON.mockResolvedValue({ competitors: [] }); mocks.queryEngine.mockResolvedValue({ ...base, answer: longAnswer(300) }) })
  afterEach(() => { delete process.env.GEO_PROVIDER_CONCURRENCY_CLAUDE })

  it('stores the larger measurement text and acquisition fields without changing legacy citations', async () => {
    const result = await runGeoScan({ brand: 'Target', url: 'https://target.example', providedQueries: ['best option'], engines: ['claude'], analyzeSources: false, narrative: false })
    const evidence = result.evidence[0]!
    expect(evidence.answer_text?.length).toBeGreaterThan(6000)
    expect(evidence.truncated_at).toBeNull()
    expect(evidence.citations).toEqual(['https://target.example/page'])
    expect(evidence).toMatchObject({ retrieved_urls: ['https://retrieved.example'], cited_urls: ['https://target.example/page'], engine_issued_queries: ['provider query'], observed_at: '2026-09-02T10:00:01.000Z', started_at: '2026-09-02T10:00:00.000Z', finished_at: '2026-09-02T10:00:01.000Z' })
    expect(result.acquisition_protocol).toMatchObject({ version: 'rd-00', user_location: null, samples_per_combination: 1 })
  })

  it('marks only application storage truncation at the defensive ceiling', async () => {
    mocks.queryEngine.mockResolvedValue({ ...base, answer: longAnswer(900), stop_reason: 'max_tokens' })
    const result = await runGeoScan({ brand: 'Target', url: 'https://target.example', providedQueries: ['best option'], engines: ['claude'], analyzeSources: false, narrative: false })
    expect(result.evidence[0]).toMatchObject({ truncated_at: 24000, stop_reason: 'max_tokens', evidence_completeness: 'storage_censored', measured_text_length: 24000 })
    expect(result.evidence[0]!.answer_text).toHaveLength(24000)
  })

  it('records storage truncation even when the provider completed its turn', async () => {
    mocks.queryEngine.mockResolvedValue({ ...base, answer: longAnswer(900), stop_reason: 'end_turn' })
    const result = await runGeoScan({ brand: 'Target', url: 'https://target.example', providedQueries: ['best option'], engines: ['claude'], analyzeSources: false, narrative: false })
    expect(result.evidence[0]).toMatchObject({ truncated_at: 24000, stop_reason: 'end_turn', evidence_completeness: 'storage_censored' })
  })

  it('does not label a provider token stop as storage truncation when the stored text fits', async () => {
    mocks.queryEngine.mockResolvedValue({ ...base, answer: longAnswer(300), stop_reason: 'max_tokens' })
    const result = await runGeoScan({ brand: 'Target', url: 'https://target.example', providedQueries: ['best option'], engines: ['claude'], analyzeSources: false, narrative: false })
    expect(result.evidence[0]).toMatchObject({ truncated_at: null, stop_reason: 'max_tokens', evidence_completeness: 'complete', measured_text_length: result.evidence[0]!.answer_text!.length })
  })

  it('measures and retains only the shared ceiling, excluding late evidence', async () => {
    const answer = 'x'.repeat(24000) + ' Target and Late Rival are mentioned here.'
    mocks.queryEngine.mockResolvedValue({ ...base, answer, stop_reason: 'end_turn' })
    const result = await runGeoScan({ brand: 'Target', url: 'https://target.example', providedQueries: ['best option'], engines: ['claude'], analyzeSources: false, narrative: false })
    expect(result.evidence[0]).toMatchObject({ brand_mentioned: false, competitors_mentioned: [], evidence_completeness: 'storage_censored', measured_text_length: 24000, truncated_at: 24000, absence_observation: 'censored' })
    expect(result.acquisition_protocol?.measurement_text_limit).toBe(24000)
    expectStoredRecomputeParity(result)
  })

  it('counts a mention just inside the ceiling when the total response fits', async () => {
    const answer = 'x'.repeat(23980) + ' Target'
    mocks.queryEngine.mockResolvedValue({ ...base, answer, stop_reason: 'end_turn' })
    const result = await runGeoScan({ brand: 'Target', url: 'https://target.example', providedQueries: ['best option'], engines: ['claude'], analyzeSources: false, narrative: false })
    expect(result.evidence[0]).toMatchObject({ brand_mentioned: true, evidence_completeness: 'complete', truncated_at: null, measured_text_length: answer.length })
    expectStoredRecomputeParity(result)
  })

  it('keeps an inside-ceiling positive censored when the full response exceeds the ceiling', async () => {
    const answer = 'Target is mentioned first. ' + 'x'.repeat(24000)
    mocks.queryEngine.mockResolvedValue({ ...base, answer, stop_reason: 'end_turn' })
    const result = await runGeoScan({ brand: 'Target', url: 'https://target.example', providedQueries: ['best option'], engines: ['claude'], analyzeSources: false, narrative: false })
    expect(result.evidence[0]).toMatchObject({ brand_mentioned: true, evidence_completeness: 'storage_censored', truncated_at: 24000 })
    expect(result.evidence[0]!.evidence_completeness).not.toBe('complete')
    expectStoredRecomputeParity(result)
  })

  it('validates an n=1 report with eighteen retained 24k answers', async () => {
    const answer = 'x'.repeat(24000)
    mocks.queryEngine.mockResolvedValue({ ...base, answer, stop_reason: 'end_turn' })
    const result = await runGeoScan({ brand: 'Target', url: 'https://target.example', providedQueries: ['best option'], engines: ['claude'], analyzeSources: false, narrative: false })
    const expanded = { ...result, evidence: Array.from({ length: 18 }, (_, index) => ({ ...result.evidence[0]!, evidence_id: `GEO-QUERY-${String(index + 1).padStart(3, '0')}` })) }
    expect(GeoResultSchema.safeParse(expanded).success).toBe(true)
  })

  it('derives the aggregate observation window from the row timestamps', async () => {
    mocks.queryEngine
      .mockResolvedValueOnce({ ...base, answer: longAnswer(300), started_at: '2026-09-02T09:59:00.000Z', finished_at: '2026-09-02T10:01:00.000Z' })
      .mockResolvedValueOnce({ ...base, answer: longAnswer(300), started_at: '2026-09-02T10:02:00.000Z', finished_at: '2026-09-02T10:04:00.000Z' })
    const result = await runGeoScan({ brand: 'Target', url: 'https://target.example', providedQueries: ['first option', 'second option'], engines: ['claude'], analyzeSources: false, narrative: false })
    expect(result).toMatchObject({ observed_at: '2026-09-02T09:59:00.000Z', observed_until: '2026-09-02T10:04:00.000Z' })
  })

  it('keeps concurrency out of the acquisition protocol and records it as operational metadata', async () => {
    process.env.GEO_PROVIDER_CONCURRENCY_CLAUDE = '1'
    const first = await runGeoScan({ brand: 'Target', url: 'https://target.example', providedQueries: ['best option'], engines: ['claude'], analyzeSources: false, narrative: false })
    process.env.GEO_PROVIDER_CONCURRENCY_CLAUDE = '4'
    const second = await runGeoScan({ brand: 'Target', url: 'https://target.example', providedQueries: ['best option'], engines: ['claude'], analyzeSources: false, narrative: false })
    expect(second.acquisition_protocol).toEqual(first.acquisition_protocol)
    expect(first.acquisition_operational).toEqual({ provider_concurrency: [{ engine: 'claude', concurrency: 1 }] })
    expect(second.acquisition_operational).toEqual({ provider_concurrency: [{ engine: 'claude', concurrency: 4 }] })
  })

  it('accepts legacy evidence with none of the new optional fields', () => {
    expect(GeoResultSchema.safeParse({ brand: 'Target', brand_domain: 'target.example', queries_tested: 1, engines_tested: [], ai_visibility_score: 0, mention_rate: 0, citation_rate: null, share_of_voice: 0, avg_position: null, score_breakdown: { mention_rate: 0, citation_rate: 0, position_score: 0, share_of_voice: 0, weights: { mention: 0, citation: 0, position: 0, share_of_voice: 0 } }, evidence: [{ engine: 'claude', query: 'q', answer_excerpt: 'answer', citations: [], brand_mentioned: false, brand_cited: false, brand_position: null, competitors_mentioned: [], cited_domains: [] }], competitor_visibility: [], cited_domains_ranked: [], missing_signals: [], recommendations: [], summary: 'legacy' }).success).toBe(true)
  })
})
