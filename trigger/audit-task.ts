import { queue, task } from '@trigger.dev/sdk'
import { runFullAudit } from '../lib/audit-runner'
import type { AuditTrigger } from '../lib/audit-execution'

export const fullAuditQueue = queue({
  name: 'full-audit',
  concurrencyLimit: 1,
})

/**
 * Durable background task for the paid audit. Trigger.dev runs this on its own
 * infra with retries and no 60s serverless cap - so a paid audit can never be
 * lost to a Vercel function timeout after the customer has already been charged.
 */
export const runAuditTask = task({
  id: 'run-full-audit',
  queue: fullAuditQueue,
  maxDuration: 600,
  retry: { maxAttempts: 2 },
  run: async (payload: { auditId: string; reuseGeoEvidence?: boolean; trigger?: AuditTrigger; endpoint?: string }) => {
    await runFullAudit(payload.auditId, {
      reuseGeoEvidence: payload.reuseGeoEvidence ?? false,
      trigger: payload.trigger ?? 'unknown',
      endpoint: payload.endpoint ?? 'trigger:run-full-audit',
    })
    return { auditId: payload.auditId, status: 'done' }
  },
})
