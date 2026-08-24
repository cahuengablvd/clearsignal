import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ callClaudeJSON: vi.fn(), queryEngine: vi.fn() }))

vi.mock('../lib/anthropic', () => ({ callClaudeJSON: mocks.callClaudeJSON }))
vi.mock('../lib/geo/engines', () => ({
  availableEngines: () => ['claude', 'openai', 'perplexity'],
  queryEngine: mocks.queryEngine,
}))

import { runGeoScan } from '../lib/geo'
import { QUERY_SLOTS, intentForSlot } from '../lib/geo/query-taxonomy'
import type { QueryPlan } from '../lib/geo'

const longAnswer = (lead: string) => `${lead} ${'Additional grounded detail sentence. '.repeat(12)}`
const structuredPlan = (supplemental = false): QueryPlan => {
  const core = QUERY_SLOTS.map((slot, index) => ({ query: index < 2 ? 'same buyer question in Riga today' : `buyer question ${index + 1} in Riga today`, slot, language: 'en', market: 'Riga', geo_scope: 'explicit' as const, rationale: 'Tests a buyer situation in the target market.' }))
  const secondary = supplemental ? [{ query: 'secondary buyer question in Riga today', slot: 'category_discovery' as const, language: 'ru', market: 'Riga', geo_scope: 'explicit' as const, rationale: 'Secondary-language probe.' }] : []
  const provenance = [...core.map((item, index) => ({ ...item, query_id: `Q${index + 1}`, intent: intentForSlot(item.slot), language_source: 'intake' as const, scope: 'core' as const, source: 'generator' as const, validation: { passed: true, errors: [], warnings: [], regenerated: false }, state: 'valid' as const })), ...secondary.map((item, index) => ({ ...item, query_id: `S${index + 1}`, intent: intentForSlot(item.slot), language_source: 'intake' as const, scope: 'supplemental' as const, source: 'generator' as const, validation: { passed: true, errors: [], warnings: [], regenerated: false }, state: 'valid' as const }))]
  return { core, supplemental: secondary, provenance, valid_core_slots: 6, review_required: false, primary_language: 'en', markets: ['Riga'] }
}

describe('A1 mixed-status run', () => {
  beforeEach(() => {
    mocks.callClaudeJSON.mockReset()
    mocks.queryEngine.mockReset()
    mocks.callClaudeJSON.mockResolvedValue({ competitors: [] })
    mocks.queryEngine.mockImplementation(async (engine: string) => {
      if (engine === 'claude') {
        return {
          engine, ok: true, attempts: 1,
          answer: longAnswer('Target is a relevant option here.'),
          citations: ['https://target.example/page'],
          tool_events: { search_requests: 1, search_results: 1, tool_errors: [], protocol: 'claude_web_search' },
        }
      }
      if (engine === 'openai') {
        return {
          engine, ok: true, attempts: 1,
          answer: longAnswer('It seems the web search tool is hitting a rate limit, so this reply is based on my training knowledge.'),
          citations: [],
          tool_events: { search_requests: 0, search_results: 0, tool_errors: [], protocol: 'openai_web_search_preview' },
        }
      }
      return { engine, ok: false, answer: '', citations: [], attempts: 1, error: 'perplexity query timed out after 45000ms' }
    })
  })

  it('keeps failed and tool-failure rows out of evidence and denominators, with a consistent ledger', async () => {
    const result = await runGeoScan({
      brand: 'Target',
      url: 'https://target.example',
      providedQueries: ['Which option should I choose?', 'What does a good option cost?'],
      engines: ['claude', 'openai', 'perplexity'],
      analyzeSources: false,
      narrative: false,
    })

    // Evidence = successful samples only.
    expect(result.evidence).toHaveLength(2)
    expect(result.evidence.every((evidence) => evidence.engine === 'claude')).toBe(true)
    expect(result.evidence.every((evidence) => evidence.status === 'ok_grounded')).toBe(true)
    expect(result.evidence.every((evidence) => !evidence.answer_text || evidence.answer_excerpt.length > 0)).toBe(true)

    // Denominators: mentions over successful, citations over grounded.
    expect(result.test_counts?.successful_samples).toBe(2)
    expect(result.test_counts?.grounded_samples).toBe(2)
    expect(result.test_counts?.no_citation_samples).toBe(0)
    expect(result.mention_rate).toBe(100)
    expect(result.citation_rate).toBe(100)

    // Ledger keeps every attempted sample and its diagnostic text; evidence ids only on
    // successful rows.
    expect(result.ledger).toHaveLength(6)
    const statuses = (result.ledger ?? []).map((row) => row.status).sort()
    expect(statuses).toEqual(['ok_grounded', 'ok_grounded', 'timeout', 'timeout', 'tool_failure', 'tool_failure'])
    const toolFailures = (result.ledger ?? []).filter((row) => row.status === 'tool_failure')
    expect(toolFailures.every((row) => Boolean(row.diagnostic_answer_text))).toBe(true)
    expect(toolFailures.every((row) => row.evidence_id === undefined)).toBe(true)

    // Engine coverage and gate agree with the ledger.
    const byEngine = Object.fromEntries((result.engine_coverage ?? []).map((row) => [row.engine, row]))
    expect(byEngine.claude?.successful_samples).toBe(2)
    expect(byEngine.openai?.tool_failure_samples).toBe(2)
    expect(byEngine.perplexity?.timeout_samples).toBe(2)
    expect(result.coverage_gate?.passed).toBe(false)
    expect(result.coverage_gate?.reasons.join(' ')).toMatch(/OpenAI answered 0 of 2 questions/)
    expect(result.summary).toContain('Coverage was insufficient to report an AI visibility index')
  })

  it('produces a failed gate, a full ledger and a null citation rate when every engine fails', async () => {
    mocks.queryEngine.mockImplementation(async (engine: string) => ({ engine, ok: false, answer: '', citations: [], attempts: 2, error: 'HTTP 500: down', http_status: 500 }))

    const result = await runGeoScan({
      brand: 'Target',
      url: 'https://target.example',
      providedQueries: ['Which option should I choose?', 'What does a good option cost?'],
      engines: ['claude', 'openai', 'perplexity'],
      analyzeSources: false,
      narrative: false,
    })

    expect(result.evidence).toHaveLength(0)
    expect(result.ai_visibility_score).toBe(0)
    expect(result.citation_rate).toBeNull()
    expect(result.ledger).toHaveLength(6)
    expect((result.ledger ?? []).every((row) => row.status === 'provider_error')).toBe(true)
    expect(result.coverage_gate?.passed).toBe(false)
    expect(result.coverage_gate?.reasons.length).toBeGreaterThan(0)
    expect(result.summary).toContain('Coverage was insufficient to report an AI visibility index')
    expect(result.summary).not.toMatch(/\/100/)
  })

  it('never stores an empty excerpt for a successful narration-only answer', async () => {
    mocks.queryEngine.mockResolvedValue({
      engine: 'claude', ok: true, attempts: 1,
      answer: longAnswer('Let me compile the available information before presenting the answer.'),
      citations: ['https://source.example'],
      tool_events: { search_requests: 1, search_results: 1, tool_errors: [], protocol: 'claude_web_search' },
    })

    const result = await runGeoScan({
      brand: 'Target',
      url: 'https://target.example',
      providedQueries: ['Which option should I choose?'],
      engines: ['claude'],
      analyzeSources: false,
      narrative: false,
    })

    expect(result.evidence).toHaveLength(1)
    expect(result.evidence[0].answer_text).toBeTruthy()
    expect(result.evidence[0].answer_excerpt).toBeTruthy()
    expect(result.evidence[0].excerpt_offset).toBe(0)
  })

  it('keeps the legacy six-string measurement contract available for the runner rollback', async () => {
    const queries = ['best option nearby', 'solve this need nearby', 'compare options nearby', 'option for families nearby', 'trusted option nearby', 'local option nearby']
    mocks.callClaudeJSON.mockImplementation(async (request: { purpose: string }) => request.purpose === 'geo:query_generation' ? { queries } : { competitors: [] })
    mocks.queryEngine.mockResolvedValue({ engine: 'claude', ok: true, attempts: 1, answer: longAnswer('Target is a relevant option here.'), citations: ['https://target.example/page'], tool_events: { search_requests: 1, search_results: 1, tool_errors: [], protocol: 'claude_web_search' } })

    const result = await runGeoScan({ brand: 'Target', url: 'https://target.example', queryCount: 6, engines: ['claude'], analyzeSources: false, narrative: false })
    expect(mocks.queryEngine).toHaveBeenCalledTimes(6)
    expect(result.ledger).toHaveLength(6)
    expect(result.query_provenance).toHaveLength(6)
    expect(result.query_provenance?.every((item) => item.scope === 'core' && item.source === 'generator')).toBe(true)
    expect(result.supplemental_probes).toEqual([])
  })

  it('keeps duplicate structured query executions attached to their positional provenance', async () => {
    mocks.queryEngine.mockResolvedValue({ engine: 'claude', ok: true, attempts: 1, answer: longAnswer('Target is a relevant option here.'), citations: ['https://target.example/page'], tool_events: { search_requests: 1, search_results: 1, tool_errors: [], protocol: 'claude_web_search' } })
    const result = await runGeoScan({ brand: 'Target', url: 'https://target.example', queryPlan: structuredPlan(), engines: ['claude'], analyzeSources: false, narrative: false })
    expect(result.ledger?.map((row) => row.query_id)).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'])
    expect(result.evidence.map((item) => item.query_id)).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'])
  })

  it('keeps supplemental-only appearances out of all core measurements', async () => {
    mocks.queryEngine.mockImplementation(async (_engine: string, query: string) => ({ engine: 'claude', ok: true, attempts: 1, answer: longAnswer(query.startsWith('secondary') ? 'Target is a relevant option here.' : 'Another provider is a relevant option here.'), citations: query.startsWith('secondary') ? ['https://target.example/page'] : [], tool_events: { search_requests: 1, search_results: 1, tool_errors: [], protocol: 'claude_web_search' } }))
    const result = await runGeoScan({ brand: 'Target', url: 'https://target.example', queryPlan: structuredPlan(true), engines: ['claude'], analyzeSources: false, narrative: false })
    expect(result.evidence.filter((item) => item.scope === 'supplemental')).toHaveLength(1)
    expect(result.mention_rate).toBe(0)
    expect(result.ai_visibility_score).toBe(0)
    expect(result.share_of_voice).toBe(0)
    expect(result.test_counts).toMatchObject({ successful_combinations: 6, supplemental_successful_combinations: 1 })
    expect(result.engine_coverage?.[0]).toMatchObject({ expected_samples: 6, successful_samples: 6 })
    expect(result.query_analysis?.queries.some((item) => item.query.startsWith('secondary'))).toBe(false)
    expect(result.query_analysis?.coverage.reduce((sum, item) => sum + item.successful_combinations, 0)).toBe(6)
    expect(result.coverage_gate?.passed).toBe(true)
  })
})
