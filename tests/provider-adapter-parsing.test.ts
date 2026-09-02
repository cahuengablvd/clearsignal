import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ create: vi.fn() }))

vi.mock('../lib/ai-observability', () => ({ logAnthropicCall: vi.fn(async () => {}), workerId: () => 'test-worker' }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: (...args: unknown[]) => mocks.create(...args) }
  },
}))

import { queryEngine, rawResponseSha256 } from '../lib/geo/engines'
import { classifyEngineResponse } from '../lib/geo/coverage'

const fixture = (name: string) => JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/provider-responses', name), 'utf8'))
const padded = 'A sufficiently long stand-in answer used only for classification. '.repeat(5)

describe('A1 adapter parsing of the sanitized provider captures', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.PERPLEXITY_API_KEY = 'test-key'
    mocks.create.mockReset()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('parses the Anthropic tool-error capture into tool_events and classifies it as tool_failure', async () => {
    mocks.create.mockResolvedValue({ ...fixture('claude-tool-error.json'), usage: { input_tokens: 1, output_tokens: 1 } })
    const result = await queryEngine('claude', 'q')

    expect(result.ok).toBe(true)
    expect(result.model).toBe('claude-sonnet-4-6')
    expect(result.tool_events).toMatchObject({ protocol: 'claude_web_search', search_requests: 1, search_results: 0, tool_errors: ['too_many_requests'] })
    expect(classifyEngineResponse({ ...result, answer: `${result.answer} ${padded}` }, { engine: 'claude', webSearch: true })).toMatchObject({ status: 'tool_failure', reason: 'too_many_requests' })
  })

  it('parses a Claude answer without any search into a no-search protocol trace', async () => {
    mocks.create.mockResolvedValue({ ...fixture('claude-no-search.json'), usage: { input_tokens: 1, output_tokens: 1 } })
    const result = await queryEngine('claude', 'q')

    expect(result.tool_events).toMatchObject({ protocol: 'claude_web_search', search_requests: 0, search_results: 0, tool_errors: [] })
    expect(classifyEngineResponse({ ...result, answer: `${result.answer} ${padded}` }, { engine: 'claude', webSearch: true }).status).toBe('ok_no_citations')
  })

  it('captures Claude retrieved and text-cited URLs separately from the current tool blocks', async () => {
    mocks.create.mockResolvedValue({ model: 'claude-sonnet-4-6', stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 }, content: [
      { type: 'server_tool_use', name: 'web_search', input: { query: 'buyer research query' } },
      { type: 'web_search_tool_result', content: [{ url: 'https://retrieved.example/page', page_age: '2 days ago' }] },
      { type: 'text', text: padded, citations: [{ url: 'https://cited.example/page' }] },
    ] })
    const result = await queryEngine('claude', 'q')
    expect(result.citations).toEqual(['https://retrieved.example/page', 'https://cited.example/page'])
    expect(result).toMatchObject({ retrieved_urls: ['https://retrieved.example/page'], cited_urls: ['https://cited.example/page'], engine_issued_queries: ['buyer research query'], citation_attachment: 'resolved', stop_reason: 'end_turn' })
    expect(result.retrieved_meta).toEqual([{ url: 'https://retrieved.example/page', page_age: '2 days ago' }])
  })

  it('retries a Claude SDK 429 once and records the second attempt', async () => {
    const rateLimit = Object.assign(new Error('rate limited'), { status: 429 })
    mocks.create.mockRejectedValueOnce(rateLimit).mockResolvedValueOnce({
      model: 'claude-sonnet-4-6', usage: { input_tokens: 1, output_tokens: 1 },
      content: [{ type: 'text', text: padded, citations: [] }],
    })
    const result = await queryEngine('claude', 'q')
    expect(result.ok).toBe(true)
    expect(result.attempts).toBe(2)
    expect(mocks.create).toHaveBeenCalledTimes(2)
  }, 15000)

  it('does not retry a deterministic Claude SDK 400', async () => {
    mocks.create.mockRejectedValue(Object.assign(new Error('bad request'), { status: 400 }))
    const result = await queryEngine('claude', 'q')
    expect(result.ok).toBe(false)
    expect(result.http_status).toBe(400)
    expect(result.attempts).toBe(1)
    expect(mocks.create).toHaveBeenCalledTimes(1)
  })

  it('parses the real OpenAI web_search_call capture: request counted, citation extracted, grounded', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => '', json: async () => fixture('openai-web-search-call.json') })))
    const result = await queryEngine('openai', 'q')

    expect(result.model).toBe('gpt-4o-2024-08-06')
    expect(result.citations).toEqual(['https://sanitized.example/source'])
    expect(result.tool_events).toMatchObject({ protocol: 'openai_web_search_preview', search_requests: 1, tool_errors: [] })
    expect(result).toMatchObject({ cited_urls: ['https://sanitized.example/source'], retrieved_urls: [], engine_issued_queries: ['sanitized generic web-search query'], citation_attachment: 'resolved' })
    expect(classifyEngineResponse({ ...result, answer: padded }, { engine: 'openai', webSearch: true }).status).toBe('ok_grounded')
  })

  it('parses the real Sonar capture as grounded and the no-citation capture as a successful anomaly', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => '', json: async () => fixture('perplexity-ok.json') })))
    const grounded = await queryEngine('perplexity', 'q')
    expect(grounded.model).toBe('sonar')
    expect(grounded.citations).toHaveLength(2)
    expect(grounded).toMatchObject({ retrieved_urls: ['https://sanitized.example/source-a'], cited_urls: null, citation_attachment: 'unresolved', engine_issued_queries: [], stop_reason: 'stop' })
    expect(classifyEngineResponse({ ...grounded, answer: padded }, { engine: 'perplexity', webSearch: true }).status).toBe('ok_grounded')

    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => '', json: async () => fixture('perplexity-no-citations.json') })))
    const anomaly = await queryEngine('perplexity', 'q')
    expect(anomaly.ok).toBe(true)
    expect(anomaly.citations).toHaveLength(0)
    expect(anomaly.cited_urls).toBeNull()
    expect(anomaly.citation_attachment).toBe('unresolved')
    expect(classifyEngineResponse({ ...anomaly, answer: padded }, { engine: 'perplexity', webSearch: true })).toMatchObject({ status: 'ok_no_citations', reason: 'protocol_anomaly_no_citations' })
  })

  it('hashes the same raw response identically and changes when the payload changes', () => {
    expect(rawResponseSha256({ b: 2, a: ['x'] })).toBe(rawResponseSha256({ a: ['x'], b: 2 }))
    expect(rawResponseSha256({ a: 1 })).not.toBe(rawResponseSha256({ a: 2 }))
  })
})
