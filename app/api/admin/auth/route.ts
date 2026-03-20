import { NextRequest, NextResponse } from 'next/server'

// Simple password-based admin auth for MVP
// Set ADMIN_PASSWORD in .env.local
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'clearsignal-admin'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  // Set a simple session cookie
  const response = NextResponse.json({ success: true })
  response.cookies.set('admin_session', 'authenticated', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  })

  return response
}
