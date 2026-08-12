import { supabaseAdmin } from './supabase'
import { estimateCostUsd, type CostEvent } from './cost-tracker'
import { appendAdminNote } from './admin-notes'
import { notify } from './notify'
import { logSupabaseWriteFailure } from './supabase-write'

export type AnthropicRequestMeta = {
  auditId?: string | null
  stage: string
  trigger?: string
  recoveryAttempt?: number | null
  workerId?: string
  endpoint?: string
}

export function workerId(): string {
  return process.env.TRIGGER_RUN_ID || process.env.VERCEL_REGION || process.env.HOSTNAME || 'unknown-worker'
}

function requestIdFrom(value: unknown): string | null {
  const obj = value as Record<string, unknown> | null | undefined
  return (
    (typeof obj?.request_id === 'string' && obj.request_id) ||
    (typeof obj?._request_id === 'string' && obj._request_id) ||
    (typeof obj?.requestId === 'string' && obj.requestId) ||
    null
  )
}

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

function roundUsd(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000
}

const COST_ALERT_MARKER = '[cost-alert]'

export type AuditAiCostSummary = {
  totalUsd: number
  callCount: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
}

export async function reconcileAuditAiCost(auditId: string): Promise<AuditAiCostSummary | null> {
  const { data: logs, error } = await supabaseAdmin
    .from('audit_ai_call_logs')
    .select('estimated_cost_usd,input_tokens,output_tokens,cache_read_tokens,cache_creation_tokens')
    .eq('audit_id', auditId)

  if (error) {
    console.warn('[audit-cost] failed to read AI call logs:', error.message)
    return null
  }

  const summary: AuditAiCostSummary = {
    totalUsd: roundUsd((logs || []).reduce((sum, row) => sum + Number(row.estimated_cost_usd ?? 0), 0)),
    callCount: logs?.length ?? 0,
    inputTokens: (logs || []).reduce((sum, row) => sum + Number(row.input_tokens ?? 0), 0),
    outputTokens: (logs || []).reduce((sum, row) => sum + Number(row.output_tokens ?? 0), 0),
    cacheReadTokens: (logs || []).reduce((sum, row) => sum + Number(row.cache_read_tokens ?? 0), 0),
    cacheCreationTokens: (logs || []).reduce((sum, row) => sum + Number(row.cache_creation_tokens ?? 0), 0),
  }

  const { data: audit, error: auditError } = await supabaseAdmin
    .from('audits')
    .select('api_cost_usd, admin_notes')
    .eq('id', auditId)
    .single()

  if (auditError) {
    console.warn('[audit-cost] failed to read audit for reconciliation:', auditError.message)
    return summary
  }

  const previousCost = Number(audit?.api_cost_usd ?? 0)
  const costThreshold = envNumber('AUDIT_AI_COST_ALERT_USD', 2.5)
  const callThreshold = envNumber('AUDIT_AI_CALL_ALERT_COUNT', 30)
  const crossedCost = previousCost < costThreshold && summary.totalUsd >= costThreshold
  const crossedCalls = summary.callCount >= callThreshold
  const alreadyAlerted = String(audit?.admin_notes || '').includes(COST_ALERT_MARKER)
  const shouldAlert = !alreadyAlerted && (crossedCost || crossedCalls)
  const now = new Date().toISOString()

  const patch: Record<string, unknown> = {
    api_cost_usd: summary.totalUsd,
  }

  if (shouldAlert) {
    const reason = crossedCost
      ? `estimated AI cost reached $${summary.totalUsd.toFixed(2)}`
      : `AI call count reached ${summary.callCount}`
    patch.admin_notes = appendAdminNote(
      audit?.admin_notes,
      `[${now}] ${COST_ALERT_MARKER} ${reason}; calls=${summary.callCount}; input=${summary.inputTokens}; output=${summary.outputTokens}.`
    )
  }

  const { error: updateError } = await supabaseAdmin
    .from('audits')
    .update(patch)
    .eq('id', auditId)

  if (updateError) {
    console.warn('[audit-cost] failed to update reconciled audit cost:', updateError.message)
  }

  if (shouldAlert) {
    await notify('audit_cost_threshold_exceeded', {
      audit_id: auditId,
      total_usd: summary.totalUsd,
      call_count: summary.callCount,
      input_tokens: summary.inputTokens,
      output_tokens: summary.outputTokens,
      cost_threshold_usd: costThreshold,
      call_threshold: callThreshold,
      reason: crossedCost ? 'cost' : 'call_count',
    })
  }

  return summary
}

export async function logAnthropicCall(args: {
  meta?: AnthropicRequestMeta
  model: string
  purpose: string
  startedAt: string
  finishedAt: string
  usage?: CostEvent
  responseOrError?: unknown
  status: 'succeeded' | 'failed'
  error?: string
}) {
  const event = args.usage
  const payload = {
    audit_id: args.meta?.auditId ?? null,
    request_id: requestIdFrom(args.responseOrError),
    stage: args.meta?.stage ?? args.purpose,
    trigger: args.meta?.trigger ?? null,
    purpose: args.purpose,
    model: args.model,
    started_at: args.startedAt,
    finished_at: args.finishedAt,
    input_tokens: event?.input_tokens ?? 0,
    output_tokens: event?.output_tokens ?? 0,
    cache_read_tokens: event?.cache_read_tokens ?? 0,
    cache_creation_tokens: event?.cache_creation_tokens ?? 0,
    estimated_cost_usd: event ? estimateCostUsd(event) : 0,
    recovery_attempt: args.meta?.recoveryAttempt ?? null,
    worker_id: args.meta?.workerId ?? workerId(),
    endpoint: args.meta?.endpoint ?? null,
    status: args.status,
    error: args.error ? args.error.slice(0, 2000) : null,
  }

  console.log('[anthropic-request]', JSON.stringify({
    auditId: payload.audit_id,
    requestId: payload.request_id,
    stage: payload.stage,
    trigger: payload.trigger,
    model: payload.model,
    startedAt: payload.started_at,
    finishedAt: payload.finished_at,
    inputTokens: payload.input_tokens,
    outputTokens: payload.output_tokens,
    cacheReadTokens: payload.cache_read_tokens,
    cacheCreationTokens: payload.cache_creation_tokens,
    estimatedCostUsd: payload.estimated_cost_usd,
    recoveryAttempt: payload.recovery_attempt,
    workerId: payload.worker_id,
    endpoint: payload.endpoint,
    status: payload.status,
  }))

  try {
    const { error } = await supabaseAdmin.from('audit_ai_call_logs').insert(payload)
    if (error) {
      logSupabaseWriteFailure(error, `audit_ai_call_logs telemetry for audit ${payload.audit_id ?? 'none'}`)
      return
    }

    if (payload.audit_id) {
      await reconcileAuditAiCost(payload.audit_id)
    }
  } catch (err) {
    console.warn(`[db-write] audit_ai_call_logs telemetry for audit ${payload.audit_id ?? 'none'} threw:`, err instanceof Error ? err.message : String(err))
  }
}
