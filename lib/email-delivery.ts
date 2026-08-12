import { supabaseAdmin } from './supabase'
import { sendReportEmail } from './resend'
import { notify } from './notify'
import { appendAdminNote } from './admin-notes'
import { requireSupabaseWrite, logSupabaseWriteFailure } from './supabase-write'

export async function deliverAuditEmail(auditId: string): Promise<void> {
  const { data: audit, error } = await supabaseAdmin
    .from('audits')
    .select('id, email, url, admin_notes, report')
    .eq('id', auditId)
    .single()

  if (error || !audit) {
    throw new Error(`Audit ${auditId} not found: ${error?.message || 'missing row'}`)
  }
  if (!audit.report) {
    throw new Error(`Audit ${auditId} has no report to deliver`)
  }

  try {
    await sendReportEmail(audit.email, auditId, audit.url)
    const { error: deliveredWriteError } = await supabaseAdmin
      .from('audits')
      .update({ audit_status: 'delivered', last_delivered_at: new Date().toISOString() })
      .eq('id', auditId)
    requireSupabaseWrite(deliveredWriteError, `audits delivery state for audit ${auditId}`)
  } catch (emailErr) {
    const errorMessage = emailErr instanceof Error ? emailErr.message : String(emailErr)
    const { error: failedWriteError } = await supabaseAdmin
      .from('audits')
      .update({
        audit_status: 'delivery_failed',
        admin_notes: appendAdminNote(
          audit.admin_notes,
          `[${new Date().toISOString()}] Email delivery failed: ${errorMessage}`
        ),
      })
      .eq('id', auditId)
    logSupabaseWriteFailure(failedWriteError, `audits delivery failure state for audit ${auditId}`)
    await notify('email_delivery_failed', {
      audit_id: auditId,
      email: audit.email,
      error: errorMessage,
    })
    throw emailErr
  }
}
