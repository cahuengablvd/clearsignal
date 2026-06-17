/**
 * GEO / AEO engine - the core differentiator.
 *
 * Pipeline:
 *   1. generate buyer-intent queries for the brand's category
 *   2. ask each configured answer engine (Claude/Perplexity/OpenAI) every query
 *   3. have Claude analyze the raw answers + citations into a structured,
 *      quantitative visibility report (mention rate, share of voice, gaps)
 *
 * This MEASURES whether AI assistants actually surface the brand, rather than
 * heuristically guessing "citation-worthiness" from page text.
 */
import { callClaudeJSON } from '../anthropic'
import { GeoAnalysisSchema, GeoResultSchema, type GeoResult } from '../schemas'
import {
  MODEL_GEO_QUERIES,
  MODEL_GEO_ANALYSIS,
  GEO_QUERIES_SYSTEM,
  geoQueriesUserPrompt,
  GEO_ANALYSIS_SYSTEM,
  geoAnalysisUserPrompt,
} from '../prompts'
import { availableEngines, queryEngine, type EngineId } from './engines'

const QueriesSchema = {
  parse(data: unknown): { queries: string[] } {
    const d = data as { queries?: unknown }
    if (!d || !Array.isArray(d.queries) || d.queries.some((q) => typeof q !== 'string')) {
      throw new Error('Expected { queries: string[] }')
    }
    return { queries: d.queries as string[] }
  },
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export interface RunGeoOptions {
  brand: string
  url: string
  /** What the product does - improves query relevance. Falls back to the brand. */
  category?: string
  icp?: string
  competitors?: string[]
  /** How many buyer-intent queries to test. Free score: 3. Full audit: 6+. */
  queryCount?: number
  /** Limit which engines to use (defaults to all configured). */
  engines?: EngineId[]
}

export async function runGeoScan(opts: RunGeoOptions): Promise<GeoResult> {
  const { brand, url, category = '', icp = '', competitors = [], queryCount = 4 } = opts
  const engines = opts.engines ?? availableEngines()
  const brandDomain = hostname(url)

  // 1. Generate buyer-intent queries.
  const { queries } = await callClaudeJSON<{ queries: string[] }>({
    model: MODEL_GEO_QUERIES,
    system: GEO_QUERIES_SYSTEM,
    user: geoQueriesUserPrompt(brand, category, icp, queryCount),
    validate: (d) => QueriesSchema.parse(d),
    maxTokens: 512,
  })

  // 2. Fan out: every query against every engine, in parallel.
  const jobs = queries.flatMap((query) =>
    engines.map(async (engine) => {
      const res = await queryEngine(engine, query)
      return { engine, query, res }
    })
  )
  const settled = await Promise.all(jobs)
  const rawResults = settled
    .filter((s) => s.res.ok)
    .map((s) => ({
      engine: s.engine,
      query: s.query,
      answer: s.res.answer,
      citations: s.res.citations,
    }))

  // If every engine failed (e.g. no network / all keys bad), return an empty
  // but well-formed result so callers don't crash.
  if (rawResults.length === 0) {
    return {
      brand,
      queries_tested: queries.length,
      engines_tested: engines,
      ai_visibility_score: 0,
      mention_rate: 0,
      share_of_voice: 0,
      per_query: [],
      competitor_visibility: [],
      cited_domains_ranked: [],
      missing_signals: ['Could not reach any AI answer engine to measure visibility.'],
      recommendations: [],
      summary: 'AI visibility could not be measured - no answer engine responded.',
    }
  }

  // 3. Analyze raw answers + citations into a structured report.
  const analysis = await callClaudeJSON({
    model: MODEL_GEO_ANALYSIS,
    system: GEO_ANALYSIS_SYSTEM,
    user: geoAnalysisUserPrompt(brand, brandDomain, competitors, rawResults),
    validate: (d) => GeoAnalysisSchema.parse(d),
    maxTokens: 3072,
  })

  const result = {
    ...analysis,
    // Normalise cited domains to hostnames in case the model returned full URLs.
    cited_domains_ranked: analysis.cited_domains_ranked.map((c) => ({
      domain: hostname(c.domain),
      count: c.count,
    })),
    brand,
    queries_tested: queries.length,
    engines_tested: rawResults.map((r) => r.engine).filter((e, i, a) => a.indexOf(e) === i),
  }

  return GeoResultSchema.parse(result)
}

export { availableEngines } from './engines'
export type { EngineId } from './engines'
