/**
 * Shared paid-audit recovery logic.
 *
 * Finds audits that never completed - anything still `queued`, plus anything
 * `processing` older than the stale TTL measured from processing_started_at -
 * and re-enqueues each while respecting a retry budget. Used by both the admin
 * endpoint and the recovery cron so there is a single source of truth.
 */
import { supabaseAdmin } from './supabase'
import { enqueueAudit } from './audit-queue'
import { notify } from './notify'
import { appendAdminNote } from './admin-notes'
import { requireSupabaseWrite } from './supabase-write'

// An audit stuck in `processing` longer than this is considered stale.
export const STALE_PROCESSING_MS = 20 * 60 * 1000
export const MAX_RECOVERY_ATTEMPTS = 2
export const DETERMINISTIC_FAILURE_OVERRIDE_MARKER = 'Deterministic failure override'

type RecoverableAudit = {
  id: string
  audit_status: string
  created_at: string
  processing_started_at?: string | null
  recovery_attempts?: number | null
  admin_notes?: string | null
}

export interface RecoverySummary {
  found: number
  queued: number
  stale_processing: number
  re_enqueued: number
  failed: number
  exhausted: number
  deterministic_skipped: number
  errors: { id: string; error: string }[]
}

export function isDeterministicAuditFailure(notes: string | null | undefined): boolean {
  if (!notes) return false
  // Keep the original failure in the audit trail. An explicit operator override
  // releases only failures recorded before it; a later deterministic failure
  // blocks recovery again.
  const currentFailureWindow = notes.split(DETERMINISTIC_FAILURE_OVERRIDE_MARKER).at(-1) ?? notes
  // A report-validation block is deterministic for the stored payload. Retrying
  // generation immediately only repeats the same failure and spends the budget.
  return /Report validation blocked/i.test(currentFailureWindow) || /zod|schema|invalid enum|invalid literal|expected .* received|Claude output failed validation/i.test(currentFailureWindow)
}

export function recoveryAttemptsExhausted(attempts: number | null | undefined): boolean {
  return (attempts ?? 0) >= MAX_RECOVERY_ATTEMPTS
}

export function isProcessingStale(
  audit: Pick<RecoverableAudit, 'processing_started_at'>,
  now = Date.now()
): boolean {
  if (!audit.processing_started_at) return false
  return new Date(audit.processing_started_at).getTime() < now - STALE_PROCESSING_MS
}

async function markRecoveryStopped(
  audit: RecoverableAudit,
  reason: string,
  extra: Record<string, unknown> = {}
) {
  const { error } = await supabaseAdmin
    .from('audits')
    .update({
      audit_status: 'failed',
      admin_notes: appendAdminNote(
        audit.admin_notes,
        `[${new Date().toISOString()}] Recovery stopped: ${reason}`
      ),
      ...extra,
    })
    .eq('id', audit.id)
  requireSupabaseWrite(error, `audits recovery stop state for audit ${audit.id}`)
}

export async function recoverStuckAudits(): Promise<RecoverySummary> {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS).toISOString()

  const [{ data: queued, error: qErr }, { data: staleProcessing, error: pErr }] = await Promise.all([
    supabaseAdmin
      .from('audits')
      .select('id, audit_status, created_at, processing_started_at, recovery_attempts, admin_notes')
      .eq('audit_status', 'queued'),
    supabaseAdmin
      .from('audits')
      .select('id, audit_status, created_at, processing_started_at, recovery_attempts, admin_notes')
      .eq('audit_status', 'processing')
      .lt('processing_started_at', cutoff),
  ])

  if (qErr || pErr) {
    throw new Error(`Failed to query audits: ${qErr?.message || pErr?.message}`)
  }

  // De-dupe by id (shouldn't overlap, but be safe).
  const byId = new Map<string, RecoverableAudit>()
  for (const audit of [...((queued || []) as RecoverableAudit[]), ...((staleProcessing || []) as RecoverableAudit[])]) {
    byId.set(audit.id, audit)
  }
  const audits = [...byId.values()]

  let reEnqueued = 0
  let exhausted = 0
  let deterministicSkipped = 0
  const errors: { id: string; error: string }[] = []

  for (const audit of audits) {
    if (isDeterministicAuditFailure(audit.admin_notes)) {
      deterministicSkipped += 1
      const reason = 'latest failure looks deterministic (schema/validation); manual fix required'
      await markRecoveryStopped(audit, reason)
      await notify('audit_recovery_failed', { audit_id: audit.id, error: reason })
      continue
    }

    if (recoveryAttemptsExhausted(audit.recovery_attempts)) {
      exhausted += 1
      const reason = `recovery attempt budget exhausted (${audit.recovery_attempts ?? 0}/${MAX_RECOVERY_ATTEMPTS})`
      await markRecoveryStopped(audit, reason)
      await notify('audit_recovery_failed', { audit_id: audit.id, error: reason })
      continue
    }

    try {
      await enqueueAudit(audit.id, { trigger: 'recovery', endpoint: 'audit-recovery' })
      const { error } = await supabaseAdmin
        .from('audits')
        .update({ recovery_attempts: (audit.recovery_attempts ?? 0) + 1 })
        .eq('id', audit.id)
      requireSupabaseWrite(error, `audits recovery attempt for audit ${audit.id}`)
      reEnqueued += 1
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push({ id: audit.id, error: message })
      await notify('audit_recovery_failed', { audit_id: audit.id, error: message })
    }
  }

  return {
    found: audits.length,
    queued: queued?.length ?? 0,
    stale_processing: staleProcessing?.length ?? 0,
    re_enqueued: reEnqueued,
    failed: errors.length + exhausted + deterministicSkipped,
    exhausted,
    deterministic_skipped: deterministicSkipped,
    errors,
  }
}
