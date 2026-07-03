import { supabaseAdmin } from './supabase'
import { validateReport } from './report-validator'
import { sanitizeGeneratedReportValue } from './sanitize'
import { rebuildReusedGeoNarrative } from './audit-runner'
import { archiveCurrentReportVersion } from './report-versions'
import { buildVerifiedFactsLayer } from './verified-facts'
import { appendAdminNote } from './admin-notes'
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
  const geo = existing.geo ? rebuildReusedGeoNarrative(existing.geo) : null
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
    geo,
    data_limitations: [
      ...(geo ? ['AI visibility evidence was reused from the previous completed scan for this audit.'] : []),
      ...(existing.data_limitations || []).filter(
        (line) => !/AI visibility evidence was reused from the previous completed scan/i.test(line)
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
