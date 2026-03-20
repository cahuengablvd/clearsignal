import { supabaseAdmin } from './supabase'
import { scrapeUrl } from './firecrawl'
import { normalizeMarkdown } from './normalize-markdown'
import { callClaudeJSON } from './anthropic'
import {
  ClarityBlockSchema,
  GapBlockSchema,
  ActionBlockSchema,
  type ClarityBlock,
  type GapBlock,
  type ActionBlock,
  type ClearSignalReport,
} from './schemas'
import {
  MODEL_AUDIT,
  CLARITY_SYSTEM,
  clarityUserPrompt,
  GAP_SYSTEM,
  gapUserPrompt,
  ACTION_SYSTEM,
  actionUserPrompt,
} from './prompts'
import { sendReportEmail } from './resend'

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
    // 3. Scrape target + competitors
    const targetRaw = await scrapeUrl(audit.url)
    if (!targetRaw) {
      throw new Error(`Failed to scrape target URL: ${audit.url}`)
    }
    const targetMarkdown = normalizeMarkdown(targetRaw)

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
      action,
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
      ai_search_score: gap.ai_search.score,
      top_issues: action.top_fixes.slice(0, 3).map((f) => f.title),
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
    throw err
  }
}
