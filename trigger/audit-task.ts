import { task } from '@trigger.dev/sdk'
import { runFullAudit } from '../lib/audit-runner'

/**
 * Durable background task for the paid audit. Trigger.dev runs this on its own
 * infra with retries and no 60s serverless cap — so a paid audit can never be
 * lost to a Vercel function timeout after the customer has already been charged.
 */
export const runAuditTask = task({
  id: 'run-full-audit',
  maxDuration: 600,
  retry: { maxAttempts: 2 },
  run: async (payload: { auditId: string }) => {
    await runFullAudit(payload.auditId)
    return { auditId: payload.auditId, status: 'done' }
  },
})
