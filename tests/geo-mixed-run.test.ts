import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ callClaudeJSON: vi.fn(), queryEngine: vi.fn() }))

vi.mock('../lib/anthropic', () => ({ callClaudeJSON: mocks.callClaudeJSON }))
vi.mock('../lib/geo/engines', () => ({
  availableEngines: () => ['claude', 'openai', 'perplexity'],
  queryEngine: mocks.queryEngine,
}))

import { runGeoScan } from '../lib/geo'

const longAnswer = (lead: string) => `${lead} ${'Additional grounded detail sentence. '.repeat(12)}`

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
})
