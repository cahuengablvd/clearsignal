import { describe, expect, it } from 'vitest'
import { CostTracker, anthropicUsageEvent, estimateCostUsd } from '../lib/cost-tracker'

describe('cost tracking', () => {
  it('sums explicit cost events by provider and purpose', () => {
    const tracker = new CostTracker()
    tracker.add({ provider: 'anthropic', purpose: 'audit:clarity', cost_usd: 0.25 })
    tracker.add({ provider: 'firecrawl', purpose: 'target_page', cost_usd: 0.05 })
    tracker.add({ provider: 'anthropic', purpose: 'audit:clarity', cost_usd: 0.1 })

    const breakdown = tracker.breakdown()
    expect(breakdown.total_usd).toBe(0.4)
    expect(breakdown.by_provider.anthropic).toBe(0.35)
    expect(breakdown.by_provider.firecrawl).toBe(0.05)
    expect(breakdown.by_purpose['audit:clarity']).toBe(0.35)
  })

  it('estimates token costs from model usage', () => {
    const cost = estimateCostUsd({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      purpose: 'audit:gap',
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    })

    expect(cost).toBe(18)
  })

  it('turns Anthropic usage payloads into cost events', () => {
    const event = anthropicUsageEvent({
      model: 'claude-sonnet-4-6',
      purpose: 'geo:claude',
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        server_tool_use: { web_search_requests: 2 },
      },
    })

    expect(event).toMatchObject({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      purpose: 'geo:claude',
      input_tokens: 100,
      output_tokens: 50,
      web_searches: 2,
    })
  })

  it('keeps unknown model events as zero-cost instead of throwing', () => {
    const tracker = new CostTracker()
    tracker.add({
      provider: 'openai',
      model: 'unknown-model',
      purpose: 'geo:openai',
      input_tokens: 123,
      output_tokens: 456,
    })

    expect(tracker.totalUsd()).toBe(0)
    expect(tracker.breakdown().events[0].estimated).toBe(true)
  })
})
