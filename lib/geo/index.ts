/**
 * GEO / AEO engine - the credibility core of ClearSignal.
 *
 * Pipeline:
 *   1. generate buyer-intent queries for the brand's category (LLM)
 *   2. ask each configured answer engine every query (Claude/Perplexity/OpenAI)
 *   3. DETERMINISTICALLY detect brand/competitor mentions + citations from the
 *      raw answers (string/domain matching - no LLM judgement)
 *   4. compute a reproducible AI Visibility Score from those facts
 *   5. use the LLM ONLY to explain gaps + recommend fixes + summarize
 *
 * Every number in the result is reproducible from the saved `evidence`.
 */
import { callClaudeJSON } from '../anthropic'
import type { CostEvent } from '../cost-tracker'
import type { AnthropicRequestMeta } from '../ai-observability'
import {
  GeoResultSchema,
  GeoAnalysisSchema,
  type GeoResult,
  type GeoEvidence,
  type GeoTestCounts,
} from '../schemas'
import {
  MODEL_GEO_QUERIES,
  MODEL_GEO_ANALYSIS,
  GEO_QUERIES_SYSTEM,
  geoQueriesUserPrompt,
  GEO_COMPETITORS_SYSTEM,
  geoCompetitorsUserPrompt,
  GEO_ANALYSIS_SYSTEM,
  geoAnalysisUserPrompt,
} from '../prompts'
import { availableEngines, queryEngine, type EngineId } from './engines'
import { analyzeCitedSources } from './sources'
import { buildQueryAnalysis, classifyQueryIntent } from './query-taxonomy'
import { scrapeUrl } from '../firecrawl'
import { normalizeMarkdown } from '../normalize-markdown'
import { boundSampleClaims } from '../sanitize'
import {
  buildVariants,
  textMentions,
  firstMentionIndex,
  citationsInclude,
  citedDomains,
  registrableDomain,
  sld,
} from './detect'

const SCORE_WEIGHTS = { mention: 0.4, citation: 0.25, position: 0.2, share_of_voice: 0.15 }
const ANSWER_EXCERPT_LIMIT = 700

export function formatEngineList(engines: string[]): string {
  const names = engines.map((e) => {
    const normalized = e.toLowerCase()
    if (normalized === 'openai') return 'OpenAI'
    if (normalized === 'perplexity') return 'Perplexity'
    if (normalized === 'claude') return 'Claude'
    return e.charAt(0).toUpperCase() + e.slice(1)
  })
  if (names.length <= 1) return names[0] || 'configured engines'
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function buildGeoSummary(input: {
  brand: string
  test_counts: GeoTestCounts
  mention_rate: number
  citation_rate: number
  ai_visibility_score: number
  mentionedCombinations?: number
  engines?: string[]
  evidenceReused?: boolean
}): string {
  const successful = input.test_counts.successful_combinations
  const mentioned =
    typeof input.mentionedCombinations === 'number'
      ? input.mentionedCombinations
      : Math.round((input.mention_rate / 100) * successful)
  const engineText = input.engines?.length ? ` across ${formatEngineList(input.engines)}` : ''
  const reuseDisclosure = input.evidenceReused
    ? ' AI visibility evidence was reused from the previous completed scan.'
    : ''

  return `${input.brand} was named in ${mentioned} of ${successful} successfully tested engine-query combinations${engineText}. The measured AI visibility score was ${input.ai_visibility_score}/100; mention rate was ${input.mention_rate}% and citation rate was ${input.citation_rate}%.${reuseDisclosure}`
}

function listValidator<T extends string>(key: string) {
  return (data: unknown): Record<string, T[]> => {
    const d = data as Record<string, unknown>
    const arr = d?.[key]
    if (!Array.isArray(arr) || arr.some((x) => typeof x !== 'string')) {
      throw new Error(`Expected { ${key}: string[] }`)
    }
    return { [key]: arr as T[] } as Record<string, T[]>
  }
}

interface Competitor {
  name: string
  variants: { domain: string | null; tokens: string[] }
}

export interface RunGeoOptions {
  brand: string
  url: string
  category?: string
  icp?: string
  competitors?: string[]
  queryCount?: number
  engines?: EngineId[]
  /** Discover rival names from the answers to enrich share-of-voice. */
  discoverCompetitors?: boolean
  /** Scrape the most-cited sources and explain why they get cited vs the target. */
  analyzeSources?: boolean
  /** How many cited sources to analyze when analyzeSources is on. */
  maxSources?: number
  /** Generate LLM narrative. Disable for timeout-sensitive free scans. */
  narrative?: boolean
  /** Use grounded web-search answers. Disable for timeout-sensitive free scans. */
  webSearch?: boolean
  /** Target page markdown (reused to avoid re-scraping). Scraped if omitted. */
  targetMarkdown?: string
  /** Explicit query set (e.g. user-confirmed). Skips query generation when set. */
  providedQueries?: string[]
  /** Optional cost/usage hook for audit-level cost tracking. */
  onUsage?: (event: CostEvent) => void
  /** Structured metadata for Anthropic request attribution. */
  meta?: AnthropicRequestMeta
}

/**
 * Generate the buyer-intent queries for a brand's category. Exposed so the
 * audit confirmation screen can preview (and the operator confirm) the exact
 * set before a paid/comped run spends credits.
 */
export async function generateBuyerQueries(opts: {
  brand: string
  category?: string
  icp?: string
  count: number
  onUsage?: (event: CostEvent) => void
  meta?: AnthropicRequestMeta
}): Promise<string[]> {
  const { queries } = await callClaudeJSON<{ queries: string[] }>({
    model: MODEL_GEO_QUERIES,
    system: GEO_QUERIES_SYSTEM,
    user: geoQueriesUserPrompt(opts.brand, opts.category ?? '', opts.icp ?? '', opts.count),
    validate: (d) => listValidator<string>('queries')(d) as { queries: string[] },
    maxTokens: 512,
    purpose: 'geo:query_generation',
    onUsage: opts.onUsage,
    meta: opts.meta ? { ...opts.meta, stage: 'geo_query_generation' } : undefined,
  })
  return queries
}

export async function runGeoScan(opts: RunGeoOptions): Promise<GeoResult> {
  const {
    brand,
    url,
    category = '',
    icp = '',
    competitors = [],
    queryCount = 4,
    discoverCompetitors = true,
    analyzeSources = false,
    maxSources = 5,
    narrative: includeNarrative = true,
    webSearch = true,
  } = opts
  const engines = opts.engines ?? availableEngines()
  const brandDomain = registrableDomain(url)
  const brandVariants = buildVariants({ name: brand, url })

  // 1. Use the caller-confirmed query set if given (honoring edits, capped at
  // 8 to bound cost), else generate one.
  const queries =
    opts.providedQueries && opts.providedQueries.length > 0
      ? opts.providedQueries.slice(0, 8)
      : await generateBuyerQueries({ brand, category, icp, count: queryCount, onUsage: opts.onUsage, meta: opts.meta })

  // 2. Fan out: every query against every engine, in parallel.
  const settled = await Promise.all(
    queries.flatMap((query) =>
      engines.map(async (engine) => ({
        engine,
        query,
        res: await queryEngine(engine, query, {
          webSearch,
          onUsage: opts.onUsage,
          purpose: `geo:${engine}`,
          meta: opts.meta ? { ...opts.meta, stage: `geo_engine:${engine}` } : undefined,
        }),
      }))
    )
  )
  const testCounts = geoTestCounts(queries.length, engines.length, settled.filter((s) => s.res.ok).length, 0)
  const raw = settled
    .filter((s) => s.res.ok)
    .map((s) => ({ engine: s.engine, query: s.query, answer: s.res.answer, citations: s.res.citations }))
  const enginesTested = [...new Set(raw.map((result) => result.engine))]

  if (raw.length === 0) {
    return emptyResult(brand, brandDomain, queries.length, engines, testCounts)
  }

  // 3. Build the competitor set: user-provided + (optionally) discovered names.
  const competitorList: Competitor[] = competitors
    .filter(Boolean)
    .map((c) => ({ name: prettyName(c), variants: buildVariants({ url: c, name: prettyName(c) }) }))

  if (discoverCompetitors) {
    try {
      const { competitors: discovered } = await callClaudeJSON<{ competitors: string[] }>({
        model: MODEL_GEO_QUERIES,
        system: GEO_COMPETITORS_SYSTEM,
        user: geoCompetitorsUserPrompt(brand, raw.map((r) => ({ query: r.query, answer: r.answer }))),
        validate: (d) => listValidator<string>('competitors')(d) as { competitors: string[] },
        maxTokens: 512,
        purpose: 'geo:competitor_discovery',
        onUsage: opts.onUsage,
        meta: opts.meta ? { ...opts.meta, stage: 'geo_competitor_discovery' } : undefined,
      })
      for (const name of discovered) {
        const key = sld(name) || name.toLowerCase()
        if (!key || key === sld(brandDomain)) continue
        if (competitorList.some((c) => sld(c.name) === key || c.name.toLowerCase() === name.toLowerCase())) continue
        competitorList.push({ name, variants: buildVariants({ name }) })
      }
    } catch (err) {
      console.warn('GEO competitor discovery failed, continuing with provided list:', err)
    }
  }

  // 4. Deterministic detection per (engine, query).
  const evidence: GeoEvidence[] = raw.map((r, i) => {
    const brand_mentioned = textMentions(r.answer, brandVariants.tokens)
    const brand_cited = citationsInclude(r.citations, brandVariants.domain)

    const competitors_mentioned = competitorList
      .filter((c) => textMentions(r.answer, c.variants.tokens))
      .map((c) => c.name)

    // Position: rank brand's first mention vs competitors mentioned in THIS answer.
    let brand_position: number | null = null
    if (brand_mentioned) {
      const brandIdx = firstMentionIndex(r.answer, brandVariants.tokens)
      const competitorIdxs = competitorList
        .map((c) => firstMentionIndex(r.answer, c.variants.tokens))
        .filter((i) => i >= 0)
      brand_position = 1 + competitorIdxs.filter((i) => i < brandIdx).length
    }

    return {
      evidence_id: `GEO-QUERY-${String(i + 1).padStart(3, '0')}`,
      engine: r.engine,
      query: r.query,
      answer_excerpt: truncate(r.answer, ANSWER_EXCERPT_LIMIT),
      citations: r.citations,
      brand_mentioned,
      brand_cited,
      brand_position,
      competitors_mentioned,
      cited_domains: citedDomains(r.citations),
      query_intent: classifyQueryIntent(r.query),
    }
  })

  // 5. Reproducible metrics + score.
  const total = evidence.length
  const brandMentions = evidence.filter((e) => e.brand_mentioned).length
  const brandCitations = evidence.filter((e) => e.brand_cited).length
  const competitorMentionsTotal = evidence.reduce((sum, e) => sum + e.competitors_mentioned.length, 0)

  const mentionPositions = evidence
    .filter((e) => e.brand_position != null)
    .map((e) => e.brand_position as number)
  const avg_position =
    mentionPositions.length > 0
      ? round(mentionPositions.reduce((a, b) => a + b, 0) / mentionPositions.length, 2)
      : null

  // position_score: 1.0 if named first, decaying to 0 by position 6.
  const positionScore01 =
    mentionPositions.length > 0
      ? mentionPositions.reduce((a, p) => a + Math.max(0, 1 - (p - 1) / 5), 0) / mentionPositions.length
      : 0

  const mention_rate = pct(brandMentions, total)
  const citation_rate = pct(brandCitations, total)
  const share_of_voice =
    brandMentions + competitorMentionsTotal > 0
      ? round((brandMentions / (brandMentions + competitorMentionsTotal)) * 100, 1)
      : 0
  const position_score = round(positionScore01 * 100, 1)

  const ai_visibility_score = Math.round(
    100 *
      (SCORE_WEIGHTS.mention * (mention_rate / 100) +
        SCORE_WEIGHTS.citation * (citation_rate / 100) +
        SCORE_WEIGHTS.position * positionScore01 +
        SCORE_WEIGHTS.share_of_voice * (share_of_voice / 100))
  )

  // Competitor visibility (deterministic mention_rate per competitor).
  const competitor_visibility = competitorList
    .map((c) => ({
      name: c.name,
      mention_rate: pct(evidence.filter((e) => textMentions(e.answer_excerpt, c.variants.tokens)).length, total),
    }))
    .filter((c) => c.mention_rate > 0)
    .sort((a, b) => b.mention_rate - a.mention_rate)
    .slice(0, 10)

  // Cited domains ranked by frequency across all answers.
  const domainCounts = new Map<string, number>()
  for (const e of evidence) {
    for (const d of e.cited_domains) domainCounts.set(d, (domainCounts.get(d) || 0) + 1)
  }
  const cited_domains_ranked = [...domainCounts.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // 6. Deterministic summary + optional LLM explanation/recommendations.
  const deterministic = deterministicNarrative({
    brand,
    brandDomain,
    ai_visibility_score,
    test_counts: testCounts,
    mention_rate,
    citation_rate,
    mentionedCombinations: brandMentions,
    engines: enginesTested,
    cited_domains_ranked,
    competitor_visibility,
  })
  let narrative = deterministic
  if (includeNarrative) {
    try {
      const llmNarrative = await callClaudeJSON({
        model: MODEL_GEO_ANALYSIS,
        system: GEO_ANALYSIS_SYSTEM,
        user: geoAnalysisUserPrompt(
          brand,
          brandDomain,
          { ai_visibility_score, mention_rate, citation_rate, share_of_voice },
          evidence.map((e) => ({
            engine: e.engine,
            query: e.query,
            answer: e.answer_excerpt,
            citations: e.citations,
            brand_mentioned: e.brand_mentioned,
            brand_cited: e.brand_cited,
            competitors_mentioned: e.competitors_mentioned,
          })),
          cited_domains_ranked,
          competitor_visibility
        ),
        validate: (d) => GeoAnalysisSchema.parse(d),
        maxTokens: 1536,
        purpose: 'geo:narrative',
        onUsage: opts.onUsage,
        meta: opts.meta ? { ...opts.meta, stage: 'geo_narrative' } : undefined,
      })
      narrative = {
        ...llmNarrative,
        summary: deterministic.summary,
      }
    } catch (err) {
      console.warn('GEO narrative generation failed, returning metrics only:', err)
    }
  }

  // Trust Layer: keep visibility wording bounded to the tested sample.
  narrative.summary = boundSampleClaims(narrative.summary, brandMentions, total)
  narrative.missing_signals = narrative.missing_signals.map((s) => boundSampleClaims(s, brandMentions, total))

  // 7. Evidence-based cited-source analysis (paid audits): why do the sources
  // engines cite win, and what does the target lack vs them?
  let source_gap_analysis = null
  if (analyzeSources) {
    let targetMd = opts.targetMarkdown
    if (!targetMd) {
      const raw = await scrapeUrl(url).catch(() => null)
      opts.onUsage?.({ provider: 'firecrawl', purpose: 'geo:target_scrape', scrape_count: 1 })
      targetMd = raw ? normalizeMarkdown(raw) : ''
    }
    if (targetMd) {
      source_gap_analysis = await analyzeCitedSources({
        brand,
        targetUrl: url,
        targetMarkdown: targetMd,
        evidence,
        maxSources,
        onUsage: opts.onUsage,
        meta: opts.meta ? { ...opts.meta, stage: 'geo_cited_source_analysis' } : undefined,
      })
    }
  }

  const result: GeoResult = {
    brand,
    brand_domain: brandDomain,
    queries_tested: queries.length,
    engines_tested: enginesTested,
    test_counts: testCounts,
    ai_visibility_score,
    mention_rate,
    citation_rate,
    share_of_voice,
    avg_position,
    score_breakdown: {
      mention_rate,
      citation_rate,
      position_score,
      share_of_voice,
      weights: {
        mention: SCORE_WEIGHTS.mention,
        citation: SCORE_WEIGHTS.citation,
        position: SCORE_WEIGHTS.position,
        share_of_voice: SCORE_WEIGHTS.share_of_voice,
      },
    },
    evidence,
    competitor_visibility,
    cited_domains_ranked,
    ...narrative,
    source_gap_analysis,
    query_analysis: buildQueryAnalysis(evidence),
  }

  return GeoResultSchema.parse(result)
}

// --- helpers ---

function pct(n: number, total: number): number {
  return total > 0 ? round((n / total) * 100, 1) : 0
}
function round(n: number, dp: number): number {
  const f = 10 ** dp
  return Math.round(n * f) / f
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n).trimEnd() + '...' : s
}
function prettyName(urlOrName: string): string {
  const s = sld(urlOrName)
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : urlOrName
}

function geoTestCounts(
  configuredQueries: number,
  configuredEngines: number,
  successfulCombinations: number,
  skippedCombinations: number
) {
  const expectedCombinations = configuredQueries * configuredEngines
  const failedCombinations = Math.max(0, expectedCombinations - successfulCombinations - skippedCombinations)
  return {
    configured_queries: configuredQueries,
    configured_engines: configuredEngines,
    expected_combinations: expectedCombinations,
    successful_combinations: successfulCombinations,
    failed_combinations: failedCombinations,
    skipped_combinations: skippedCombinations,
  }
}

function deterministicNarrative({
  brand,
  brandDomain,
  ai_visibility_score,
  test_counts,
  mention_rate,
  citation_rate,
  mentionedCombinations,
  engines,
  cited_domains_ranked,
  competitor_visibility,
}: {
  brand: string
  brandDomain: string
  ai_visibility_score: number
  test_counts: GeoTestCounts
  mention_rate: number
  citation_rate: number
  mentionedCombinations: number
  engines: string[]
  cited_domains_ranked: { domain: string; count: number }[]
  competitor_visibility: { name: string; mention_rate: number }[]
}) {
  const missing_signals: string[] = []
  if (mention_rate < 50) missing_signals.push('Brand is not consistently named in answer-engine recommendations')
  if (citation_rate === 0) missing_signals.push('Target domain is not being cited as a source')
  if (cited_domains_ranked.length > 0) {
    missing_signals.push(`AI answers cite third-party sources such as ${cited_domains_ranked[0].domain}`)
  }
  if (competitor_visibility.length > 0) {
    missing_signals.push(`${competitor_visibility[0].name} appears more prominently in sampled answers`)
  }

  const recommendations = [
    'Create category and comparison pages that answer buyer questions directly',
    'Add concise FAQ sections with clear product-category language',
    'Strengthen proof signals: reviews, case studies, customer logos, and third-party mentions',
    'Publish pages that mention relevant alternatives and explain where the product fits',
  ]

  return {
    missing_signals: missing_signals.slice(0, 4),
    recommendations,
    summary: buildGeoSummary({
      brand,
      test_counts,
      mention_rate,
      citation_rate,
      ai_visibility_score,
      mentionedCombinations,
      engines,
    }),
  }
}

function emptyResult(
  brand: string,
  brandDomain: string,
  queriesTested: number,
  engines: EngineId[],
  testCounts = geoTestCounts(queriesTested, engines.length, 0, 0)
): GeoResult {
  return {
    brand,
    brand_domain: brandDomain,
    queries_tested: queriesTested,
    engines_tested: [],
    test_counts: testCounts,
    ai_visibility_score: 0,
    mention_rate: 0,
    citation_rate: 0,
    share_of_voice: 0,
    avg_position: null,
    score_breakdown: {
      mention_rate: 0,
      citation_rate: 0,
      position_score: 0,
      share_of_voice: 0,
      weights: {
        mention: SCORE_WEIGHTS.mention,
        citation: SCORE_WEIGHTS.citation,
        position: SCORE_WEIGHTS.position,
        share_of_voice: SCORE_WEIGHTS.share_of_voice,
      },
    },
    evidence: [],
    competitor_visibility: [],
    cited_domains_ranked: [],
    missing_signals: ['Could not reach any AI answer engine to measure visibility.'],
    recommendations: [],
    summary: 'AI visibility could not be measured - no answer engine responded.',
  }
}

export { availableEngines } from './engines'
export type { EngineId } from './engines'
