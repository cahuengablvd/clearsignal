import { notify } from './notify'
import { supabaseAdmin } from './supabase'
import { requireSupabaseWrite } from './supabase-write'

export const DEFAULT_DAILY_AI_SPEND_CAP_USD = 5

export type DailyAiSpendStatus = {
  utc_date: string
  spend_usd: number | null
  cap_usd: number
  queue_blocked: boolean
  error?: string
}

export class DailyAiSpendBlockedError extends Error {
  readonly status: DailyAiSpendStatus

  constructor(message: string, status: DailyAiSpendStatus) {
    super(message)
    this.name = 'DailyAiSpendBlockedError'
    this.status = status
  }
}

function configuredCap(): number {
  const raw = process.env.DAILY_AI_SPEND_CAP_USD
  if (!raw?.trim()) return DEFAULT_DAILY_AI_SPEND_CAP_USD
  const configured = Number(raw)
  return Number.isFinite(configured) && configured >= 0
    ? configured
    : DEFAULT_DAILY_AI_SPEND_CAP_USD
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function utcDay(now: Date): { date: string; start: string; end: string } {
  const date = now.toISOString().slice(0, 10)
  const start = `${date}T00:00:00.000Z`
  const endDate = new Date(start)
  endDate.setUTCDate(endDate.getUTCDate() + 1)
  return { date, start, end: endDate.toISOString() }
}

/**
 * Read the aggregate cost for one UTC day. Query bounds are deliberately on
 * created_at so the database can use audit_ai_call_logs_created_at_idx.
 * An unreadable ledger blocks the queue: spending must never proceed blind.
 */
export async function getDailyAiSpendStatus(now = new Date()): Promise<DailyAiSpendStatus> {
  const day = utcDay(now)
  const cap = configuredCap()

  try {
    const { data, error } = await supabaseAdmin
      .from('audit_ai_call_logs')
      .select('estimated_cost_usd')
      .gte('created_at', day.start)
      .lt('created_at', day.end)

    if (error) {
      throw new Error(error.message)
    }

    const spend = roundUsd(
      (data || []).reduce((sum, row) => sum + Number(row.estimated_cost_usd ?? 0), 0)
    )
    return {
      utc_date: day.date,
      spend_usd: spend,
      cap_usd: cap,
      queue_blocked: spend >= cap,
    }
  } catch (err) {
    return {
      utc_date: day.date,
      spend_usd: null,
      cap_usd: cap,
      queue_blocked: true,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

async function keepAuditQueued(auditId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('audits')
    .update({
      audit_status: 'queued',
      queued_at: new Date().toISOString(),
      processing_started_at: null,
    })
    .eq('id', auditId)
  requireSupabaseWrite(error, `daily AI spend guard state for audit ${auditId}`)
}

async function notifyBlockedOnce(
  auditId: string,
  status: DailyAiSpendStatus,
  reason: string
): Promise<void> {
  const { error } = await supabaseAdmin.from('daily_ai_spend_alerts').insert({
    spend_date: status.utc_date,
    observed_spend_usd: status.spend_usd,
    cap_usd: status.cap_usd,
    audit_id: auditId,
    reason,
  })

  // The date is the primary key. A duplicate means today's alert was already
  // claimed by another enqueue or by the Trigger-side start guard.
  if (error?.code === '23505') return
  if (error) {
    console.warn('[daily-ai-spend] failed to claim one-time alert:', error.message)
  }

  await notify('daily_ai_spend_cap_blocked', {
    audit_id: auditId,
    utc_date: status.utc_date,
    spend_usd: status.spend_usd,
    cap_usd: status.cap_usd,
    queue_blocked: true,
    reason,
  })
}

/**
 * Financial fail-closed guard shared by the enqueue path and the Trigger task.
 * The second check prevents a batch queued while spend was low from all
 * starting after earlier tasks consume the daily budget.
 */
export async function enforceDailyAiSpendCap(
  auditId: string,
  now = new Date()
): Promise<DailyAiSpendStatus> {
  const status = await getDailyAiSpendStatus(now)
  if (!status.queue_blocked) return status

  const reason = status.spend_usd == null
    ? `Daily AI spend cap $${status.cap_usd.toFixed(2)} cannot be checked; current UTC-day total is unavailable (${status.error || 'unknown ledger error'}).`
    : `Daily AI spend cap $${status.cap_usd.toFixed(2)} reached; current UTC-day total is $${status.spend_usd.toFixed(2)}.`

  await keepAuditQueued(auditId)
  await notifyBlockedOnce(auditId, status, reason)
  throw new DailyAiSpendBlockedError(reason, status)
}
