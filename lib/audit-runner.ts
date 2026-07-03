import { supabaseAdmin } from './supabase'
import { scrapeUrl, scrapePage } from './firecrawl'
import { normalizeMarkdown } from './normalize-markdown'
import { resolveBrandEntity } from './brand'
import { inferObservedBusinessContext, normalizeBusinessContext } from './business-context'
import { validateReport } from './report-validator'
import { computeTechnicalFindings } from './findings'
import { assembleMaterials } from './materials'
import { callClaudeJSON } from './anthropic'
import {
  ClarityBlockSchema,
  GapBlockSchema,
  ActionBlockSchema,
  type ClarityBlock,
  type GapBlock,
  type ActionBlock,
  type ClearSignalReport,
  ReadyMaterialsLlmSchema,
  type ReadyMaterials,
  ImplementationBriefsLlmSchema,
  type ImplementationBrief,
  type BusinessContext,
  GeoResultSchema,
} from './schemas'
import {
  MODEL_AUDIT,
  CLARITY_SYSTEM,
  clarityUserPrompt,
  GAP_SYSTEM,
  gapUserPrompt,
  ACTION_SYSTEM,
  actionUserPrompt,
  MATERIALS_SYSTEM,
  materialsUserPrompt,
  BRIEF_SYSTEM,
  briefUserPrompt,
} from './prompts'
import { deliverAuditEmail } from './email-delivery'
import { buildGeoSummary, runGeoScan } from './geo'
import { buildVariants, citationsInclude, textMentions, firstMentionIndex } from './geo/detect'
import { notify } from './notify'
import { sanitizeGeneratedProse, sanitizeGeneratedReportValue } from './sanitize'
import { attachActionConfidence } from './action-confidence'
import { CostTracker } from './cost-tracker'
import type { GeoResult } from './schemas'
import { archiveCurrentReportVersion } from './report-versions'
import { buildVerifiedFactsLayer } from './verified-facts'
import { appendAdminNote } from './admin-notes'
import { auditExecutionContext, runAuditStage, type AuditTrigger } from './audit-execution'
import { reconcileAuditAiCost } from './ai-observability'

export type RunFullAuditOptions = {
  reuseGeoEvidence?: boolean
  trigger?: AuditTrigger
  endpoint?: string
}

function buildDataLimitations(geo: GeoResult | null, reusedGeoEvidence = false): string[] {
  const limits = [
    'This audit does not use GA4, CRM, ad platform, heatmap, or sales-cycle data, so conversion and revenue impact are framed as hypotheses.',
    'Crawler output may miss visual-only content, gated content, personalized pages, or assets blocked by the target site.',
    'Recommendations should be reviewed by the business owner before publishing claims, guarantees, case studies, or client results.',
  ]
  if (geo) {
    limits.unshift(
      `AI visibility findings are limited to ${geo.evidence.length} tested engine-query combinations across ${geo.engines_tested.join(', ')}.`
    )
    if (reusedGeoEvidence) {
      limits.unshift('AI visibility evidence was reused from the previous completed scan for this audit.')
      limits.unshift('Reused AI visibility evidence was rechecked with the current brand-alias detector over stored answer excerpts; this can recover missed mentions in excerpts but cannot prove absence beyond the stored excerpt.')
    }
  } else {
    limits.unshift('Live AI visibility evidence was unavailable for this run.')
  }
  return limits
}

export function reusableGeoFromAudit(audit: { report?: unknown }): GeoResult | null {
  const maybeReport = audit.report as { geo?: unknown; meta?: { canonical_brand?: string; alternative_brand_forms?: string[] } } | null | undefined
  if (!maybeReport?.geo) return null
  const parsed = GeoResultSchema.safeParse(maybeReport.geo)
  if (!parsed.success || parsed.data.evidence.length === 0) return null
  return rebuildReusedGeoNarrative(parsed.data, {
    canonicalBrand: maybeReport.meta?.canonical_brand,
    alternativeBrandForms: maybeReport.meta?.alternative_brand_forms,
  })
}

const REUSED_GEO_WEIGHTS = { mention: 0.4, citation: 0.25, position: 0.2, share_of_voice: 0.15 }

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 1000) / 10 : 0
}

function round(n: number, digits = 1): number {
  const m = 10 ** digits
  return Math.round(n * m) / m
}

function combinedBrandVariants(args: {
  name?: string
  url?: string
  alternatives?: string[]
}): { domain: string | null; tokens: string[] } {
  const base = buildVariants({ name: args.name, url: args.url })
  const tokens = new Set(base.tokens)
  for (const alt of args.alternatives || []) {
    for (const token of buildVariants({ name: alt }).tokens) tokens.add(token)
  }
  return { domain: base.domain, tokens: [...tokens] }
}

export function recomputeReusedGeoEvidence(
  geo: GeoResult,
  opts: { canonicalBrand?: string; alternativeBrandForms?: string[] } = {}
): GeoResult {
  const brand = opts.canonicalBrand || geo.brand
  const brandVariants = combinedBrandVariants({
    name: brand,
    url: geo.brand_domain,
    alternatives: opts.alternativeBrandForms,
  })
  const competitorNames = [
    ...geo.competitor_visibility.map((c) => c.name),
    ...geo.evidence.flatMap((e) => e.competitors_mentioned),
  ].filter(Boolean)
  const competitorList = [...new Set(competitorNames)]
    .filter((name) => !textMentions(name, brandVariants.tokens))
    .map((name) => ({ name, variants: buildVariants({ name }) }))

  const evidence = geo.evidence.map((e) => {
    const answer = e.answer_excerpt || ''
    const brand_mentioned = textMentions(answer, brandVariants.tokens)
    const brand_cited = citationsInclude(e.citations || [], brandVariants.domain)
    const positions: { name: string; index: number; isBrand: boolean }[] = []
    const brandIndex = firstMentionIndex(answer, brandVariants.tokens)
    if (brandIndex >= 0) positions.push({ name: brand, index: brandIndex, isBrand: true })
    for (const c of competitorList) {
      const index = firstMentionIndex(answer, c.variants.tokens)
      if (index >= 0) positions.push({ name: c.name, index, isBrand: false })
    }
    positions.sort((a, b) => a.index - b.index)
    const brand_position = brand_mentioned
      ? positions.findIndex((p) => p.isBrand) + 1 || null
      : null
    return {
      ...e,
      brand_mentioned,
      brand_cited,
      brand_position,
      competitors_mentioned: positions.filter((p) => !p.isBrand).map((p) => p.name),
    }
  })

  const total = evidence.length
  const brandMentions = evidence.filter((e) => e.brand_mentioned).length
  const brandCitations = evidence.filter((e) => e.brand_cited).length
  const competitorMentionsTotal = evidence.reduce((sum, e) => sum + e.competitors_mentioned.length, 0)
  const mentionPositions = evidence
    .filter((e) => e.brand_position != null)
    .map((e) => e.brand_position as number)
  const avg_position = mentionPositions.length
    ? round(mentionPositions.reduce((a, b) => a + b, 0) / mentionPositions.length, 2)
    : null
  const positionScore01 = mentionPositions.length
    ? mentionPositions.reduce((sum, p) => sum + Math.max(0, 1 - (p - 1) / 5), 0) / mentionPositions.length
    : 0
  const mention_rate = pct(brandMentions, total)
  const citation_rate = pct(brandCitations, total)
  const share_of_voice = brandMentions + competitorMentionsTotal > 0
    ? round((brandMentions / (brandMentions + competitorMentionsTotal)) * 100, 1)
    : 0
  const position_score = round(positionScore01 * 100, 1)
  const ai_visibility_score = Math.round(
    100 *
    (REUSED_GEO_WEIGHTS.mention * (mention_rate / 100) +
      REUSED_GEO_WEIGHTS.citation * (citation_rate / 100) +
      REUSED_GEO_WEIGHTS.position * positionScore01 +
      REUSED_GEO_WEIGHTS.share_of_voice * (share_of_voice / 100))
  )
  const competitor_visibility = competitorList
    .map((c) => ({
      name: c.name,
      mention_rate: pct(evidence.filter((e) => textMentions(e.answer_excerpt, c.variants.tokens)).length, total),
    }))
    .filter((c) => c.mention_rate > 0)
    .sort((a, b) => b.mention_rate - a.mention_rate)
    .slice(0, 10)

  return {
    ...geo,
    brand,
    evidence,
    ai_visibility_score,
    mention_rate,
    citation_rate,
    share_of_voice,
    avg_position,
    competitor_visibility,
    score_breakdown: {
      mention_rate,
      citation_rate,
      position_score,
      share_of_voice,
      weights: REUSED_GEO_WEIGHTS,
    },
  }
}

export function rebuildReusedGeoNarrative(
  input: GeoResult,
  opts: { canonicalBrand?: string; alternativeBrandForms?: string[] } = {}
): GeoResult {
  const geo = recomputeReusedGeoEvidence(input, opts)
  const total = geo.test_counts?.successful_combinations ?? geo.evidence.length
  const mentioned = geo.evidence.filter((e) => e.brand_mentioned).length
  const cited = geo.evidence.filter((e) => e.brand_cited).length
  const engines = geo.engines_tested.length ? geo.engines_tested : [...new Set(geo.evidence.map((e) => e.engine))]
  const citedDomains = geo.cited_domains_ranked.slice(0, 3).map((d) => d.domain)
  const competitorNames = geo.competitor_visibility.slice(0, 3).map((c) => c.name)

  const missingSignals = [
    `${geo.brand} was not mentioned in ${mentioned === 0 ? 'any' : `${total - mentioned} of ${total}`} successfully tested engine-query combinations.`,
    cited === 0
      ? `${geo.brand_domain} was not cited in the successfully tested responses.`
      : `${geo.brand_domain} was cited in ${cited} of ${total} successfully tested responses.`,
    citedDomains.length
      ? `Cited sources surfaced in the tested responses included ${citedDomains.join(', ')}.`
      : 'No cited-source pattern was available in the reused evidence.',
    competitorNames.length
      ? `Competitors surfaced in the tested responses included ${competitorNames.join(', ')}.`
      : '',
  ].filter(Boolean)

  return {
    ...geo,
    summary: buildGeoSummary({
      brand: geo.brand,
      brandDomain: geo.brand_domain,
      test_counts:
        geo.test_counts ?? {
          configured_queries: geo.queries_tested,
          configured_engines: engines.length,
          expected_combinations: geo.queries_tested * engines.length,
          successful_combinations: total,
          failed_combinations: Math.max(0, geo.queries_tested * engines.length - total),
          skipped_combinations: 0,
        },
      mention_rate: geo.mention_rate,
      citation_rate: geo.citation_rate,
      ai_visibility_score: geo.ai_visibility_score,
      mentionedCombinations: mentioned,
      engines,
      evidenceReused: true,
    }),
    missing_signals: missingSignals,
    recommendations: [
      'Strengthen owned-page content around the buyer questions used in this scan.',
      'Add structured FAQ and service/entity markup that matches the tested query set.',
      'Prioritize third-party profiles or local sources that appeared in the tested responses.',
      'Re-run a fresh GEO scan after content and source improvements are live.',
    ],
  }
}

/** Strip invented performance numbers from all human-facing report prose. */
function sanitizeReportProse(
  clarity: ClarityBlock,
  gap: GapBlock,
  action: ActionBlock,
  geo: GeoResult | null,
  businessContext?: BusinessContext
): void {
  const mentions = geo?.evidence.filter((e) => e.brand_mentioned).length
  const total = geo?.evidence.length
  const clean = (text: string) => sanitizeGeneratedProse(text, mentions, total, { businessContext })

  clarity.icp_visibility.finding = clean(clarity.icp_visibility.finding)
  clarity.headline.finding = clean(clarity.headline.finding)
  clarity.cta.finding = clean(clarity.cta.finding)
  clarity.trust_proof.finding = clean(clarity.trust_proof.finding)
  clarity.messaging_fit.finding = clean(clarity.messaging_fit.finding)

  gap.where_you_lose = gap.where_you_lose.map(clean)
  gap.where_you_win = gap.where_you_win.map(clean)
  gap.competitor_analysis = gap.competitor_analysis.map((c) => ({
    ...c,
    headline: clean(c.headline),
    strengths: c.strengths.map(clean),
    weaknesses: c.weaknesses.map(clean),
  }))
  gap.ai_search.finding = clean(gap.ai_search.finding)
  gap.ai_search.missing_signals = gap.ai_search.missing_signals.map(clean)

  action.executive_summary = clean(action.executive_summary)
  action.top_fixes = action.top_fixes.map((f) => ({
    ...f,
    title: clean(f.title),
    description: clean(f.description),
  }))
  action.ship_first = action.ship_first.map(clean)
  action.ignore_for_now = action.ignore_for_now.map(clean)
  action.outreach_messages = action.outreach_messages.map((m) => ({
    ...m,
    message: clean(m.message),
    note: clean(m.note),
  }))

  if (geo) {
    geo.missing_signals = geo.missing_signals.map(clean)
    geo.recommendations = geo.recommendations.map(clean)
    geo.source_gap_analysis = geo.source_gap_analysis?.map((s) => ({
      ...s,
      why_this_source_gets_cited: clean(s.why_this_source_gets_cited),
      recommended_fix: clean(s.recommended_fix),
    })) ?? geo.source_gap_analysis
  }
}

const VALIDATION_FALLBACK_TEXT =
  'This item was removed because it could not be validated safely. Review the source evidence before publishing a replacement.'

function validationPathFromError(error: string): string | null {
  const atMatch = error.match(/\bat\s+([a-zA-Z0-9_.]+)(?::|$)/)
  if (atMatch) return atMatch[1]
  const prefixMatch = error.match(/^([a-zA-Z0-9_.]+)(?::|$)/)
  return prefixMatch ? prefixMatch[1] : null
}

function removeArrayItemAtPath(root: Record<string, any>, path: string[]): boolean {
  const last = path[path.length - 1]
  const index = Number(last)
  if (!Number.isInteger(index) || index < 0) return false
  let parent: any = root
  for (const part of path.slice(0, -1)) {
    if (parent == null) return false
    parent = parent[part]
  }
  if (!Array.isArray(parent)) return false
  parent.splice(index, 1)
  return true
}

function setFallbackAtPath(root: Record<string, any>, path: string[]): boolean {
  let parent: any = root
  for (const part of path.slice(0, -1)) {
    if (parent == null) return false
    parent = parent[part]
  }
  if (parent == null) return false
  const key = path[path.length - 1]
  if (typeof parent[key] === 'string') {
    parent[key] = VALIDATION_FALLBACK_TEXT
    return true
  }
  if (Array.isArray(parent[key])) {
    parent[key] = parent[key].filter((item: unknown) => typeof item !== 'string' || item.trim())
    return true
  }
  return false
}

function degradeValidationErrors(report: ClearSignalReport, errors: string[]): ClearSignalReport {
  const degraded = JSON.parse(JSON.stringify(report)) as ClearSignalReport
  const root = degraded as unknown as Record<string, any>

  for (const error of errors) {
    if (/^publishable_copy:|^schema_category:|^foreign_category_copy:/i.test(error)) {
      degraded.ready_materials = null
      continue
    }

    const pathText = validationPathFromError(error)
    if (!pathText || pathText === 'report') continue
    const path = pathText.split('.')

    if (/empty action item/i.test(error) || /empty implementation brief|empty fix_title/i.test(error)) {
      removeArrayItemAtPath(root, path)
      continue
    }

    if (removeArrayItemAtPath(root, path)) continue
    setFallbackAtPath(root, path)
  }

  return degraded
}

async function currentAdminNotes(auditId: string, fallback?: string | null): Promise<string | null | undefined> {
  const { data, error } = await supabaseAdmin
    .from('audits')
    .select('admin_notes')
    .eq('id', auditId)
    .single()
  if (error) return fallback
  return data?.admin_notes ?? fallback
}

export async function runFullAudit(auditId: string, opts: RunFullAuditOptions = {}): Promise<void> {
  const cost = new CostTracker()
  // 1. Fetch audit record
  const { data: audit, error } = await supabaseAdmin
    .from('audits')
    .select('*')
    .eq('id', auditId)
    .single()

  if (error || !audit) {
    throw new Error(`Audit ${auditId} not found: ${error?.message}`)
  }

  const exec = auditExecutionContext({
    auditId,
    attempt: audit.recovery_attempts ?? 0,
    trigger: opts.trigger ?? 'unknown',
    endpoint: opts.endpoint ?? 'runFullAudit',
  })

  // 2. Set status to processing
  const processingStartedAt = new Date().toISOString()
  await supabaseAdmin
    .from('audits')
    .update({ audit_status: 'processing', processing_started_at: processingStartedAt })
    .eq('id', auditId)

  try {
    // 3. Scrape target (markdown + rendered HTML) + competitors
    const targetPage = await scrapePage(audit.url)
    cost.addFirecrawlScrape('target_page')
    if (!targetPage) {
      throw new Error(`Failed to scrape target URL: ${audit.url}`)
    }
    const targetMarkdown = normalizeMarkdown(targetPage.markdown)

    // 3a. Deterministic structural findings from the rendered HTML.
    const technicalFindings = computeTechnicalFindings({
      url: audit.url,
      html: targetPage.html,
      markdown: targetMarkdown,
    })

    const competitorUrls = [audit.competitor_1, audit.competitor_2, audit.competitor_3].filter(Boolean) as string[]
    const competitors: { url: string; markdown: string }[] = []

    for (const compUrl of competitorUrls) {
      const raw = await scrapeUrl(compUrl)
      cost.addFirecrawlScrape('competitor_page')
      if (raw) {
        competitors.push({ url: compUrl, markdown: normalizeMarkdown(raw) })
      } else {
        console.warn(`Failed to scrape competitor: ${compUrl}, continuing without it`)
      }
    }

    const icp = audit.icp_description || ''
    const businessContext = normalizeBusinessContext(audit.business_context)
    const observedBusinessContext = inferObservedBusinessContext({
      url: audit.url,
      markdown: targetMarkdown,
      html: targetPage.html,
    })
    const verifiedFactsLayer = buildVerifiedFactsLayer({
      businessContext,
      observedBusinessContext,
    })
    // Resolve ONE brand entity from the page (not just the domain label) so the
    // report stops mixing "BLVD Production", "Blvdprod" and "blvdprod.com".
    const brandEntity = resolveBrandEntity({
      url: audit.url,
      html: targetPage.html,
      markdown: targetMarkdown,
    })
    const brand = brandEntity.canonical_brand

    // 3b. Live AI-visibility (GEO/AEO) scan - full breadth across every
    // configured engine. Runs alongside the messaging analysis below.
    const reusedGeo = opts.reuseGeoEvidence ? reusableGeoFromAudit(audit) : null
    if (reusedGeo) {
      console.log(`[audit-runner] reusing GEO evidence for ${auditId}: ${reusedGeo.evidence.length} combinations`)
    }
    const geoPromise: Promise<GeoResult | null> = reusedGeo
      ? Promise.resolve(reusedGeo)
      : runAuditStage(
          exec,
          'geo_scan',
          () => runGeoScan({
            brand,
            url: audit.url,
            category: targetMarkdown.slice(0, 600),
            icp,
            competitors: competitorUrls,
            queryCount: 6,
            // Use operator-confirmed queries when present (from the confirmation screen).
            providedQueries: (audit.geo_queries as string[] | null) || undefined,
            // Paid audit: also scrape the most-cited sources and explain why they win.
            analyzeSources: true,
            maxSources: 6,
            targetMarkdown,
            onUsage: (event) => cost.add(event),
            meta: {
              auditId,
              stage: 'geo_scan',
              trigger: exec.trigger,
              recoveryAttempt: exec.attempt,
              workerId: exec.workerId,
              endpoint: exec.endpoint,
            },
          }),
          (stored) => GeoResultSchema.parse(stored)
        ).catch((err) => {
          console.error(`GEO scan failed for ${auditId} (continuing without it):`, err)
          return null
        })

    // 4. Step 2: Clarity block
    const clarity = await runAuditStage(
      exec,
      'audit_clarity',
      () => callClaudeJSON<ClarityBlock>({
        model: MODEL_AUDIT,
        system: CLARITY_SYSTEM,
        user: clarityUserPrompt(targetMarkdown, icp, brand, businessContext),
        validate: (data) => ClarityBlockSchema.parse(data),
        maxTokens: 4096,
        purpose: 'audit:clarity',
        onUsage: (event) => cost.add(event),
        meta: {
          auditId,
          stage: 'audit_clarity',
          trigger: exec.trigger,
          recoveryAttempt: exec.attempt,
          workerId: exec.workerId,
          endpoint: exec.endpoint,
        },
      }),
      (stored) => ClarityBlockSchema.parse(stored)
    )

    // 5. Step 3: Gap block
    const gap = await runAuditStage(
      exec,
      'audit_gap',
      () => callClaudeJSON<GapBlock>({
        model: MODEL_AUDIT,
        system: GAP_SYSTEM,
        user: gapUserPrompt(targetMarkdown, competitors, JSON.stringify(clarity), brand, businessContext),
        validate: (data) => GapBlockSchema.parse(data),
        maxTokens: 4096,
        purpose: 'audit:gap',
        onUsage: (event) => cost.add(event),
        meta: {
          auditId,
          stage: 'audit_gap',
          trigger: exec.trigger,
          recoveryAttempt: exec.attempt,
          workerId: exec.workerId,
          endpoint: exec.endpoint,
        },
      }),
      (stored) => GapBlockSchema.parse(stored)
    )

    // 6. Step 4: Action block
    const action = await runAuditStage(
      exec,
      'audit_action',
      () => callClaudeJSON<ActionBlock>({
        model: MODEL_AUDIT,
        system: ACTION_SYSTEM,
        user: actionUserPrompt(JSON.stringify(clarity), JSON.stringify(gap), icp, brand, businessContext),
        validate: (data) => ActionBlockSchema.parse(data),
        maxTokens: 4096,
        purpose: 'audit:action',
        onUsage: (event) => cost.add(event),
        meta: {
          auditId,
          stage: 'audit_action',
          trigger: exec.trigger,
          recoveryAttempt: exec.attempt,
          workerId: exec.workerId,
          endpoint: exec.endpoint,
        },
      }),
      (stored) => ActionBlockSchema.parse(stored)
    )

    const geo = await geoPromise

    // 6b. Trust Layer: strip any invented or over-broad language the model
    // slipped into prose, then attach deterministic confidence to actions.
    sanitizeReportProse(clarity, gap, action, geo, businessContext)
    const actionWithConfidence = attachActionConfidence(action, technicalFindings, geo)

    // 6c. Ready-to-ship materials (meta/FAQ/CTA + deterministic JSON-LD).
    let readyMaterials: ReadyMaterials | null = null
    try {
      const llm = await runAuditStage(
        exec,
        'audit_ready_materials',
        () => callClaudeJSON({
          model: MODEL_AUDIT,
          system: MATERIALS_SYSTEM,
          user: materialsUserPrompt(brand, audit.url, icp, JSON.stringify(clarity), geo?.summary || '', businessContext),
          validate: (d) => ReadyMaterialsLlmSchema.parse(d),
          maxTokens: 2048,
          purpose: 'audit:ready_materials',
          onUsage: (event) => cost.add(event),
          meta: {
            auditId,
            stage: 'audit_ready_materials',
            trigger: exec.trigger,
            recoveryAttempt: exec.attempt,
            workerId: exec.workerId,
            endpoint: exec.endpoint,
          },
        }),
        (stored) => ReadyMaterialsLlmSchema.parse(stored)
      )
      llm.meta_title = sanitizeGeneratedProse(llm.meta_title, undefined, undefined, { businessContext })
      llm.meta_description = sanitizeGeneratedProse(llm.meta_description, undefined, undefined, { businessContext })
      llm.faq = llm.faq.map((f) => ({
        question: sanitizeGeneratedProse(f.question, undefined, undefined, { businessContext }),
        answer: sanitizeGeneratedProse(f.answer, undefined, undefined, { businessContext }),
      }))
      llm.cta_variants = llm.cta_variants.map((c) => sanitizeGeneratedProse(c, undefined, undefined, { businessContext }))
      readyMaterials = assembleMaterials(brand, audit.url, llm, {
        businessContext,
        observedBusinessContext,
        verifiedFacts: verifiedFactsLayer,
      })
    } catch (err) {
      console.warn(`Ready-materials generation failed for ${auditId} (continuing without it):`, err)
    }

    // 6d. Implementation briefs (acceptance criteria) for the top fixes.
    let implementationBriefs: ImplementationBrief[] | null = null
    try {
      const topFixes = actionWithConfidence.top_fixes.slice(0, 5).map((f) => ({
        title: f.title,
        description: f.description,
        category: f.category,
      }))
      const { briefs } = await runAuditStage(
        exec,
        'audit_implementation_briefs',
        () => callClaudeJSON({
          model: MODEL_AUDIT,
          system: BRIEF_SYSTEM,
          user: briefUserPrompt(brand, audit.url, topFixes, businessContext),
          validate: (d) => ImplementationBriefsLlmSchema.parse(d),
          maxTokens: 2048,
          purpose: 'audit:implementation_briefs',
          onUsage: (event) => cost.add(event),
          meta: {
            auditId,
            stage: 'audit_implementation_briefs',
            trigger: exec.trigger,
            recoveryAttempt: exec.attempt,
            workerId: exec.workerId,
            endpoint: exec.endpoint,
          },
        }),
        (stored) => ImplementationBriefsLlmSchema.parse(stored)
      )
      implementationBriefs = briefs
    } catch (err) {
      console.warn(`Implementation briefs failed for ${auditId} (continuing without them):`, err)
    }

    // 7. Assemble report
    const report: ClearSignalReport = {
      meta: {
        url: audit.url,
        generated_at: new Date().toISOString(),
        icp_description: icp,
        competitors: competitors.map((c) => c.url),
        tier: (audit.tier as 'automated' | 'reviewed' | 'sprint') || 'automated',
        canonical_brand: brandEntity.canonical_brand,
        domain: brandEntity.domain,
        alternative_brand_forms: brandEntity.alternative_brand_forms,
        business_context: businessContext,
        observed_business_context: observedBusinessContext,
        verified_facts_layer: verifiedFactsLayer,
      },
      clarity,
      gap,
      action: actionWithConfidence,
      data_limitations: buildDataLimitations(geo, Boolean(reusedGeo)),
      geo,
      technical_findings: technicalFindings,
      ready_materials: readyMaterials,
      implementation_briefs: implementationBriefs,
    }
    const safeReport = sanitizeGeneratedReportValue(
      report,
      geo?.evidence.filter((e) => e.brand_mentioned).length,
      geo?.evidence.length,
      { businessContext }
    )

    // 7b. Deterministic contradiction/artifact validation (post-sanitizer,
    // pre-save). Repairs in place; never throws on content problems.
    let validation = validateReport(safeReport)
    let degradedForValidation = false
    if (validation.errors.length) {
      const degraded = degradeValidationErrors(validation.report, validation.errors)
      const degradedValidation = validateReport(degraded)
      degradedForValidation = true
      validation = {
        ...degradedValidation,
        warnings: [
          ...validation.errors.map((e) => `validation_degraded: ${e}`),
          ...validation.warnings,
          ...degradedValidation.warnings,
        ],
        errors: degradedValidation.errors,
      }
    }
    if (validation.warnings.length || validation.errors.length) {
      console.warn(`Report validation for ${auditId}:`, {
        warnings: validation.warnings,
        errors: validation.errors,
      })
    }
    if (validation.errors.length) {
      throw new Error(`Report validation blocked PDF export: ${validation.errors.slice(0, 5).join('; ')}`)
    }
    const finalReport: ClearSignalReport = {
      ...validation.report,
      validation_warnings: [
        ...(degradedForValidation ? ['validation: degraded unsafe generated fields before save'] : []),
        ...validation.errors,
        ...validation.warnings,
      ].slice(0, 50),
    }

    // 8. Archive the previous report (if any), then save the new report.
    await archiveCurrentReportVersion({
      auditId,
      report: audit.report,
      auditStatus: audit.audit_status,
      versionType: opts.reuseGeoEvidence ? 'regenerated' : 'generated',
    })
    const reconciledCost = await reconcileAuditAiCost(auditId).catch(() => null)
    const adminNotes = await currentAdminNotes(auditId, audit.admin_notes)
    await supabaseAdmin
      .from('audits')
      .update({
        report: finalReport,
        audit_status: 'awaiting_review',
        last_generated_at: new Date().toISOString(),
        recovery_attempts: 0,
        admin_notes: appendAdminNote(
          adminNotes,
          `[${new Date().toISOString()}] OK: generation succeeded; ${finalReport.validation_warnings?.length ?? 0} validation warnings.`
        ),
        api_cost_usd: reconciledCost?.totalUsd ?? cost.totalUsd(),
        api_cost_breakdown: cost.breakdown(),
      })
      .eq('id', auditId)

    // 9. Write audit_insights summary row. Upsert prevents regeneration from
    // creating duplicate insight rows for the same audit.
    await supabaseAdmin.from('audit_insights').upsert({
      audit_id: auditId,
      icp_clarity: clarity.icp_visibility.score,
      headline_score: clarity.headline.score,
      cta_score: clarity.cta.score,
      trust_score: clarity.trust_proof.score,
      // Prefer the live AI-visibility measurement; fall back to the heuristic.
      ai_search_score: geo?.ai_visibility_score ?? gap.ai_search.score,
      top_issues: actionWithConfidence.top_fixes.slice(0, 3).map((f) => f.title),
      competitor_patterns: gap.where_you_lose.slice(0, 5),
    }, {
      onConflict: 'audit_id',
    })

    // 10. Delivery is operator-gated by default. During beta, the admin must
    // review the PDF and click "Approve & send" before the client gets email.
    if (process.env.AUTO_DELIVER_AUDITS === 'true') {
      await deliverAuditEmail(auditId)
    }
  } catch (err) {
    console.error(`Audit generation failed for ${auditId}:`, err)
    const errorMessage = err instanceof Error ? err.message : String(err)
    const validationFailed = /Report validation blocked/i.test(errorMessage)
    const reconciledCost = await reconcileAuditAiCost(auditId).catch(() => null)
    const adminNotes = await currentAdminNotes(auditId, audit.admin_notes)
    const failurePatch: Record<string, unknown> = {
      audit_status: validationFailed ? 'failed-validation' : 'failed',
      last_generated_at: new Date().toISOString(),
      admin_notes: appendAdminNote(
        adminNotes,
        `[${new Date().toISOString()}] Audit generation failed: ${errorMessage.slice(0, 1500)}`
      ),
      api_cost_usd: reconciledCost?.totalUsd ?? cost.totalUsd(),
      api_cost_breakdown: cost.breakdown(),
    }
    await supabaseAdmin
      .from('audits')
      .update(failurePatch)
      .eq('id', auditId)
    await notify('audit_generation_failed', {
      audit_id: auditId,
      error: errorMessage,
    })
    throw err
  }
}
