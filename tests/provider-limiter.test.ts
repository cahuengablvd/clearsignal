import { afterEach, describe, expect, it } from 'vitest'
import { createProviderLimiter, providerConcurrency } from '../lib/geo/provider-limiter'

describe('RD-05 provider limiter', () => {
  afterEach(() => { delete process.env.GEO_PROVIDER_CONCURRENCY_CLAUDE; delete process.env.GEO_PROVIDER_CONCURRENCY_OPENAI; delete process.env.GEO_PROVIDER_CONCURRENCY_PERPLEXITY })

  it('respects a per-provider maximum while allowing independent providers to run', async () => {
    process.env.GEO_PROVIDER_CONCURRENCY_CLAUDE = '2'
    const limit = createProviderLimiter(); let claudeActive = 0; let claudeMax = 0; let openaiStarted = false
    let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve })
    const claude = Array.from({ length: 4 }, () => limit('claude', async () => { claudeActive++; claudeMax = Math.max(claudeMax, claudeActive); await gate; claudeActive-- }))
    const openai = limit('openai', async () => { openaiStarted = true })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(claudeMax).toBe(2)
    expect(openaiStarted).toBe(true)
    release(); await Promise.all([...claude, openai])
  })

  it('uses conservative configurable defaults and rejects invalid values', () => {
    expect(providerConcurrency('claude')).toBe(3)
    expect(providerConcurrency('openai')).toBe(3)
    expect(providerConcurrency('perplexity')).toBe(2)
    process.env.GEO_PROVIDER_CONCURRENCY_CLAUDE = 'not-a-number'
    expect(providerConcurrency('claude')).toBe(3)
  })
})
