import { supabaseAdmin } from './supabase'
import { workerId } from './ai-observability'
import { logSupabaseWriteFailure } from './supabase-write'

export type AuditTrigger =
  | 'paid_webhook'
  | 'manual_create'
  | 'admin_regenerate'
  | 'recovery'
  | 'dev_fallback'
  | 'unknown'

export type AuditExecutionContext = {
  auditId: string
  attempt: number
  trigger: AuditTrigger
  workerId: string
  endpoint?: string
}

export function auditExecutionContext(args: {
  auditId: string
  attempt?: number | null
  trigger?: AuditTrigger
  endpoint?: string
}): AuditExecutionContext {
  return {
    auditId: args.auditId,
    attempt: args.attempt ?? 0,
    trigger: args.trigger ?? 'unknown',
    workerId: workerId(),
    endpoint: args.endpoint,
  }
}

type ClaimResult = {
  claimed?: boolean
  alreadyCompleted?: boolean
  active?: boolean
  executionKey?: string
  claimToken?: string
  result?: unknown
}

export async function runAuditStage<T>(
  ctx: AuditExecutionContext,
  stage: string,
  run: () => Promise<T>,
  validateStored?: (value: unknown) => T
): Promise<T> {
  const { data, error } = await supabaseAdmin.rpc('claim_audit_stage_execution', {
    p_audit_id: ctx.auditId,
    p_stage: stage,
    p_attempt: ctx.attempt,
    p_trigger: ctx.trigger,
    p_worker_id: ctx.workerId,
    p_ttl_seconds: 1800,
  })

  if (error) {
    throw new Error(`Failed to claim audit stage ${stage}: ${error.message}`)
  }

  const claim = data as ClaimResult

  if (claim.alreadyCompleted) {
    if (validateStored) return validateStored(claim.result)
    return claim.result as T
  }

  if (!claim.claimed || !claim.claimToken || !claim.executionKey) {
    throw new Error(`Audit stage already active: ${ctx.auditId}:${stage}:${ctx.attempt}`)
  }

  try {
    const result = await run()
    const { error: completeError } = await supabaseAdmin
      .from('audit_stage_executions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('execution_key', claim.executionKey)
      .eq('claim_token', claim.claimToken)

    if (completeError) {
      throw new Error(`Failed to persist completed audit stage ${stage}: ${completeError.message}`)
    }

    return result
  } catch (err) {
    const { error: failedStageWriteError } = await supabaseAdmin
      .from('audit_stage_executions')
      .update({
        status: 'failed',
        failed_at: new Date().toISOString(),
        error: err instanceof Error ? err.message.slice(0, 2000) : String(err).slice(0, 2000),
        updated_at: new Date().toISOString(),
      })
      .eq('execution_key', claim.executionKey)
      .eq('claim_token', claim.claimToken)
    logSupabaseWriteFailure(failedStageWriteError, `audit_stage_executions failure for audit ${ctx.auditId}, stage ${stage}`)
    throw err
  }
}
