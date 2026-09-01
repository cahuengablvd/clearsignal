import { AbortTaskRunError, queue, task } from '@trigger.dev/sdk'
import { runFullAudit } from '../lib/audit-runner'
import type { AuditTrigger } from '../lib/audit-execution'
import { isDeterministicAuditFailure } from '../lib/audit-recovery'
import { DailyAiSpendBlockedError, enforceDailyAiSpendCap } from '../lib/daily-ai-spend'
import { markAuditTaskSpendBlocked, markAuditTaskStarted, markUnhandledAuditTaskFailure } from '../lib/audit-task-lifecycle'

export const fullAuditQueue = queue({
  name: 'full-audit',
  concurrencyLimit: 1,
})

type AuditTaskPayload = { auditId: string; reuseGeoEvidence?: boolean; trigger?: AuditTrigger; endpoint?: string }
type DeploymentIdentity = { version: string; shortCode: string; git?: { commitSha?: string } }
const AUDIT_TASK_MAX_ATTEMPTS = 2

export async function runAuditWithDeployment(payload: AuditTaskPayload, deployment?: DeploymentIdentity, taskAttempt = { number: 1, runId: 'local-trigger-run' }) {
  let processingStartedAt: string | null = null
  try {
    processingStartedAt = await markAuditTaskStarted(payload.auditId, { triggerRunId: taskAttempt.runId, attempt: taskAttempt.number })
    await enforceDailyAiSpendCap(payload.auditId)
    await runFullAudit(payload.auditId, {
      reuseGeoEvidence: payload.reuseGeoEvidence ?? false,
      trigger: payload.trigger ?? 'unknown',
      endpoint: payload.endpoint ?? 'trigger:run-full-audit',
      engineVersion: deployment?.version,
      engineCommit: deployment?.git?.commitSha,
      deferTransientFailure: taskAttempt.number < AUDIT_TASK_MAX_ATTEMPTS,
      triggerRunId: taskAttempt.runId,
    })
    return { auditId: payload.auditId, status: 'done' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (err instanceof DailyAiSpendBlockedError) {
      if (processingStartedAt) await markAuditTaskSpendBlocked(payload.auditId, processingStartedAt, taskAttempt.runId)
      throw new AbortTaskRunError(message)
    }
    if (isDeterministicAuditFailure(message)) {
      throw new AbortTaskRunError(message)
    }
    if (processingStartedAt && taskAttempt.number >= AUDIT_TASK_MAX_ATTEMPTS) {
      await markUnhandledAuditTaskFailure(payload.auditId, message, taskAttempt.runId)
    }
    throw err
  }
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
  retry: { maxAttempts: AUDIT_TASK_MAX_ATTEMPTS },
  run: async (payload: AuditTaskPayload, { ctx }) => runAuditWithDeployment(payload, ctx.deployment, { number: ctx.attempt.number, runId: ctx.run.id }),
})
