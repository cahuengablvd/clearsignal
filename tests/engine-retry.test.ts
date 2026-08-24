import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/ai-observability', () => ({ logAnthropicCall: vi.fn(async () => {}), workerId: () => 'test-worker' }))

import { queryEngine } from '../lib/geo/engines'

const okBody = {
  model: 'sonar',
  choices: [{ message: { content: 'A sufficiently long grounded answer. '.repeat(10) } }],
  citations: ['https://a.example/x'],
}
const response = (status: number) => ({ ok: status < 400, status, text: async () => 'err body', json: async () => okBody })

describe('A1 engine retry (one retry, transient classes only)', () => {
  beforeEach(() => {
    process.env.PERPLEXITY_API_KEY = 'test-key'
    // Deterministic 1s backoff instead of 1-3s jitter.
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('retries once on 429 and succeeds with attempts=2', async () => {
    const calls: number[] = []
    vi.stubGlobal('fetch', vi.fn(async () => { calls.push(1); return calls.length === 1 ? response(429) : response(200) }))
    const result = await queryEngine('perplexity', 'q')
    expect(result.ok).toBe(true)
    expect(result.attempts).toBe(2)
    expect(calls.length).toBe(2)
  }, 15000)

  it('does not retry a deterministic 400', async () => {
    const calls: number[] = []
    vi.stubGlobal('fetch', vi.fn(async () => { calls.push(1); return response(400) }))
    const result = await queryEngine('perplexity', 'q')
    expect(result.ok).toBe(false)
    expect(result.attempts).toBe(1)
    expect(result.http_status).toBe(400)
    expect(calls.length).toBe(1)
  }, 15000)

  it('retries a 503 exactly once, then reports the failure', async () => {
    const calls: number[] = []
    vi.stubGlobal('fetch', vi.fn(async () => { calls.push(1); return response(503) }))
    const result = await queryEngine('perplexity', 'q')
    expect(result.ok).toBe(false)
    expect(result.attempts).toBe(2)
    expect(calls.length).toBe(2)
  }, 15000)

  it('retries once after a timeout-classed failure', async () => {
    const calls: number[] = []
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls.push(1)
      if (calls.length === 1) throw new Error('perplexity query timed out after 45000ms')
      return response(200)
    }))
    const result = await queryEngine('perplexity', 'q')
    expect(result.ok).toBe(true)
    expect(result.attempts).toBe(2)
    expect(calls.length).toBe(2)
  }, 15000)

  it('retries once after a network failure', async () => {
    const calls: number[] = []
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls.push(1)
      if (calls.length === 1) throw new TypeError('fetch failed')
      return response(200)
    }))
    const result = await queryEngine('perplexity', 'q')
    expect(result.ok).toBe(true)
    expect(result.attempts).toBe(2)
    expect(calls.length).toBe(2)
  }, 15000)
})
