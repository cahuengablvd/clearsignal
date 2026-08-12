import { queue, task } from '@trigger.dev/sdk'
import { runFullAudit } from '../lib/audit-runner'
import type { AuditTrigger } from '../lib/audit-execution'

export const fullAuditQueue = queue({
  name: 'full-audit',
  concurrencyLimit: 1,
})

type AuditTaskPayload = { auditId: string; reuseGeoEvidence?: boolean; trigger?: AuditTrigger; endpoint?: string }
type DeploymentIdentity = { version: string; shortCode: string; git?: { commitSha?: string } }

export async function runAuditWithDeployment(payload: AuditTaskPayload, deployment?: DeploymentIdentity) {
  await runFullAudit(payload.auditId, {
    reuseGeoEvidence: payload.reuseGeoEvidence ?? false,
    trigger: payload.trigger ?? 'unknown',
    endpoint: payload.endpoint ?? 'trigger:run-full-audit',
    engineVersion: deployment?.version,
    engineCommit: deployment?.git?.commitSha,
  })
  return { auditId: payload.auditId, status: 'done' }
}

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
  run: async (payload: AuditTaskPayload, { ctx }) => runAuditWithDeployment(payload, ctx.deployment),
})
