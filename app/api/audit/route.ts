import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { runFullAudit } from '@/lib/audit-runner'

export async function POST(req: NextRequest) {
  try {
    const { audit_id } = await req.json()

    if (!audit_id) {
      return NextResponse.json({ error: 'audit_id required' }, { status: 400 })
    }

    // Check audit exists
    const { data: audit, error } = await supabaseAdmin
      .from('audits')
      .select('id, audit_status')
      .eq('id', audit_id)
      .single()

    if (error || !audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    if (audit.audit_status === 'processing') {
      return NextResponse.json({ error: 'Audit is already processing' }, { status: 409 })
    }

    // Run or re-run the audit
    await runFullAudit(audit_id)

    return NextResponse.json({ success: true, audit_id })
  } catch (err) {
    console.error('Manual audit trigger error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to run audit' },
      { status: 500 }
    )
  }
}
