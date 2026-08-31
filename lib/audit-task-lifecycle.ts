import { appendAdminNote } from './admin-notes'
import { supabaseAdmin } from './supabase'
import { requireSupabaseWrite } from './supabase-write'

const TASK_RUNTIME_FAILURE_CODE = 'task_runtime_failure'

/**
 * Advance a durable Trigger run out of queued before work that can fail before
 * runFullAudit() reaches its own processing-state write.
 */
export async function markAuditTaskStarted(auditId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('audits')
    .update({
      audit_status: 'processing',
      processing_started_at: new Date().toISOString(),
    })
    .eq('id', auditId)

  requireSupabaseWrite(error, `audits task start state for audit ${auditId}`)
}

/**
 * runFullAudit() owns normal and validation failures. This is only a fallback
 * for errors that escape it; the processing predicate cannot overwrite its
 * failed-validation, failed, or awaiting_review states.
 */
export async function markUnhandledAuditTaskFailure(auditId: string, message: string): Promise<void> {
  try {
    const { data, error: noteReadError } = await supabaseAdmin
      .from('audits')
      .select('admin_notes')
      .eq('id', auditId)
      .single()
    if (noteReadError) throw new Error(noteReadError.message)

    const { error } = await supabaseAdmin
      .from('audits')
      .update({
        audit_status: 'failed',
        last_generated_at: new Date().toISOString(),
        admin_notes: appendAdminNote(
          data?.admin_notes,
          `[${new Date().toISOString()}] ${TASK_RUNTIME_FAILURE_CODE}: ${message.slice(0, 1500)}`
        ),
      })
      .eq('id', auditId)
      .eq('audit_status', 'processing')

    requireSupabaseWrite(error, `audits task fallback failure state for audit ${auditId}`)
  } catch (failureWriteError) {
    console.error(`Failed to persist task fallback failure state for ${auditId}:`, failureWriteError)
  }
}
