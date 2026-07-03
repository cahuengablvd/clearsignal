import { runFullAudit } from './audit-runner'
import { supabaseAdmin } from './supabase'
import type { AuditTrigger } from './audit-execution'

const isProduction = process.env.NODE_ENV === 'production'

export type EnqueueAuditOptions = {
  reuseGeoEvidence?: boolean
  trigger?: AuditTrigger
  endpoint?: string
}

/**
 * Kick off a paid audit.
 *
 * Production requires Trigger.dev so paid audits are durable and retryable.
 * If enqueue fails, keep the audit queued and throw so Stripe can retry the
 * webhook. Local development falls back to the old in-process runner.
 */
export async function enqueueAudit(auditId: string, opts: EnqueueAuditOptions = {}): Promise<void> {
  if (process.env.TRIGGER_SECRET_KEY) {
    try {
      const { runAuditTask } = await import('../trigger/audit-task')
      await runAuditTask.trigger({
        auditId,
        reuseGeoEvidence: opts.reuseGeoEvidence ?? false,
        trigger: opts.trigger ?? 'unknown',
        endpoint: opts.endpoint,
      })
      console.log('[audit-queue] enqueued via Trigger.dev:', auditId)
      return
    } catch (err) {
      console.error('[audit-queue] Trigger.dev enqueue failed for', auditId, err)

      if (isProduction) {
        await markQueued(auditId)
        throw err
      }

      console.warn('[audit-queue] dev fallback: running in-process')
    }
  } else if (isProduction) {
    console.error('[audit-queue] TRIGGER_SECRET_KEY is not set in production; leaving audit queued:', auditId)
    await markQueued(auditId)
    throw new Error('Trigger.dev is not configured in production')
  }

  runFullAudit(auditId, { ...opts, trigger: opts.trigger ?? 'dev_fallback' }).catch((err) => {
    console.error('[audit-queue] in-process runFullAudit failed for', auditId, err)
  })
}

async function markQueued(auditId: string) {
  const { error } = await supabaseAdmin
    .from('audits')
    .update({ audit_status: 'queued', processing_started_at: null })
    .eq('id', auditId)

  if (error) {
    console.error('[audit-queue] failed to mark audit queued:', error)
  }
}
