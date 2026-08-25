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
  type QueryProvenance,
  QueryProvenanceSchema,
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
import { ANSWER_TEXT_LIMIT, DIAGNOSTIC_TEXT_LIMIT, SUCCESSFUL_STATUSES, buildEngineCoverage, classifyEngineResponse, deriveExcerpt, evaluateCoverageGate, type LedgerRow } from './coverage'
import { analyzeCitedSources } from './sources'
import { buildQueryAnalysis, classifyQueryIntent, intentForSlot, QUERY_SLOTS, type QuerySlot } from './query-taxonomy'
import { detectLanguage, parseMarketsLanguages } from './language'
import { validateGeneratedQuery, type GeneratedQuery } from './query-validation'
import { sanitizeGeneratedProse } from '../sanitize'
import { scrapeUrl } from '../firecrawl'
import { normalizeMarkdown } from '../normalize-markdown'
import { boundSampleClaims } from '../sanitize'
import { isAnswerEngineCompetitorName } from '../engine-scope'
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

function competitorKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

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
  citation_rate: number | null
  ai_visibility_score: number
  mentionedCombinations?: number
  engines?: string[]
  evidenceReused?: boolean
  coverageGate?: { passed: boolean; reasons: string[] }
}): string {
  const successful = input.test_counts.successful_combinations
  const mentioned =
    typeof input.mentionedCombinations === 'number'
      ? input.mentionedCombinations
      : Math.round((input.mention_rate / 100) * successful)
  const reuseDisclosure = input.evidenceReused
    ? ' AI visibility evidence was reused from the previous completed scan.'
    : ''
  // Failed coverage gate: no index, no pooled percentages - only counts and the
  // deterministic reasons. Every rebuild path (validator, reuse, rerender) must pass
  // the gate through so this text survives to the client report.
  if (input.coverageGate && !input.coverageGate.passed) {
    const reasons = input.coverageGate.reasons.length ? ` ${input.coverageGate.reasons.join('; ')}.` : ''
    return `Coverage was insufficient to report an AI visibility index.${reasons} ${input.brand} was named in ${mentioned} of ${successful} answers received.${reuseDisclosure}`
  }
  const engineText = input.engines?.length ? ` across ${formatEngineList(input.engines)}` : ''
  const citationText = input.citation_rate == null
    ? 'citation rate was not measurable (no grounded answers)'
    : `citation rate was ${input.citation_rate}%`

  return `${input.brand} was named in ${mentioned} of ${successful} successfully tested engine-query combinations${engineText}. The measured AI visibility score was ${input.ai_visibility_score}/100; mention rate was ${input.mention_rate}% and ${citationText}.${reuseDisclosure}`
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
  /** A4 validated plan. It takes precedence over legacy string queries. */
  queryPlan?: QueryPlan
  /** Optional cost/usage hook for audit-level cost tracking. */
  onUsage?: (event: CostEvent) => void
  /** Structured metadata for Anthropic request attribution. */
  meta?: AnthropicRequestMeta
}

export type QueryPlan = { core: GeneratedQuery[]; supplemental: GeneratedQuery[]; provenance: QueryProvenance[]; valid_core_slots: number; review_required: boolean; primary_language: string; markets: string[]; warnings?: string[] }

/** Reject fresh persisted plans that cannot safely carry A4 provenance. */
export function validateSavedQueryPlan(value: unknown): { valid: true; plan: QueryPlan } | { valid: false; reason: string } {
  if (!value || typeof value !== 'object') return { valid: false, reason: 'missing_query_plan' }
  const candidate = value as Partial<QueryPlan>
  if (!Array.isArray(candidate.core) || !Array.isArray(candidate.supplemental) || !Array.isArray(candidate.provenance)) return { valid: false, reason: 'query_plan_shape' }
  const parsed = candidate.provenance.map((item) => QueryProvenanceSchema.safeParse(item))
  if (parsed.some((item) => !item.success)) return { valid: false, reason: 'query_plan_provenance_schema' }
  const provenance = parsed.map((item) => item.data!) as QueryProvenance[]
  const core = provenance.filter((item) => item.scope === 'core')
  if (core.length !== 6 || core.some((item, index) => item.query_id !== `Q${index + 1}` || item.slot !== QUERY_SLOTS[index])) return { valid: false, reason: 'query_plan_core_identity' }
  if (new Set(core.map((item) => item.slot)).size !== 6 || new Set(core.map((item) => item.query_id)).size !== 6) return { valid: false, reason: 'query_plan_duplicate_core' }
  if (provenance.some((item) => item.scope === 'supplemental' && !item.query_id.startsWith('S'))) return { valid: false, reason: 'query_plan_supplemental_identity' }
  if (candidate.core.some((item) => !core.some((provenanceItem) => provenanceItem.query === item.query && provenanceItem.slot === item.slot)) || candidate.supplemental.some((item) => !provenance.some((provenanceItem) => provenanceItem.scope === 'supplemental' && provenanceItem.query === item.query && provenanceItem.slot === item.slot))) return { valid: false, reason: 'query_plan_scope_coherence' }
  const plan: QueryPlan = { core: candidate.core as GeneratedQuery[], supplemental: candidate.supplemental as GeneratedQuery[], provenance, valid_core_slots: candidate.valid_core_slots ?? core.filter((item) => item.state === 'valid').length, review_required: candidate.review_required ?? core.some((item) => item.state !== 'valid'), primary_language: candidate.primary_language || core[0]!.language, markets: candidate.markets || [], warnings: candidate.warnings }
  if (plan.valid_core_slots !== core.filter((item) => item.state === 'valid').length) return { valid: false, reason: 'query_plan_valid_core_slots' }
  return { valid: true, plan }
}

/** Applies explicit admin text edits without disguising them as generator output. */
export function applyOperatorEdits(plan: QueryPlan, queries: string[], ctx: { brandAliases: string[]; markets: string[]; categoryTerms?: string[]; override?: boolean }): { plan: QueryPlan; rejected: boolean } {
  const edited = plan.provenance.map((item) => item.scope !== 'core' ? item : { ...item, query: queries[Number(item.query_id.slice(1)) - 1]?.trim() || item.query })
  const provenance = edited.map((item) => {
    if (item.scope !== 'core') return item
    const original = plan.provenance.find((candidate) => candidate.query_id === item.query_id)!
    if (item.query === original.query) return item
    const generated: GeneratedQuery = { query: item.query, slot: item.slot, intent_choice: item.intent_choice, language: item.language, market: item.market, geo_scope: item.geo_scope, rationale: item.rationale }
    const siblings = edited.filter((candidate) => candidate.scope === 'core' && candidate.query_id !== item.query_id && candidate.state === 'valid').map((candidate) => ({ query: candidate.query, slot: candidate.slot, intent_choice: candidate.intent_choice, language: candidate.language, market: candidate.market, geo_scope: candidate.geo_scope, rationale: candidate.rationale }))
    const validation = validateGeneratedQuery(generated, { brandAliases: ctx.brandAliases, markets: ctx.markets, language: generated.language, engineNames: ['ChatGPT', 'Claude', 'Perplexity', 'OpenAI'], siblings, categoryTerms: ctx.categoryTerms })
    const overridden = !validation.passed && !!ctx.override
    return { ...item, query: item.query, source: 'operator' as const, validation: { ...validation, regenerated: false, ...(overridden ? { overridden_by_operator: true } : {}) }, state: validation.passed || overridden ? 'valid' as const : 'unavailable' as const, ...(validation.passed || overridden ? { unavailable_reason: undefined } : { unavailable_reason: validation.errors.join(',') }) }
  })
  const core = provenance.filter((item) => item.scope === 'core' && item.state === 'valid').map((item) => ({ query: item.query, slot: item.slot, intent_choice: item.intent_choice, language: item.language, market: item.market, geo_scope: item.geo_scope, rationale: item.rationale }))
  const supplemental = provenance.filter((item) => item.scope === 'supplemental' && item.state === 'valid').map((item) => ({ query: item.query, slot: item.slot, intent_choice: item.intent_choice, language: item.language, market: item.market, geo_scope: item.geo_scope, rationale: item.rationale }))
  const valid_core_slots = core.length
  return { plan: { ...plan, core, supplemental, provenance, valid_core_slots, review_required: valid_core_slots < 6 }, rejected: provenance.some((item) => item.source === 'operator' && item.state === 'unavailable') }
}

function structuredValidator(data: unknown): { queries: GeneratedQuery[] } {
  const value = data as { queries?: unknown }
  if (!Array.isArray(value?.queries)) throw new Error('Expected structured queries')
  return { queries: value.queries.map((item) => {
    const q = item as Partial<GeneratedQuery>
    if (!q || typeof q.query !== 'string' || !QUERY_SLOTS.includes(q.slot as QuerySlot) || typeof q.language !== 'string' || typeof q.rationale !== 'string') throw new Error('Invalid structured query')
    return { query: q.query, slot: q.slot as QuerySlot, intent_choice: q.intent_choice, language: q.language, market: q.market, geo_scope: q.geo_scope === 'explicit' || q.geo_scope === 'implicit' || q.geo_scope === 'none' ? q.geo_scope : 'none', rationale: q.rationale }
  }) }
}

export async function generateValidatedQueryPlan(opts: { brand: string; category?: string; icp?: string; targetMarketsLanguages?: string; pageLanguage?: string; brandAliases?: string[]; onUsage?: (event: CostEvent) => void; meta?: AnthropicRequestMeta }): Promise<QueryPlan> {
  const parsed = parseMarketsLanguages(opts.targetMarketsLanguages)
  const primary = parsed.languages[0] || opts.pageLanguage || detectLanguage(`${opts.category || ''} ${opts.icp || ''}`).lang
  const primaryLanguage = primary
  const secondary = parsed.languages[1]
  const warnings = parsed.languages.length > 2 ? ['additional_languages_ignored'] : []
  const coreSlots = QUERY_SLOTS.map((slot) => ({ slot, language: primaryLanguage, scope: 'core' }))
  const supplementalSlots = secondary && Number(process.env.GEO_SECONDARY_PROBES ?? 2) > 0
    ? (['category_discovery', 'trust_or_pricing'] as QuerySlot[]).slice(0, Math.max(0, Math.min(2, Number(process.env.GEO_SECONDARY_PROBES ?? 2)))).map((slot) => ({ slot, language: secondary, scope: 'supplemental' })) : []
  const languageSource = parsed.languages.length ? 'intake' as const : 'page_detected' as const
  const request = async (plan: Array<{ slot: string; language: string; scope: string }>, regenerate?: Array<{ slot: string; language: string; scope: string; errors: string[] }>) => {
    const data = await callClaudeJSON<{ queries: GeneratedQuery[] }>({ model: MODEL_GEO_QUERIES, system: GEO_QUERIES_SYSTEM, user: geoQueriesUserPrompt(opts.brand, opts.category || '', opts.icp || '', plan.length, { primaryLanguage, markets: parsed.markets, plan, brandAliases: opts.brandAliases || [opts.brand], regenerate }), validate: structuredValidator, maxTokens: 900, purpose: 'geo:query_generation', onUsage: opts.onUsage, meta: opts.meta ? { ...opts.meta, stage: regenerate ? 'geo_query_regeneration' : 'geo_query_generation' } : undefined })
    return data.queries
  }
  const requested = [...coreSlots, ...supplementalSlots]
  let generated: GeneratedQuery[] = []
  try { generated = await request(requested) } catch { generated = [] }
  const bySlot = new Map(generated.map((q) => [`${q.slot}:${q.language}`, q]))
  const validations = new Map<string, ReturnType<typeof validateGeneratedQuery>>()
  const validateAll = (items: GeneratedQuery[]) => items.map((q) => { const v = validateGeneratedQuery(q, { brandAliases: opts.brandAliases || [opts.brand], markets: parsed.markets, language: q.language, engineNames: ['ChatGPT', 'Claude', 'Perplexity', 'OpenAI'], siblings: items.filter((x) => x !== q), categoryTerms: (opts.category || '').split(/\W+/).filter((x) => x.length > 3).slice(0, 8) }); validations.set(`${q.slot}:${q.language}`, v); return q })
  validateAll(generated)
  const invalid = requested.filter((wanted) => { const q = bySlot.get(`${wanted.slot}:${wanted.language}`); return !q || !validations.get(`${wanted.slot}:${wanted.language}`)?.passed }).map((wanted) => ({ ...wanted, errors: validations.get(`${wanted.slot}:${wanted.language}`)?.errors || ['missing_slot'] }))
  if (invalid.length) {
    let repaired: GeneratedQuery[] = []
    try { repaired = await request(requested.filter((x) => invalid.some((bad) => bad.slot === x.slot && bad.language === x.language && bad.scope === x.scope)), invalid) } catch { repaired = [] }
    for (const q of repaired) bySlot.set(`${q.slot}:${q.language}`, q)
    generated = [...bySlot.values()]; validations.clear(); validateAll(generated)
  }
  const provenance: QueryProvenance[] = []; const core: GeneratedQuery[] = []; const supplemental: GeneratedQuery[] = []
  for (let i = 0; i < requested.length; i++) {
    const wanted = requested[i]; const q = bySlot.get(`${wanted.slot}:${wanted.language}`); const validation = q ? validations.get(`${wanted.slot}:${wanted.language}`) : undefined
    const scope = wanted.scope as 'core' | 'supplemental'; const query_id = scope === 'core' ? `Q${QUERY_SLOTS.indexOf(wanted.slot as QuerySlot) + 1}` : `S${supplemental.length + 1}`
    const valid = !!q && !!validation?.passed
    const safe = q || { query: '', slot: wanted.slot as QuerySlot, language: wanted.language, geo_scope: 'none' as const, rationale: '' }
    const prov: QueryProvenance = { ...safe, rationale: sanitizeGeneratedProse(safe.rationale).slice(0, 250), query_id, intent: intentForSlot(safe.slot, safe.intent_choice), language_source: languageSource, scope, source: 'generator', validation: { passed: valid, errors: validation?.errors || ['missing_slot'], warnings: validation?.warnings || [], regenerated: invalid.some((x) => x.slot === wanted.slot && x.language === wanted.language && x.scope === wanted.scope) }, state: valid ? 'valid' : 'unavailable', ...(valid ? {} : { unavailable_reason: (validation?.errors || ['missing_slot']).join(',') }), ...(safe.language === 'en' && validation?.warnings.includes('slot_mismatch') ? { slot_mismatch: true } : {}) }
    provenance.push(prov); if (valid) (scope === 'core' ? core : supplemental).push(safe)
  }
  const validCore = core.length
  if (validCore < 4) { const err = new Error('query_plan_insufficient'); ;(err as Error & { deterministic?: boolean }).deterministic = true; throw err }
  return { core, supplemental, provenance, valid_core_slots: validCore, review_required: validCore < 6, primary_language: primaryLanguage, markets: parsed.markets, warnings }
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

  // A4 plan controls IDs, buyer intent and scope. Legacy input gets honest minimal provenance.
  let queryPlan = opts.queryPlan
  // Direct callers retain the legacy string contract. Paid/admin runners construct
  // the validated A4 plan before reaching this scan.
  const legacyQueries = queryPlan ? [] : opts.providedQueries && opts.providedQueries.length > 0
    ? opts.providedQueries.slice(0, 8)
    : await generateBuyerQueries({ brand, category, icp, count: queryCount, onUsage: opts.onUsage, meta: opts.meta })
  const provenance: QueryProvenance[] = queryPlan?.provenance || legacyQueries.map((query, index) => ({ query_id: `Q${index + 1}`, query, slot: QUERY_SLOTS[Math.min(index, 5)], intent: intentForSlot(QUERY_SLOTS[Math.min(index, 5)]), language: detectLanguage(query).lang, language_source: 'legacy' as const, geo_scope: 'none' as const, scope: 'core' as const, source: opts.providedQueries ? 'operator' as const : 'generator' as const, rationale: '', validation: { passed: true, errors: [], warnings: [], regenerated: false }, state: 'valid' as const }))
  const executions = provenance.filter((p) => p.state === 'valid').slice(0, 8)
  const queries = executions.map((p) => p.query)
  const provenanceById = new Map(provenance.map((p) => [p.query_id, p]))
  const coreQueries = provenance.filter((p) => p.scope === 'core' && p.state === 'valid')

  // 2. Fan out: every query against every engine, in parallel.
  const settled = await Promise.all(
    executions.flatMap((plan) =>
      engines.map(async (engine) => ({
        engine,
        plan,
        res: await queryEngine(engine, plan.query, {
          webSearch,
          onUsage: opts.onUsage,
          purpose: `geo:${engine}`,
          meta: opts.meta ? { ...opts.meta, stage: `geo_engine:${engine}` } : undefined,
        }),
      }))
    )
  )
  const observed = new Date().toISOString()
  // `settled` is ordered query-major (queries.flatMap(engines)), so the query index is
  // positional - duplicate query strings cannot select the wrong ledger row.
  const ledger: LedgerRow[] = settled.map((s) => { const classified = classifyEngineResponse(s.res, { engine: s.engine, webSearch }); return { query_id: s.plan.query_id, query: s.plan.query, engine: s.engine, sample_index: 1, status: classified.status, status_reason: classified.reason, tool_events: s.res.tool_events, attempts: s.res.attempts, model: s.res.model, http_status: s.res.http_status, answer_length: s.res.answer.length, citations_count: s.res.citations.length, latency_ms: s.res.latency_ms, observed_at: observed, diagnostic_answer_text: SUCCESSFUL_STATUSES.includes(classified.status) ? undefined : s.res.answer.slice(0, DIAGNOSTIC_TEXT_LIMIT) } })
  const successfulIndexes = ledger.map((row, i) => (SUCCESSFUL_STATUSES.includes(row.status) ? i : -1)).filter((i) => i >= 0)
  const coreLedger = ledger.filter((row) => provenanceById.get(row.query_id)?.scope !== 'supplemental')
  const coreSuccessfulIndexes = successfulIndexes.filter((index) => provenanceById.get(ledger[index].query_id)?.scope !== 'supplemental')
  const testCounts: GeoTestCounts = geoTestCounts(coreQueries.length || queries.length, engines.length, coreSuccessfulIndexes.length, 0)
  testCounts.expected_samples = testCounts.expected_combinations; testCounts.successful_samples = coreSuccessfulIndexes.length; testCounts.grounded_samples = coreLedger.filter(r => r.status === 'ok_grounded').length; testCounts.no_citation_samples = coreLedger.filter(r => r.status === 'ok_no_citations').length
  testCounts.supplemental_expected_combinations = ledger.length - coreLedger.length
  testCounts.supplemental_successful_combinations = successfulIndexes.length - coreSuccessfulIndexes.length
  const raw = successfulIndexes.map((ledgerIndex) => { const s = settled[ledgerIndex]; return { engine: s.engine, query: s.plan.query, plan: s.plan, answer: s.res.answer, citations: s.res.citations, res: s.res, ledgerIndex } })
  const enginesTested = [...new Set(raw.map((result) => result.engine))]

  if (raw.length === 0) {
    // Every sample failed: keep the attempted ledger, per-engine coverage and a failed
    // gate so the client never sees a 0/0 "score" and approval stays blocked.
    const engine_coverage = buildEngineCoverage(ledger, queries.length, engines)
    const coverage_gate = evaluateCoverageGate(engine_coverage)
    return GeoResultSchema.parse({
      ...emptyResult(brand, brandDomain, queries.length, engines, testCounts),
      citation_rate: null,
      summary: buildGeoSummary({ brand, test_counts: testCounts, mention_rate: 0, citation_rate: null, ai_visibility_score: 0, mentionedCombinations: 0, engines: [], coverageGate: coverage_gate }),
      ledger, engine_coverage, coverage_gate, observed_at: observed, observed_until: observed,
    })
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
        if (name.includes('.') && !registrableDomain(name)) continue
        // Explicit operator input wins. Only inferred names are filtered.
        if (isAnswerEngineCompetitorName(name)) continue
        if (competitorList.some((c) => sld(c.name) === key || competitorKey(c.name) === competitorKey(name))) continue
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

    const answer_text = r.answer.slice(0, ANSWER_TEXT_LIMIT); const excerpt = deriveExcerpt(answer_text)
    const row = ledger[r.ledgerIndex]
    row.evidence_id = `GEO-QUERY-${String(i + 1).padStart(3, '0')}`
    return {
      evidence_id: `GEO-QUERY-${String(i + 1).padStart(3, '0')}`,
      engine: r.engine,
      query: r.query,
      answer_excerpt: excerpt.excerpt,
      answer_text, excerpt_offset: excerpt.offset, status: row.status, grounding: row.status === 'ok_grounded' ? 'grounded' : 'no_citations', tool_events: r.res.tool_events, sample_index: 1, query_id: row.query_id, combination_id: `${row.query_id}-${r.engine}`, model: r.res.model, observed_at: row.observed_at,
      citations: r.citations,
      brand_mentioned,
      brand_cited,
      brand_position,
      competitors_mentioned,
      cited_domains: citedDomains(r.citations),
      query_intent: r.plan.intent || classifyQueryIntent(r.query),
      scope: r.plan.scope,
    }
  })

  // 5. Reproducible metrics + score.
  const coreEvidence = evidence.filter((e) => e.scope !== 'supplemental')
  const total = coreEvidence.length
  const brandMentions = coreEvidence.filter((e) => e.brand_mentioned).length
  const brandCitations = coreEvidence.filter((e) => e.brand_cited).length
  const competitorMentionsTotal = coreEvidence.reduce((sum, e) => sum + e.competitors_mentioned.length, 0)

  const mentionPositions = coreEvidence
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
  const citation_rate = testCounts.grounded_samples ? pct(brandCitations, testCounts.grounded_samples) : null
  const share_of_voice =
    brandMentions + competitorMentionsTotal > 0
      ? round((brandMentions / (brandMentions + competitorMentionsTotal)) * 100, 1)
      : 0
  const position_score = round(positionScore01 * 100, 1)

  const ai_visibility_score = Math.round(
    100 *
      (SCORE_WEIGHTS.mention * (mention_rate / 100) +
        SCORE_WEIGHTS.citation * ((citation_rate ?? 0) / 100) +
        SCORE_WEIGHTS.position * positionScore01 +
        SCORE_WEIGHTS.share_of_voice * (share_of_voice / 100))
  )

  // Competitor visibility (deterministic mention_rate per competitor).
  const competitor_visibility = competitorList
    .map((c) => ({
      name: c.name,
      mention_rate: pct(coreEvidence.filter((e) => textMentions(e.answer_excerpt, c.variants.tokens)).length, total),
    }))
    .filter((c) => c.mention_rate > 0)
    .sort((a, b) => b.mention_rate - a.mention_rate)
    .slice(0, 10)

  // Cited domains ranked by frequency across all answers.
  const domainCounts = new Map<string, number>()
  for (const e of coreEvidence) {
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
    citation_rate: citation_rate ?? 0,
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
          { ai_visibility_score, mention_rate, citation_rate: citation_rate ?? 0, share_of_voice },
          coreEvidence.map((e) => ({
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
        evidence: coreEvidence,
        maxSources,
        onUsage: opts.onUsage,
        meta: opts.meta ? { ...opts.meta, stage: 'geo_cited_source_analysis' } : undefined,
      })
    }
  }

  const engine_coverage = buildEngineCoverage(coreLedger, coreQueries.length || queries.length, engines)
  const coverage_gate = evaluateCoverageGate(engine_coverage, { validCoreSlots: queryPlan?.valid_core_slots, coreSlots: 6 })
  if (!coverage_gate.passed) narrative.summary = buildGeoSummary({ brand, test_counts: testCounts, mention_rate, citation_rate, ai_visibility_score, mentionedCombinations: brandMentions, engines: enginesTested, coverageGate: coverage_gate })
  const result: GeoResult = {
    brand,
    brand_domain: brandDomain,
    queries_tested: coreQueries.length || queries.length,
    engines_tested: enginesTested,
    test_counts: testCounts,
    ai_visibility_score,
    mention_rate,
    citation_rate,
    share_of_voice,
    avg_position,
    score_breakdown: {
      mention_rate,
      citation_rate: citation_rate ?? 0,
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
    query_provenance: provenance,
    query_plan: queryPlan ? { valid_core_slots: queryPlan.valid_core_slots, review_required: queryPlan.review_required, primary_language: queryPlan.primary_language, markets: queryPlan.markets, warnings: queryPlan.warnings } : undefined,
    supplemental_probes: provenance.filter((p) => p.scope === 'supplemental' && p.state === 'valid').map((p) => ({ query_id: p.query_id, slot: p.slot, language: p.language, query: p.query, per_engine: engines.map((engine) => { const rows = evidence.filter((e) => e.query_id === p.query_id && e.engine === engine); return { engine, successful: rows.length, mentioned: rows.filter((e) => e.brand_mentioned).length, cited: rows.filter((e) => e.brand_cited).length } }) })),
    source_gap_analysis,
    query_analysis: buildQueryAnalysis(coreEvidence),
    ledger, engine_coverage, coverage_gate, observed_at: observed, observed_until: observed,
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
