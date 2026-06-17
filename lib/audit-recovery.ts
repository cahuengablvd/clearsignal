/**
 * Shared paid-audit recovery logic.
 *
 * Finds audits that never completed - anything still `queued`, plus anything
 * `processing` older than the stale TTL (a normal audit finishes in 1-3 min) -
 * and re-enqueues each. Used by both the admin endpoint and the recovery cron
 * so there is a single source of truth.
 */
import { supabaseAdmin } from './supabase'
import { enqueueAudit } from './audit-queue'
import { notify } from './notify'

// An audit stuck in `processing` longer than this is considered stale.
export const STALE_PROCESSING_MS = 20 * 60 * 1000

export interface RecoverySummary {
  found: number
  queued: number
  stale_processing: number
  re_enqueued: number
  failed: number
  errors: { id: string; error: string }[]
}

export async function recoverStuckAudits(): Promise<RecoverySummary> {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS).toISOString()

  const [{ data: queued, error: qErr }, { data: staleProcessing, error: pErr }] = await Promise.all([
    supabaseAdmin.from('audits').select('id, created_at').eq('audit_status', 'queued'),
    supabaseAdmin
      .from('audits')
      .select('id, created_at')
      .eq('audit_status', 'processing')
      .lt('created_at', cutoff),
  ])

  if (qErr || pErr) {
    throw new Error(`Failed to query audits: ${qErr?.message || pErr?.message}`)
  }

  // De-dupe by id (shouldn't overlap, but be safe).
  const ids = [...new Set([...(queued || []), ...(staleProcessing || [])].map((a) => a.id))]

  let reEnqueued = 0
  const errors: { id: string; error: string }[] = []

  for (const id of ids) {
    try {
      await enqueueAudit(id)
      reEnqueued += 1
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push({ id, error: message })
      await notify('audit_recovery_failed', { audit_id: id, error: message })
    }
  }

  return {
    found: ids.length,
    queued: queued?.length ?? 0,
    stale_processing: staleProcessing?.length ?? 0,
    re_enqueued: reEnqueued,
    failed: errors.length,
    errors,
  }
}
