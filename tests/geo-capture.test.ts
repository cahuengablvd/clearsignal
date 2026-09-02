import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ callClaudeJSON: vi.fn(), queryEngine: vi.fn() }))
vi.mock('../lib/anthropic', () => ({ callClaudeJSON: mocks.callClaudeJSON }))
vi.mock('../lib/geo/engines', () => ({ availableEngines: () => ['claude'], queryEngine: mocks.queryEngine }))

import { runGeoScan } from '../lib/geo'
import { GeoResultSchema } from '../lib/schemas'

const longAnswer = (n: number) => 'Target is an appropriate option. '.repeat(n)
const base = { engine: 'claude', ok: true, attempts: 1, citations: ['https://target.example/page'], tool_events: { search_requests: 1, search_results: 1, tool_errors: [], protocol: 'claude_web_search' as const }, retrieved_urls: ['https://retrieved.example'], cited_urls: ['https://target.example/page'], citation_attachment: 'resolved' as const, engine_issued_queries: ['provider query'], stop_reason: 'end_turn', raw_response_sha256: 'a'.repeat(64), started_at: '2026-09-02T10:00:00.000Z', finished_at: '2026-09-02T10:00:01.000Z' }

describe('RD-00 persisted GEO capture', () => {
  beforeEach(() => { mocks.callClaudeJSON.mockReset(); mocks.queryEngine.mockReset(); mocks.callClaudeJSON.mockResolvedValue({ competitors: [] }); mocks.queryEngine.mockResolvedValue({ ...base, answer: longAnswer(300) }) })

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
    expect(result.evidence[0]).toMatchObject({ truncated_at: 24000, stop_reason: 'max_tokens' })
    expect(result.evidence[0]!.answer_text).toHaveLength(24000)
  })

  it('accepts legacy evidence with none of the new optional fields', () => {
    expect(GeoResultSchema.safeParse({ brand: 'Target', brand_domain: 'target.example', queries_tested: 1, engines_tested: [], ai_visibility_score: 0, mention_rate: 0, citation_rate: null, share_of_voice: 0, avg_position: null, score_breakdown: { mention_rate: 0, citation_rate: 0, position_score: 0, share_of_voice: 0, weights: { mention: 0, citation: 0, position: 0, share_of_voice: 0 } }, evidence: [{ engine: 'claude', query: 'q', answer_excerpt: 'answer', citations: [], brand_mentioned: false, brand_cited: false, brand_position: null, competitors_mentioned: [], cited_domains: [] }], competitor_visibility: [], cited_domains_ranked: [], missing_signals: [], recommendations: [], summary: 'legacy' }).success).toBe(true)
  })
})
