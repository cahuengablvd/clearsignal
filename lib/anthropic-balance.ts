import { Resend } from 'resend'
import { notify } from './notify'
import { supabaseAdmin } from './supabase'

type BalanceStatus = 'ok' | 'warning' | 'critical' | 'unknown'

export type AnthropicBalanceCheck = {
  balance: number
  monthly_spend_usd?: number
  monthly_budget_usd?: number
  status: BalanceStatus
  message: string
}

const DEFAULT_THRESHOLD = 10
const DEFAULT_MONTHLY_BUDGET = 50
const DEFAULT_USAGE_URL = 'https://api.anthropic.com/v1/organizations/usage_report/messages'

function threshold(): number {
  const raw = Number(process.env.ANTHROPIC_BALANCE_ALERT_THRESHOLD ?? DEFAULT_THRESHOLD)
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_THRESHOLD
}

function monthlyBudget(): number {
  const raw = Number(process.env.MONTHLY_BUDGET_USD ?? DEFAULT_MONTHLY_BUDGET)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MONTHLY_BUDGET
}

function adminEmail(): string | undefined {
  return process.env.ADMIN_ALERT_EMAIL || process.env.ADMIN_EMAIL
}

function statusFor(balance: number): BalanceStatus {
  if (balance <= 0) return 'critical'
  return balance < threshold() ? 'warning' : 'ok'
}

function parseBalance(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null
  const root = data as Record<string, unknown>
  const candidates = [
    root.balance,
    root.remaining_balance,
    root.credit_balance,
    root.available_balance,
    root.remaining_credits,
    root.remaining,
  ]

  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const n = Number(value.replace(/[$,]/g, ''))
      if (Number.isFinite(n)) return n
    }
  }

  return null
}

async function sendEmail(message: string) {
  const to = adminEmail()
  if (!to || !process.env.RESEND_API_KEY) return
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: process.env.RESEND_FROM || 'ClearSignal <reports@clearsignal.dev>',
      to,
      subject: 'ClearSignal Anthropic usage alert',
      text: message,
    })
  } catch (err) {
    console.error('[anthropic-balance] failed to send email alert:', err)
  }
}

async function sendTelegram(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    })
  } catch (err) {
    console.error('[anthropic-balance] failed to send Telegram alert:', err)
  }
}

async function alertIfNeeded(result: AnthropicBalanceCheck) {
  if (result.status !== 'warning' && result.status !== 'critical') return
  await Promise.all([
    sendEmail(result.message),
    sendTelegram(result.message),
    notify('anthropic_balance_warning', {
      balance: result.balance,
      status: result.status,
      message: result.message,
    }),
  ])
}

export async function checkMonthlyAuditBudget(now = new Date()): Promise<AnthropicBalanceCheck> {
  const budget = monthlyBudget()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()

  const { data, error } = await supabaseAdmin
    .from('audits')
    .select('api_cost_usd')
    .gte('created_at', start)
    .lt('created_at', end)
    .not('api_cost_usd', 'is', null)

  if (error) {
    const result = {
      balance: NaN,
      monthly_spend_usd: NaN,
      monthly_budget_usd: budget,
      status: 'unknown' as const,
      message: `Monthly audit budget: unknown (${error.message})`,
    }
    console.warn(`[anthropic-balance] ${result.message}`)
    return result
  }

  const spend = (data || []).reduce((sum, row) => sum + Number(row.api_cost_usd || 0), 0)
  const remaining = budget - spend
  const ratio = budget > 0 ? spend / budget : 0
  const status: BalanceStatus = ratio >= 1 ? 'critical' : ratio >= 0.8 ? 'warning' : 'ok'
  const result = {
    balance: remaining,
    monthly_spend_usd: Math.round(spend * 100) / 100,
    monthly_budget_usd: budget,
    status,
    message: `Monthly audit spend: $${spend.toFixed(2)} / $${budget.toFixed(2)}, remaining: $${remaining.toFixed(2)}, status: ${status.toUpperCase()}`,
  }
  console.log(`[anthropic-balance] ${result.message}`)
  await alertIfNeeded(result)
  return result
}

/**
 * Best-effort Anthropic usage/balance guard.
 *
 * Anthropic's public Admin API exposes usage/cost reports, but not every account
 * exposes a direct prepaid balance field. If a usable balance cannot be read,
 * return `unknown` and never block audit generation.
 */
export async function checkAnthropicBalance(): Promise<AnthropicBalanceCheck> {
  if (process.env.USE_ANTHROPIC_ADMIN_BALANCE !== 'true') {
    return checkMonthlyAuditBudget()
  }

  const key = process.env.ANTHROPIC_ADMIN_API_KEY || process.env.ANTHROPIC_API_KEY
  if (!key) {
    const result = {
      balance: NaN,
      status: 'unknown' as const,
      message: 'Anthropic balance: unknown (ANTHROPIC_ADMIN_API_KEY is not set)',
    }
    console.warn(`[anthropic-balance] ${result.message}`)
    return result
  }

  const url = process.env.ANTHROPIC_USAGE_REPORT_URL || DEFAULT_USAGE_URL
  try {
    const res = await fetch(url, {
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
    })
    if (!res.ok) {
      const result = {
        balance: NaN,
        status: 'unknown' as const,
        message: `Anthropic balance: unknown (usage endpoint returned ${res.status})`,
      }
      console.warn(`[anthropic-balance] ${result.message}`)
      return result
    }

    const data = await res.json()
    const balance = parseBalance(data)
    if (balance == null) {
      const result = {
        balance: NaN,
        status: 'unknown' as const,
        message: 'Anthropic balance: unknown (usage response did not include a balance field)',
      }
      console.warn(`[anthropic-balance] ${result.message}`)
      return result
    }

    const status = statusFor(balance)
    const message = `Balance: $${balance.toFixed(2)}, status: ${status.toUpperCase()}`
    const result = { balance, status, message }
    console.log(`[anthropic-balance] ${message}`)
    await alertIfNeeded(result)
    return result
  } catch (err) {
    const result = {
      balance: NaN,
      status: 'unknown' as const,
      message: `Anthropic balance: unknown (${err instanceof Error ? err.message : String(err)})`,
    }
    console.warn(`[anthropic-balance] ${result.message}`)
    return result
  }
}
