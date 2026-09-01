/** Shared paid-audit recovery logic, with an atomic processing timestamp claim. */
import { supabaseAdmin } from './supabase'
import { enqueueAudit } from './audit-queue'
import { notify } from './notify'
import { appendAdminNote } from './admin-notes'
import { requireSupabaseWrite } from './supabase-write'

export const STALE_PROCESSING_MS = 20 * 60 * 1000
export const STALE_QUEUED_MS = STALE_PROCESSING_MS
export const MAX_RECOVERY_ATTEMPTS = 2
export const DETERMINISTIC_FAILURE_OVERRIDE_MARKER = 'Deterministic failure override'

type RecoverableAudit = {
  id: string; audit_status: string; created_at: string; queued_at?: string | null
  last_generated_at?: string | null; processing_started_at?: string | null
  recovery_attempts?: number | null; admin_notes?: string | null
}

export type RecoveryClaim = { auditId: string; claimedAt: string; kind: 'manual' | 'queued' | 'processing' }
export type RecoveryClaimRequest =
  | { kind: 'manual'; auditId: string; observedStatus: string; now?: Date }
  | { kind: 'queued'; audit: RecoverableAudit; cutoff: string; now?: Date }
  | { kind: 'processing'; audit: RecoverableAudit; cutoff: string; now?: Date }

export interface RecoverySummary {
  found: number; queued: number; stale_processing: number; re_enqueued: number; failed: number
  exhausted: number; deterministic_skipped: number; errors: { id: string; error: string }[]
}

export function isDeterministicAuditFailure(notes: string | null | undefined): boolean {
  if (!notes) return false
  const currentFailureWindow = notes.split(DETERMINISTIC_FAILURE_OVERRIDE_MARKER).at(-1) ?? notes
  return /query_plan_insufficient/i.test(currentFailureWindow) || /Report validation blocked/i.test(currentFailureWindow) || /zod|schema|invalid enum|invalid literal|expected .* received|Claude output failed validation/i.test(currentFailureWindow)
}
export function recoveryAttemptsExhausted(attempts: number | null | undefined): boolean { return (attempts ?? 0) >= MAX_RECOVERY_ATTEMPTS }
export function isProcessingStale(audit: Pick<RecoverableAudit, 'processing_started_at'>, now = Date.now()): boolean {
  return Boolean(audit.processing_started_at) && new Date(audit.processing_started_at!).getTime() < now - STALE_PROCESSING_MS
}
export function isQueuedStale(audit: Pick<RecoverableAudit, 'queued_at' | 'last_generated_at' | 'created_at'>, now = Date.now()): boolean {
  const queuedSince = audit.queued_at || audit.last_generated_at || audit.created_at
  return Boolean(queuedSince) && new Date(queuedSince!).getTime() < now - STALE_QUEUED_MS
}

/** Returns ownership only when the conditional update changed exactly one row. */
export async function claimAuditRecovery(request: RecoveryClaimRequest): Promise<RecoveryClaim | null> {
  const claimedAt = (request.now ?? new Date()).toISOString()
  let query: any
  if (request.kind === 'manual') {
    query = supabaseAdmin.from('audits').update({ audit_status: 'processing', processing_started_at: claimedAt, recovery_attempts: 0, trigger_run_id: null })
      .eq('id', request.auditId).eq('audit_status', request.observedStatus)
  } else {
    const attempts = request.audit.recovery_attempts ?? 0
    query = supabaseAdmin.from('audits').update({ audit_status: 'processing', processing_started_at: claimedAt, recovery_attempts: attempts + 1, trigger_run_id: null })
      .eq('id', request.audit.id).eq('audit_status', request.kind === 'queued' ? 'queued' : 'processing').eq('recovery_attempts', attempts)
    query = request.kind === 'queued' ? query.lt('queued_at', request.cutoff) : query.lt('processing_started_at', request.cutoff)
  }
  const { data, error } = await query.select('id')
  requireSupabaseWrite(error, `audits ${request.kind} recovery claim`)
  if (!data || data.length !== 1) return null
  return { auditId: request.kind === 'manual' ? request.auditId : request.audit.id, claimedAt, kind: request.kind }
}

/** Release only the exact claim owner; a started task refreshes this fence. */
export async function releaseAuditRecoveryClaim(claim: RecoveryClaim): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('audits')
    .update({ audit_status: 'queued', queued_at: new Date().toISOString(), processing_started_at: null, trigger_run_id: null })
    .eq('id', claim.auditId).eq('audit_status', 'processing').eq('processing_started_at', claim.claimedAt).select('id')
  requireSupabaseWrite(error, `audits ${claim.kind} recovery claim release for audit ${claim.auditId}`)
  return Boolean(data?.length)
}

async function markRecoveryStopped(audit: RecoverableAudit, reason: string) {
  const { error } = await supabaseAdmin.from('audits').update({
    audit_status: 'failed', admin_notes: appendAdminNote(audit.admin_notes, `[${new Date().toISOString()}] Recovery stopped: ${reason}`),
  }).eq('id', audit.id)
  requireSupabaseWrite(error, `audits recovery stop state for audit ${audit.id}`)
}

export async function recoverStuckAudits(): Promise<RecoverySummary> {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS).toISOString()
  const [{ data: queued, error: qErr }, { data: staleProcessing, error: pErr }] = await Promise.all([
    supabaseAdmin.from('audits').select('id, audit_status, created_at, queued_at, last_generated_at, processing_started_at, recovery_attempts, admin_notes').eq('audit_status', 'queued'),
    supabaseAdmin.from('audits').select('id, audit_status, created_at, processing_started_at, recovery_attempts, admin_notes').eq('audit_status', 'processing').lt('processing_started_at', cutoff),
  ])
  if (qErr || pErr) throw new Error(`Failed to query audits: ${qErr?.message || pErr?.message}`)
  const staleQueued = ((queued || []) as RecoverableAudit[]).filter((audit) => isQueuedStale(audit))
  const byId = new Map<string, RecoverableAudit>()
  for (const audit of [...staleQueued, ...((staleProcessing || []) as RecoverableAudit[])]) byId.set(audit.id, audit)
  const audits = [...byId.values()]
  let reEnqueued = 0; let exhausted = 0; let deterministicSkipped = 0
  const errors: { id: string; error: string }[] = []
  for (const audit of audits) {
    if (isDeterministicAuditFailure(audit.admin_notes)) {
      deterministicSkipped += 1
      const reason = 'latest failure looks deterministic (schema/validation); manual fix required'
      await markRecoveryStopped(audit, reason); await notify('audit_recovery_failed', { audit_id: audit.id, error: reason }); continue
    }
    if (recoveryAttemptsExhausted(audit.recovery_attempts)) {
      exhausted += 1
      const reason = `recovery attempt budget exhausted (${audit.recovery_attempts ?? 0}/${MAX_RECOVERY_ATTEMPTS})`
      await markRecoveryStopped(audit, reason); await notify('audit_recovery_failed', { audit_id: audit.id, error: reason }); continue
    }
    const kind = audit.audit_status === 'queued' ? 'queued' : 'processing'
    let claim: RecoveryClaim | null = null
    try {
      claim = await claimAuditRecovery({ kind, audit, cutoff })
      if (!claim) continue
      await enqueueAudit(audit.id, { reuseGeoEvidence: false, trigger: 'recovery', endpoint: 'audit-recovery' })
      reEnqueued += 1
    } catch (err) {
      if (claim) await releaseAuditRecoveryClaim(claim)
      const message = err instanceof Error ? err.message : String(err)
      errors.push({ id: audit.id, error: message }); await notify('audit_recovery_failed', { audit_id: audit.id, error: message })
    }
  }
  return { found: audits.length, queued: staleQueued.length, stale_processing: staleProcessing?.length ?? 0, re_enqueued: reEnqueued, failed: errors.length + exhausted + deterministicSkipped, exhausted, deterministic_skipped: deterministicSkipped, errors }
}
