export type CostProvider = 'anthropic' | 'openai' | 'perplexity' | 'firecrawl'

export type CostEvent = {
  provider: CostProvider
  purpose: string
  model?: string
  input_tokens?: number
  output_tokens?: number
  cache_read_tokens?: number
  cache_creation_tokens?: number
  web_searches?: number
  scrape_count?: number
  cost_usd?: number
}

export type CostEventWithEstimate = CostEvent & {
  cost_usd: number
  estimated: boolean
}

export type CostBreakdown = {
  total_usd: number
  by_provider: Record<string, number>
  by_purpose: Record<string, number>
  events: CostEventWithEstimate[]
}

type TokenPricing = {
  input_per_million: number
  output_per_million: number
}

// Conservative defaults for internal cost visibility only. Keep exact billing
// decisions in Stripe/accounting systems, and override these via env if needed.
const TOKEN_PRICING: Array<{ match: RegExp; pricing: TokenPricing }> = [
  { match: /haiku/i, pricing: { input_per_million: 0.8, output_per_million: 4 } },
  { match: /sonnet/i, pricing: { input_per_million: 3, output_per_million: 15 } },
  { match: /gpt-4o/i, pricing: { input_per_million: 2.5, output_per_million: 10 } },
  { match: /sonar/i, pricing: { input_per_million: 1, output_per_million: 1 } },
]

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

function roundUsd(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000
}

function pricingFor(model?: string): TokenPricing | null {
  if (!model) return null
  const overrideInput = envNumber(`${model.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_INPUT_USD_PER_MTOK`, -1)
  const overrideOutput = envNumber(`${model.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_OUTPUT_USD_PER_MTOK`, -1)
  if (overrideInput >= 0 && overrideOutput >= 0) {
    return { input_per_million: overrideInput, output_per_million: overrideOutput }
  }
  return TOKEN_PRICING.find((p) => p.match.test(model))?.pricing ?? null
}

export function estimateCostUsd(event: CostEvent): number {
  if (typeof event.cost_usd === 'number' && Number.isFinite(event.cost_usd)) {
    return Math.max(0, event.cost_usd)
  }

  let total = 0
  const pricing = pricingFor(event.model)
  if (pricing) {
    total += ((event.input_tokens ?? 0) / 1_000_000) * pricing.input_per_million
    total += ((event.output_tokens ?? 0) / 1_000_000) * pricing.output_per_million
  }

  if (event.provider === 'anthropic') {
    total += (event.web_searches ?? 0) * envNumber('ANTHROPIC_WEB_SEARCH_USD_PER_USE', 0)
  }

  if (event.provider === 'firecrawl') {
    total += (event.scrape_count ?? 1) * envNumber('FIRECRAWL_USD_PER_SCRAPE', 0)
  }

  return roundUsd(total)
}

export class CostTracker {
  private events: CostEventWithEstimate[] = []

  add(event: CostEvent): void {
    const cost = estimateCostUsd(event)
    this.events.push({
      ...event,
      cost_usd: cost,
      estimated: typeof event.cost_usd !== 'number',
    })
  }

  addFirecrawlScrape(purpose: string, scrapeCount = 1): void {
    this.add({ provider: 'firecrawl', purpose, scrape_count: scrapeCount })
  }

  totalUsd(): number {
    return roundUsd(this.events.reduce((sum, e) => sum + e.cost_usd, 0))
  }

  breakdown(): CostBreakdown {
    const byProvider: Record<string, number> = {}
    const byPurpose: Record<string, number> = {}
    for (const event of this.events) {
      byProvider[event.provider] = roundUsd((byProvider[event.provider] ?? 0) + event.cost_usd)
      byPurpose[event.purpose] = roundUsd((byPurpose[event.purpose] ?? 0) + event.cost_usd)
    }
    return {
      total_usd: this.totalUsd(),
      by_provider: byProvider,
      by_purpose: byPurpose,
      events: [...this.events],
    }
  }
}

export function anthropicUsageEvent(args: {
  model: string
  purpose: string
  usage: unknown
}): CostEvent {
  const usage = (args.usage ?? {}) as Record<string, unknown>
  const serverToolUse = (usage.server_tool_use ?? {}) as Record<string, unknown>
  const webSearches = Number(serverToolUse.web_search_requests ?? 0)
  return {
    provider: 'anthropic',
    model: args.model,
    purpose: args.purpose,
    input_tokens: Number(usage.input_tokens ?? 0),
    output_tokens: Number(usage.output_tokens ?? 0),
    cache_read_tokens: Number(usage.cache_read_input_tokens ?? 0),
    cache_creation_tokens: Number(usage.cache_creation_input_tokens ?? 0),
    web_searches: Number.isFinite(webSearches) ? webSearches : 0,
  }
}
