import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isValidAdminCookie, ADMIN_COOKIE } from '@/lib/auth'
import { trySignToken } from '@/lib/tokens'

export async function GET(req: NextRequest) {
  // Check admin session
  if (!isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: audits, error } = await supabaseAdmin
    .from('audits')
    .select('id, created_at, email, url, payment_status, audit_status, tier, admin_notes')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch audits' }, { status: 500 })
  }

  // Attach a shareable, signed report link for finished audits (so the admin
  // can copy a URL to send a friend without an admin session).
  const withLinks = (audits || []).map((a) => {
    if (['done', 'delivered'].includes(a.audit_status)) {
      const token = trySignToken('audit', a.id)
      return { ...a, report_url: token ? `/audit/${a.id}?token=${token}` : `/audit/${a.id}` }
    }
    return { ...a, report_url: null as string | null }
  })

  return NextResponse.json({ audits: withLinks })
}
