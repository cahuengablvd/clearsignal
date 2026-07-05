/**
 * Rate limiting for endpoints that spend paid API credits.
 *
 * Uses Upstash Redis (REST) when configured (UPSTASH_REDIS_REST_URL +
 * UPSTASH_REDIS_REST_TOKEN) so limits hold across serverless instances.
 * Otherwise falls back to a per-instance in-memory limiter.
 */
import { NextRequest } from 'next/server'
import { notify } from './notify'

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
let degradedAlertSent = false

export interface RateResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

async function upstash(command: (string | number)[]): Promise<unknown> {
  const resp = await fetch(`${UPSTASH_URL}/${command.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    cache: 'no-store',
  })
  if (!resp.ok) throw new Error(`Upstash HTTP ${resp.status}`)
  const data = (await resp.json()) as { result: unknown }
  return data.result
}

function inMemory(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || now >= existing.resetAt) {
    const resetAt = now + windowMs
    buckets.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: limit - 1, resetAt }
  }
  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt }
  }
  existing.count += 1
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt }
}

async function notifyDegradedRateLimit(reason: string, key: string) {
  if (process.env.NODE_ENV !== 'production' || degradedAlertSent) return
  degradedAlertSent = true
  await notify('rate_limit_degraded', { reason, key })
}

/** Check one key against a limit. Async to allow the Upstash backend. */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateResult> {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const count = Number(await upstash(['INCR', key]))
      if (count === 1) {
        await upstash(['PEXPIRE', key, windowMs])
      }
      return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt: Date.now() + windowMs }
    } catch (err) {
      // If Redis is unreachable, fail open to the in-memory limiter rather than
      // blocking all traffic.
      console.error('[rate-limit] Upstash error, using in-memory fallback:', err)
      await notifyDegradedRateLimit('upstash_error', key)
    }
  } else {
    await notifyDegradedRateLimit('upstash_not_configured', key)
  }
  return inMemory(key, limit, windowMs)
}

/**
 * Enforce several limits at once (e.g. per-IP AND per-email). Blocks if any
 * single key is over its limit.
 */
export async function enforceRateLimits(
  limits: { key: string; limit: number; windowMs: number }[]
): Promise<RateResult> {
  let worst: RateResult = { allowed: true, remaining: Number.MAX_SAFE_INTEGER, resetAt: 0 }
  for (const l of limits) {
    const res = await checkRateLimit(l.key, l.limit, l.windowMs)
    if (!res.allowed) return res
    if (res.remaining < worst.remaining) worst = res
  }
  return worst
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}

/** Lowercased domain part of an email, for coarse per-domain limiting. */
export function emailDomain(email: string): string {
  const at = email.lastIndexOf('@')
  return at >= 0 ? email.slice(at + 1).toLowerCase() : email.toLowerCase()
}

// Evict expired in-memory buckets so the Map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key)
  }
}, 10 * 60 * 1000).unref?.()
