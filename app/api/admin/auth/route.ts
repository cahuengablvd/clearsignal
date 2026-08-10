import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { ADMIN_COOKIE, adminCookieValue } from '@/lib/auth'
import { clientIp, enforceRateLimits } from '@/lib/rate-limit'
import { notify } from '@/lib/notify'

// Password-based admin auth. ADMIN_PASSWORD must be set - there is NO fallback.
export async function POST(req: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const ip = clientIp(req)

  // Fail closed if the admin password isn't configured.
  if (!adminPassword) {
    console.error('[admin/auth] ADMIN_PASSWORD is not set - admin login disabled')
    return NextResponse.json({ error: 'Admin authentication is not configured' }, { status: 503 })
  }

  const rl = await enforceRateLimits([
    { key: `admin-auth:ip:${ip}`, limit: 5, windowMs: 15 * 60 * 1000 },
  ])
  if (!rl.allowed) {
    await notify('admin_auth_rate_limited', {
      ip,
      resetAt: new Date(rl.resetAt).toISOString(),
    })
    return NextResponse.json({ error: 'Too many admin login attempts. Please try again later.' }, { status: 429 })
  }

  const { password } = await req.json()

  // Timing-safe comparison.
  const provided = Buffer.from(String(password ?? ''))
  const expected = Buffer.from(adminPassword)
  const ok = provided.length === expected.length && crypto.timingSafeEqual(provided, expected)

  if (!ok) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  // Signed session cookie. adminCookieValue() throws in prod if ACCESS_TOKEN_SECRET
  // is missing - surface that as a config error rather than a forgeable cookie.
  let cookieValue: string
  try {
    cookieValue = adminCookieValue()
  } catch {
    console.error('[admin/auth] ACCESS_TOKEN_SECRET is not set - cannot issue session')
    return NextResponse.json({ error: 'Admin authentication is not configured' }, { status: 503 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set(ADMIN_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    // 30 days. At 24 hours the single operator was logged out between visits and
    // read it as the login working intermittently. The cookie is httpOnly,
    // secure and signed, and this panel has exactly one user.
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })

  return response
}
