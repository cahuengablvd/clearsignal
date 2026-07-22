import { supabaseAdmin } from './supabase'
import { validateReport } from './report-validator'
import { sanitizeGeneratedReportValue } from './sanitize'
import { rebuildReusedGeoNarrative } from './audit-runner'
import { archiveCurrentReportVersion } from './report-versions'
import { buildVerifiedFactsLayer } from './verified-facts'
import { appendAdminNote } from './admin-notes'
import { attachActionRecommendationStages, buildStagedGeoRecommendations } from './geo/recommendation-stages'
import type { BusinessContext, ClearSignalReport } from './schemas'

export async function rerenderStoredAuditReport(auditId: string): Promise<{
  validation_warnings: string[]
}> {
  const { data: audit, error } = await supabaseAdmin
    .from('audits')
    .select('id, report, business_context, audit_status, admin_notes')
    .eq('id', auditId)
    .single()

  if (error || !audit) {
    throw new Error(`Audit ${auditId} not found: ${error?.message}`)
  }

  if (!audit.report) {
    throw new Error('Audit has no stored report to re-render')
  }

  const existing = audit.report as ClearSignalReport
  const businessContext = (existing.meta.business_context || audit.business_context) as BusinessContext | undefined
  const rebuiltGeo = existing.geo ? rebuildReusedGeoNarrative(existing.geo, {
    canonicalBrand: existing.meta.canonical_brand,
    alternativeBrandForms: existing.meta.alternative_brand_forms,
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
  if (validation.errors.length) {
    const message = `Report validation blocked re-render: ${validation.errors.slice(0, 5).join('; ')}`
    await supabaseAdmin
      .from('audits')
      .update({
        audit_status: 'failed-validation',
        admin_notes: message.slice(0, 2000),
        last_rerendered_at: new Date().toISOString(),
      })
      .eq('id', auditId)
    throw new Error(message)
  }

  const finalReport: ClearSignalReport = {
    ...validation.report,
    validation_warnings: [...validation.errors, ...validation.warnings].slice(0, 50),
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

  if (updateError) {
    throw new Error(`Failed to save re-rendered report: ${updateError.message}`)
  }

  return { validation_warnings: finalReport.validation_warnings ?? [] }
}
