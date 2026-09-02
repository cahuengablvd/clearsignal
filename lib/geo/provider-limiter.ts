import type { EngineId } from './engines'

// Conservative initial operational defaults; not a claim of scientific optimality.
const DEFAULT_CONCURRENCY: Record<EngineId, number> = { claude: 3, perplexity: 2, openai: 3 }

function configured(engine: EngineId): number {
  const name = `GEO_PROVIDER_CONCURRENCY_${engine.toUpperCase()}`
  const value = Number(process.env[name])
  return Number.isInteger(value) && value > 0 ? Math.min(value, 10) : DEFAULT_CONCURRENCY[engine]
}

export function providerConcurrency(engine: EngineId): number { return configured(engine) }

/** A per-scan, per-provider queue; independent providers retain parallelism. */
export function createProviderLimiter() {
  const active: Record<EngineId, number> = { claude: 0, perplexity: 0, openai: 0 }
  const queues: Record<EngineId, Array<() => void>> = { claude: [], perplexity: [], openai: [] }
  const runNext = (engine: EngineId) => {
    if (active[engine] >= configured(engine)) return
    const next = queues[engine].shift()
    if (next) next()
  }
  return async function limit<T>(engine: EngineId, task: () => Promise<T>): Promise<T> {
    await new Promise<void>((resolve) => {
      const start = () => { active[engine]++; console.info(`[geo-provider] provider=${engine} concurrency=${configured(engine)} active=${active[engine]}`); resolve() }
      if (active[engine] < configured(engine)) start(); else queues[engine].push(start)
    })
    try { return await task() }
    finally { active[engine]--; runNext(engine) }
  }
}
