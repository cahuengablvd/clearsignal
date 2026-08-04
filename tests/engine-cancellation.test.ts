import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  anthropicCreate: vi.fn(),
  logAnthropicCall: vi.fn(),
  signals: [] as AbortSignal[],
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock {
    messages = { create: mocks.anthropicCreate }
  },
}))

vi.mock('../lib/ai-observability', () => ({
  logAnthropicCall: mocks.logAnthropicCall,
}))

import { callClaudeJSON } from '../lib/anthropic'
import { queryEngine } from '../lib/geo/engines'

function pendingUntilAbort(signal?: AbortSignal): Promise<never> {
  if (!signal) return Promise.reject(new Error('request signal was not provided'))
  mocks.signals.push(signal)
  return new Promise((_, reject) => {
    signal.addEventListener('abort', () => {
      const error = new Error('request aborted')
      error.name = 'AbortError'
      reject(error)
    }, { once: true })
  })
}

describe('engine request cancellation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mocks.signals.length = 0
    mocks.logAnthropicCall.mockResolvedValue(undefined)
    process.env.ANTHROPIC_API_KEY = 'test-key'
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.PERPLEXITY_API_KEY = 'test-key'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('gives Claude web search 90 seconds, then aborts without recording late usage', async () => {
    const onUsage = vi.fn()
    const settled = vi.fn()
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    mocks.anthropicCreate.mockImplementation((_body, options) => pendingUntilAbort(options?.signal))

    const resultPromise = queryEngine('claude', 'buyer question', {
      onUsage,
      meta: { auditId: 'audit-timeout', stage: 'geo_engine:claude' },
    })
    void resultPromise.then(settled)
    await vi.advanceTimersByTimeAsync(45_000)

    expect(mocks.signals).toHaveLength(1)
    expect(mocks.signals[0].aborted).toBe(false)
    expect(settled).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(45_000)
    const result = await resultPromise

    expect(result.ok).toBe(false)
    expect(mocks.signals[0].aborted).toBe(true)
    expect(clearTimeoutSpy).toHaveBeenCalled()
    expect(onUsage).not.toHaveBeenCalled()
    expect(mocks.logAnthropicCall).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: 'succeeded', usage: expect.anything() })
    )

    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(onUsage).not.toHaveBeenCalled()
    expect(mocks.logAnthropicCall).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: 'succeeded', usage: expect.anything() })
    )
  })

  it('clears the timeout immediately when Claude succeeds', async () => {
    mocks.anthropicCreate.mockResolvedValue({
      usage: { input_tokens: 10, output_tokens: 5 },
      content: [{ type: 'text', text: 'Answer', citations: [] }],
    })

    await expect(queryEngine('claude', 'buyer question')).resolves.toEqual(
      expect.objectContaining({ ok: true })
    )
    expect(vi.getTimerCount()).toBe(0)
  })

  it('passes cancellation through callClaudeJSON without logging usage after abort', async () => {
    const controller = new AbortController()
    const onUsage = vi.fn()
    mocks.anthropicCreate.mockImplementation((_body, options) => pendingUntilAbort(options?.signal))

    const request = callClaudeJSON({
      model: 'claude-sonnet-4-6',
      system: 'Return JSON.',
      user: 'Return {"ok":true}.',
      validate: (value) => value,
      signal: controller.signal,
      onUsage,
    })
    await vi.waitFor(() => expect(mocks.signals).toHaveLength(1))
    controller.abort()

    await expect(request).rejects.toThrow(/abort/i)
    expect(onUsage).not.toHaveBeenCalled()
    expect(mocks.logAnthropicCall).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: 'succeeded', usage: expect.anything() })
    )
  })

  it.each(['openai', 'perplexity'] as const)('aborts the %s web-search fetch on the same engine timeout', async (engine) => {
    const onUsage = vi.fn()
    const fetchSignals: AbortSignal[] = []
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined
      if (signal) fetchSignals.push(signal)
      return pendingUntilAbort(signal)
    }))

    const resultPromise = queryEngine(engine, 'buyer question', { onUsage })
    await vi.advanceTimersByTimeAsync(45_000)
    const result = await resultPromise

    expect(result.ok).toBe(false)
    expect(fetchSignals).toHaveLength(1)
    expect(fetchSignals[0].aborted).toBe(true)
    expect(onUsage).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
