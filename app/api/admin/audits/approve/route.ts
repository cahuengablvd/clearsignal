import { NextRequest, NextResponse } from 'next/server'
import { isValidAdminCookie, ADMIN_COOKIE } from '@/lib/auth'
import { deliverAuditEmail } from '@/lib/email-delivery'
import { supabaseAdmin } from '@/lib/supabase'
import { appendAdminNote } from '@/lib/admin-notes'

export async function POST(req: NextRequest) {
  if (!isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { audit_id, force, reason } = await req.json()
  if (!audit_id) {
    return NextResponse.json({ error: 'audit_id required' }, { status: 400 })
  }

  try {
    const { data: audit, error } = await supabaseAdmin.from('audits').select('report, admin_notes').eq('id', audit_id).single()
    if (error || !audit) return NextResponse.json({ error: 'audit not found' }, { status: 404 })
    const gate = (audit.report as { geo?: { coverage_gate?: { passed?: boolean; reasons?: string[] } } } | null)?.geo?.coverage_gate
    const enforce = process.env.GEO_COVERAGE_GATE_MODE !== 'report_only'
    // Only an explicit boolean `true` counts as an override request; "false" strings or
    // other truthy junk never bypass the gate.
    const forced = force === true
    if (enforce && gate?.passed === false && !forced) return NextResponse.json({ error: 'coverage_gate_failed', reasons: gate.reasons || [] }, { status: 409 })
    if (enforce && gate?.passed === false && forced) {
      if (typeof reason !== 'string' || !reason.trim()) return NextResponse.json({ error: 'force reason required' }, { status: 400 })
      const { error: noteError } = await supabaseAdmin.from('audits').update({ admin_notes: appendAdminNote(audit.admin_notes, `[${new Date().toISOString()}] OVERRIDE coverage gate: ${reason.trim()}`) }).eq('id', audit_id)
      if (noteError) throw noteError
    }
    await deliverAuditEmail(audit_id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send report email' },
      { status: 500 }
    )
  }
}
