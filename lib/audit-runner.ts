import { supabaseAdmin } from './supabase'
import { scrapeUrl, scrapePage } from './firecrawl'
import { normalizeMarkdown } from './normalize-markdown'
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
import { sendReportEmail } from './resend'
import { runGeoScan } from './geo'
import { notify } from './notify'
import { sanitizeGeneratedProse } from './sanitize'
import { attachActionConfidence } from './action-confidence'
import type { GeoResult } from './schemas'

/** Strip invented performance numbers from all human-facing report prose. */
function sanitizeReportProse(
  clarity: ClarityBlock,
  gap: GapBlock,
  action: ActionBlock,
  geo: GeoResult | null
): void {
  const mentions = geo?.evidence.filter((e) => e.brand_mentioned).length
  const total = geo?.evidence.length
  const clean = (text: string) => sanitizeGeneratedProse(text, mentions, total)

  clarity.icp_visibility.finding = clean(clarity.icp_visibility.finding)
  clarity.headline.finding = clean(clarity.headline.finding)
  clarity.cta.finding = clean(clarity.cta.finding)
  clarity.trust_proof.finding = clean(clarity.trust_proof.finding)
  clarity.messaging_fit.finding = clean(clarity.messaging_fit.finding)

  gap.where_you_lose = gap.where_you_lose.map(clean)
  gap.where_you_win = gap.where_you_win.map(clean)
  gap.ai_search.finding = clean(gap.ai_search.finding)
  gap.ai_search.missing_signals = gap.ai_search.missing_signals.map(clean)

  action.executive_summary = clean(action.executive_summary)
  action.top_fixes = action.top_fixes.map((f) => ({
    ...f,
    title: clean(f.title),
    description: clean(f.description),
  }))
  action.outreach_messages = action.outreach_messages.map((m) => ({
    ...m,
    message: clean(m.message),
    note: clean(m.note),
  }))

  if (geo) {
    geo.summary = clean(geo.summary)
    geo.missing_signals = geo.missing_signals.map(clean)
    geo.recommendations = geo.recommendations.map(clean)
    geo.source_gap_analysis = geo.source_gap_analysis?.map((s) => ({
      ...s,
      why_this_source_gets_cited: clean(s.why_this_source_gets_cited),
      recommended_fix: clean(s.recommended_fix),
    })) ?? geo.source_gap_analysis
  }
}

function brandFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    const name = host.split('.')[0]
    return name.charAt(0).toUpperCase() + name.slice(1)
  } catch {
    return url
  }
}

export async function runFullAudit(auditId: string): Promise<void> {
  // 1. Fetch audit record
  const { data: audit, error } = await supabaseAdmin
    .from('audits')
    .select('*')
    .eq('id', auditId)
    .single()

  if (error || !audit) {
    throw new Error(`Audit ${auditId} not found: ${error?.message}`)
  }

  // 2. Set status to processing
  await supabaseAdmin
    .from('audits')
    .update({ audit_status: 'processing' })
    .eq('id', auditId)

  try {
    // 3. Scrape target (markdown + rendered HTML) + competitors
    const targetPage = await scrapePage(audit.url)
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
      if (raw) {
        competitors.push({ url: compUrl, markdown: normalizeMarkdown(raw) })
      } else {
        console.warn(`Failed to scrape competitor: ${compUrl}, continuing without it`)
      }
    }

    const icp = audit.icp_description || ''
    const brand = brandFromUrl(audit.url)

    // 3b. Live AI-visibility (GEO/AEO) scan - full breadth across every
    // configured engine. Runs alongside the messaging analysis below.
    const geoPromise: Promise<GeoResult | null> = runGeoScan({
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
    }).catch((err) => {
      console.error(`GEO scan failed for ${auditId} (continuing without it):`, err)
      return null
    })

    // 4. Step 2: Clarity block
    const clarity = await callClaudeJSON<ClarityBlock>({
      model: MODEL_AUDIT,
      system: CLARITY_SYSTEM,
      user: clarityUserPrompt(targetMarkdown, icp),
      validate: (data) => ClarityBlockSchema.parse(data),
      maxTokens: 4096,
    })

    // 5. Step 3: Gap block
    const gap = await callClaudeJSON<GapBlock>({
      model: MODEL_AUDIT,
      system: GAP_SYSTEM,
      user: gapUserPrompt(targetMarkdown, competitors, JSON.stringify(clarity)),
      validate: (data) => GapBlockSchema.parse(data),
      maxTokens: 4096,
    })

    // 6. Step 4: Action block
    const action = await callClaudeJSON<ActionBlock>({
      model: MODEL_AUDIT,
      system: ACTION_SYSTEM,
      user: actionUserPrompt(JSON.stringify(clarity), JSON.stringify(gap), icp),
      validate: (data) => ActionBlockSchema.parse(data),
      maxTokens: 4096,
    })

    const geo = await geoPromise

    // 6b. Trust Layer: strip any invented or over-broad language the model
    // slipped into prose, then attach deterministic confidence to actions.
    sanitizeReportProse(clarity, gap, action, geo)
    const actionWithConfidence = attachActionConfidence(action, technicalFindings, geo)

    // 6c. Ready-to-ship materials (meta/FAQ/CTA + deterministic JSON-LD).
    let readyMaterials: ReadyMaterials | null = null
    try {
      const llm = await callClaudeJSON({
        model: MODEL_AUDIT,
        system: MATERIALS_SYSTEM,
        user: materialsUserPrompt(brand, audit.url, icp, JSON.stringify(clarity), geo?.summary || ''),
        validate: (d) => ReadyMaterialsLlmSchema.parse(d),
        maxTokens: 2048,
      })
      readyMaterials = assembleMaterials(brand, audit.url, llm)
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
      const { briefs } = await callClaudeJSON({
        model: MODEL_AUDIT,
        system: BRIEF_SYSTEM,
        user: briefUserPrompt(brand, audit.url, topFixes),
        validate: (d) => ImplementationBriefsLlmSchema.parse(d),
        maxTokens: 2048,
      })
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
      },
      clarity,
      gap,
      action: actionWithConfidence,
      geo,
      technical_findings: technicalFindings,
      ready_materials: readyMaterials,
      implementation_briefs: implementationBriefs,
    }

    // 8. Save report to audit
    await supabaseAdmin
      .from('audits')
      .update({
        report: report,
        audit_status: 'done',
      })
      .eq('id', auditId)

    // 9. Write audit_insights summary row
    await supabaseAdmin.from('audit_insights').insert({
      audit_id: auditId,
      icp_clarity: clarity.icp_visibility.score,
      headline_score: clarity.headline.score,
      cta_score: clarity.cta.score,
      trust_score: clarity.trust_proof.score,
      // Prefer the live AI-visibility measurement; fall back to the heuristic.
      ai_search_score: geo?.ai_visibility_score ?? gap.ai_search.score,
      top_issues: actionWithConfidence.top_fixes.slice(0, 3).map((f) => f.title),
      competitor_patterns: gap.where_you_lose.slice(0, 5),
    })

    // 10. Send delivery email
    try {
      await sendReportEmail(audit.email, auditId, audit.url)
      await supabaseAdmin
        .from('audits')
        .update({ audit_status: 'delivered' })
        .eq('id', auditId)
    } catch (emailErr) {
      console.error('Failed to send delivery email:', emailErr)
      // Report is still done, just not delivered via email
    }
  } catch (err) {
    console.error(`Audit generation failed for ${auditId}:`, err)
    await supabaseAdmin
      .from('audits')
      .update({ audit_status: 'failed' })
      .eq('id', auditId)
    await notify('audit_generation_failed', {
      audit_id: auditId,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}
