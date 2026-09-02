import { supabaseAdmin } from './supabase'
import { validateReport } from './report-validator'
import { sanitizeGeneratedReportValue } from './sanitize'
import { rebuildReusedGeoNarrative } from './audit-runner'
import { archiveCurrentReportVersion } from './report-versions'
import { buildVerifiedFactsLayer } from './verified-facts'
import { normalizeBusinessContext } from './business-context'
import { appendAdminNote } from './admin-notes'
import { requireSupabaseWrite } from './supabase-write'
import { attachActionRecommendationStages, buildStagedGeoRecommendations } from './geo/recommendation-stages'
import type { BusinessContext, ClearSignalReport } from './schemas'
import { mergeBrandAliases } from './brand'

export async function rerenderStoredAuditReport(auditId: string): Promise<{
  validation_warnings: string[]
}> {
  const { data: audit, error } = await supabaseAdmin
    .from('audits')
    .select('id, report, business_context, competitor_1, competitor_2, competitor_3, audit_status, admin_notes')
    .eq('id', auditId)
    .single()

  if (error || !audit) {
    throw new Error(`Audit ${auditId} not found: ${error?.message}`)
  }

  if (!audit.report) {
    throw new Error('Audit has no stored report to re-render')
  }

  const existing = audit.report as ClearSignalReport
  // The audit row is the operator-editable source of truth. Merge it over the
  // historic report context so an alias saved after generation takes effect.
  const businessContext = normalizeBusinessContext({
    ...(existing.meta.business_context || {}),
    ...(audit.business_context || {}),
  }) as BusinessContext
  const brandEntity = mergeBrandAliases({
    canonical_brand: existing.meta.canonical_brand || existing.geo?.brand || '',
    domain: existing.meta.domain || existing.meta.url,
    alternative_brand_forms: existing.meta.alternative_brand_forms || [],
  }, businessContext?.brand_aliases)
  const rebuiltGeo = existing.geo ? rebuildReusedGeoNarrative(existing.geo, {
    canonicalBrand: brandEntity.canonical_brand,
    alternativeBrandForms: brandEntity.alternative_brand_forms,
    explicitCompetitors: [audit.competitor_1, audit.competitor_2, audit.competitor_3].filter((value): value is string => Boolean(value)),
    requestedMarketsLanguages: businessContext.target_markets_languages,
  }) : null
  const technicalEligibility = existing.technical_eligibility || rebuiltGeo?.technical_eligibility
  const geo = rebuiltGeo ? {
    ...rebuiltGeo,
    technical_eligibility: technicalEligibility || rebuiltGeo.technical_eligibility,
    staged_recommendations: buildStagedGeoRecommendations(
      rebuiltGeo.recommendations,
      technicalEligibility || undefined
    ),
  } : null
  const verifiedFactsLayer = buildVerifiedFactsLayer({
    businessContext,
    observedBusinessContext: existing.meta.observed_business_context,
  })
  const report: ClearSignalReport = {
    ...existing,
    // Stale warnings from the previous run quote blocked phrases verbatim
    // (`replacement_phrase: "..."`), so carrying them into this pass would
    // re-trigger the artifact detector on the validator's own output.
    validation_warnings: [],
    meta: {
      ...existing.meta,
      canonical_brand: brandEntity.canonical_brand,
      alternative_brand_forms: brandEntity.alternative_brand_forms,
      business_context: businessContext ?? existing.meta.business_context,
      verified_facts_layer: verifiedFactsLayer,
    },
    action: attachActionRecommendationStages(existing.action, technicalEligibility || undefined),
    geo,
    technical_eligibility: technicalEligibility || null,
    data_limitations: [
      ...(geo ? ['AI visibility evidence was reused from the previous completed scan for this audit.'] : []),
      ...(geo ? ['Reused AI visibility evidence was rechecked with the current brand-alias detector over stored answer excerpts; this can recover missed mentions in excerpts but cannot prove absence beyond the stored excerpt.'] : []),
      ...(existing.data_limitations || []).filter(
        (line) => !/AI visibility evidence was reused from the previous completed scan|Reused AI visibility evidence was rechecked/i.test(line)
      ),
    ],
  }

  const safeReport = sanitizeGeneratedReportValue(
    report,
    geo?.evidence.filter((e) => e.brand_mentioned).length,
    geo?.evidence.length,
    { businessContext }
  )
  const validation = validateReport(safeReport)
  // Legacy reports can predate the current schema recommendation set. Keep the
  // mismatch visible to the reviewer, but do not mutate client copy or strand
  // an otherwise reviewable re-render. Generation still uses validateReport's
  // errors directly and therefore remains blocking.
  const schemaMismatchWarnings = validation.errors.filter((item) =>
    /^schema_deliverable_mismatch\b/.test(item)
  )
  const blockingErrors = validation.errors.filter((item) =>
    !/^schema_deliverable_mismatch\b/.test(item)
  )
  if (blockingErrors.length) {
    const message = `Report validation blocked re-render: ${blockingErrors.slice(0, 5).join('; ')}`
    const { error: validationWriteError } = await supabaseAdmin
      .from('audits')
      .update({
        audit_status: 'failed-validation',
        admin_notes: message.slice(0, 2000),
        last_rerendered_at: new Date().toISOString(),
      })
      .eq('id', auditId)
    requireSupabaseWrite(validationWriteError, `audits re-render validation failure for audit ${auditId}`)
    throw new Error(message)
  }

  const finalReport: ClearSignalReport = {
    ...validation.report,
    validation_warnings: [...schemaMismatchWarnings, ...validation.warnings].slice(0, 50),
  }

  await archiveCurrentReportVersion({
    auditId,
    report: audit.report,
    auditStatus: audit.audit_status,
    versionType: 'rerendered',
  })

  const { error: updateError } = await supabaseAdmin
    .from('audits')
    .update({
      report: finalReport,
      audit_status: 'awaiting_review',
      last_rerendered_at: new Date().toISOString(),
      admin_notes: appendAdminNote(
        audit.admin_notes,
        `[${new Date().toISOString()}] OK: re-render succeeded; ${finalReport.validation_warnings?.length ?? 0} validation warnings.`
      ),
    })
    .eq('id', auditId)

  requireSupabaseWrite(updateError, `audits re-rendered report for audit ${auditId}`)

  return { validation_warnings: finalReport.validation_warnings ?? [] }
}
