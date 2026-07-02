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
    .select('id, created_at, email, url, payment_status, audit_status, tier, admin_notes, api_cost_usd, api_cost_breakdown, last_generated_at, last_rerendered_at, last_delivered_at, report')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch audits' }, { status: 500 })
  }

  // Attach a shareable, signed report link for finished audits (so the admin
  // can copy a URL to send a friend without an admin session).
  const withLinks = (audits || []).map((a) => {
    const report = a.report as { validation_warnings?: unknown[] } | null
    const validation_repair_count = Array.isArray(report?.validation_warnings)
      ? report.validation_warnings.length
      : 0
    const { report: _report, ...audit } = a
    if (['done', 'awaiting_review', 'delivery_failed', 'delivered'].includes(a.audit_status)) {
      const token = trySignToken('audit', a.id)
      return {
        ...audit,
        validation_repair_count,
        report_url: token ? `/audit/${a.id}?token=${token}` : `/audit/${a.id}`,
      }
    }
    return { ...audit, validation_repair_count, report_url: null as string | null }
  })

  return NextResponse.json({ audits: withLinks })
}
