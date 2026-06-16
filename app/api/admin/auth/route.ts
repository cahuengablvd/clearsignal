import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { ADMIN_COOKIE, adminCookieValue } from '@/lib/auth'

// Password-based admin auth. ADMIN_PASSWORD must be set — there is NO fallback.
export async function POST(req: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD

  // Fail closed if the admin password isn't configured.
  if (!adminPassword) {
    console.error('[admin/auth] ADMIN_PASSWORD is not set — admin login disabled')
    return NextResponse.json({ error: 'Admin authentication is not configured' }, { status: 503 })
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
  // is missing — surface that as a config error rather than a forgeable cookie.
  let cookieValue: string
  try {
    cookieValue = adminCookieValue()
  } catch {
    console.error('[admin/auth] ACCESS_TOKEN_SECRET is not set — cannot issue session')
    return NextResponse.json({ error: 'Admin authentication is not configured' }, { status: 503 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set(ADMIN_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  })

  return response
}
