import { Resend } from 'resend'
import { notify } from './notify'

type BalanceStatus = 'ok' | 'warning' | 'critical' | 'unknown'

export type AnthropicBalanceCheck = {
  balance: number
  status: BalanceStatus
  message: string
}

const DEFAULT_THRESHOLD = 10
const DEFAULT_USAGE_URL = 'https://api.anthropic.com/v1/organizations/usage_report/messages'

function threshold(): number {
  const raw = Number(process.env.ANTHROPIC_BALANCE_ALERT_THRESHOLD ?? DEFAULT_THRESHOLD)
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_THRESHOLD
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

/**
 * Best-effort Anthropic usage/balance guard.
 *
 * Anthropic's public Admin API exposes usage/cost reports, but not every account
 * exposes a direct prepaid balance field. If a usable balance cannot be read,
 * return `unknown` and never block audit generation.
 */
export async function checkAnthropicBalance(): Promise<AnthropicBalanceCheck> {
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
