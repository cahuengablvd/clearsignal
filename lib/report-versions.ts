import { supabaseAdmin } from './supabase'

export type ReportVersionType = 'generated' | 'regenerated' | 'rerendered' | 'approved' | 'manual'

export async function archiveCurrentReportVersion(args: {
  auditId: string
  report: unknown
  auditStatus?: string | null
  versionType: ReportVersionType
}): Promise<void> {
  if (!args.report) return
  const { error } = await supabaseAdmin.from('report_versions').insert({
    audit_id: args.auditId,
    version_type: args.versionType,
    report: args.report,
    audit_status: args.auditStatus ?? null,
  })
  if (error) {
    console.warn(`[report-versions] failed to archive report for ${args.auditId}:`, error.message)
  }
}
