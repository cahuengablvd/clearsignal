import { runFullAudit } from './audit-runner'
import type { AuditTrigger } from './audit-execution'
import { enforceDailyAiSpendCap } from './daily-ai-spend'

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
 * State transitions belong to the caller so an enqueue failure cannot overwrite
 * a recovery claim or a task that has already started. Local development falls
 * back to the old in-process runner.
 */
export async function enqueueAudit(auditId: string, opts: EnqueueAuditOptions = {}): Promise<void> {
  await enforceDailyAiSpendCap(auditId)

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
        throw err
      }

      console.warn('[audit-queue] dev fallback: running in-process')
    }
  } else if (isProduction) {
    console.error('[audit-queue] TRIGGER_SECRET_KEY is not set in production:', auditId)
    throw new Error('Trigger.dev is not configured in production')
  }

  runFullAudit(auditId, { ...opts, trigger: opts.trigger ?? 'dev_fallback' }).catch((err) => {
    console.error('[audit-queue] in-process runFullAudit failed for', auditId, err)
  })
}
