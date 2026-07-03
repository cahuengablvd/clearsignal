import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isValidAdminCookie, ADMIN_COOKIE } from '@/lib/auth'
import { trySignToken } from '@/lib/tokens'

const STATUS_PRIORITY: Record<string, number> = {
  processing: 0,
  queued: 1,
  'failed-validation': 2,
  failed: 3,
  delivery_failed: 4,
  awaiting_review: 5,
  done: 6,
  delivered: 7,
}

function statusPriority(status: string): number {
  return STATUS_PRIORITY[status] ?? 99
}

function lastActivityAt(audit: {
  created_at: string
  last_generated_at?: string | null
  last_rerendered_at?: string | null
  last_delivered_at?: string | null
}): string {
  const dates = [
    audit.last_generated_at,
    audit.last_rerendered_at,
    audit.last_delivered_at,
    audit.created_at,
  ].filter(Boolean) as string[]
  return dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || audit.created_at
}

export async function GET(req: NextRequest) {
  // Check admin session
  if (!isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: audits, error } = await supabaseAdmin
    .from('audits')
    .select('id, created_at, email, url, payment_status, audit_status, tier, admin_notes, api_cost_usd, api_cost_breakdown, last_generated_at, last_rerendered_at, last_delivered_at, report')
    .order('created_at', { ascending: false })
    // Fetch a wider window before in-memory priority sorting so regenerated
    // older audits can still float to the top during review batches.
    .limit(500)

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
    const has_report = Boolean(a.report)
    const { report: _report, ...audit } = a
    const last_activity_at = lastActivityAt(a)
    if (['done', 'awaiting_review', 'delivery_failed', 'delivered'].includes(a.audit_status)) {
      const token = trySignToken('audit', a.id)
      return {
        ...audit,
        has_report,
        last_activity_at,
        validation_repair_count,
        report_url: token ? `/audit/${a.id}?token=${token}` : `/audit/${a.id}`,
      }
    }
    return { ...audit, has_report, last_activity_at, validation_repair_count, report_url: null as string | null }
  }).sort((a, b) => {
    const priorityDelta = statusPriority(a.audit_status) - statusPriority(b.audit_status)
    if (priorityDelta !== 0) return priorityDelta
    return new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime()
  })

  return NextResponse.json({ audits: withLinks })
}
