import { supabaseAdmin } from './supabase'
import { validateReport } from './report-validator'
import { sanitizeGeneratedReportValue } from './sanitize'
import { rebuildReusedGeoNarrative } from './audit-runner'
import type { BusinessContext, ClearSignalReport } from './schemas'

export async function rerenderStoredAuditReport(auditId: string): Promise<{
  validation_warnings: string[]
}> {
  const { data: audit, error } = await supabaseAdmin
    .from('audits')
    .select('id, report, business_context')
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
  const report: ClearSignalReport = {
    ...existing,
    meta: {
      ...existing.meta,
      business_context: businessContext ?? existing.meta.business_context,
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
    throw new Error(`Report validation blocked re-render: ${validation.errors.slice(0, 5).join('; ')}`)
  }

  const finalReport: ClearSignalReport = {
    ...validation.report,
    validation_warnings: [...validation.errors, ...validation.warnings].slice(0, 50),
  }

  const { error: updateError } = await supabaseAdmin
    .from('audits')
    .update({
      report: finalReport,
      audit_status: 'awaiting_review',
    })
    .eq('id', auditId)

  if (updateError) {
    throw new Error(`Failed to save re-rendered report: ${updateError.message}`)
  }

  return { validation_warnings: finalReport.validation_warnings ?? [] }
}
