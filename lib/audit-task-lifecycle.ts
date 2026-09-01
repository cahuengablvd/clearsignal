import { appendAdminNote } from './admin-notes'
import { supabaseAdmin } from './supabase'
import { requireSupabaseWrite } from './supabase-write'

const TASK_RUNTIME_FAILURE_CODE = 'task_runtime_failure'

/**
 * Advance a durable Trigger run out of queued before work that can fail before
 * runFullAudit() reaches its own processing-state write.
 */
export async function markAuditTaskStarted(auditId: string, args: { triggerRunId: string; attempt: number }): Promise<string> {
  const processingStartedAt = new Date().toISOString()
  const isFirstAttempt = args.attempt === 1
  let query = supabaseAdmin
    .from('audits')
    .update({
      audit_status: 'processing',
      processing_started_at: processingStartedAt,
      trigger_run_id: args.triggerRunId,
    })
    .eq('id', auditId)

  // A first Trigger attempt may take a queued audit or an atomically claimed
  // manual/recovery audit that has no Trigger owner yet. A retry can only take
  // the exact Trigger run that owns the current processing state.
  query = isFirstAttempt
    ? (query as any).is('trigger_run_id', null).in('audit_status', ['queued', 'processing'])
    : (query as any).eq('trigger_run_id', args.triggerRunId)
  const { data, error } = await query.select('id')

  requireSupabaseWrite(error, `audits task start state for audit ${auditId}`)
  if (!data?.length) throw new Error(`Audit task start claim lost for audit ${auditId}`)
  return processingStartedAt
}

/** Return a spend-blocked task to the queue without clobbering later work. */
export async function markAuditTaskSpendBlocked(auditId: string, processingStartedAt: string, triggerRunId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('audits')
    .update({ audit_status: 'queued', queued_at: new Date().toISOString(), processing_started_at: null, trigger_run_id: null })
    .eq('id', auditId)
    .eq('audit_status', 'processing')
    .eq('processing_started_at', processingStartedAt)
    .eq('trigger_run_id', triggerRunId)
  requireSupabaseWrite(error, `audits task spend-blocked queue state for audit ${auditId}`)
}

/**
 * runFullAudit() owns normal and validation failures. This is only a fallback
 * for errors that escape it; the processing predicate cannot overwrite its
 * failed-validation, failed, or awaiting_review states.
 */
export async function markUnhandledAuditTaskFailure(auditId: string, message: string, triggerRunId: string): Promise<void> {
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
      .eq('trigger_run_id', triggerRunId)

    requireSupabaseWrite(error, `audits task fallback failure state for audit ${auditId}`)
  } catch (failureWriteError) {
    console.error(`Failed to persist task fallback failure state for ${auditId}:`, failureWriteError)
  }
}
