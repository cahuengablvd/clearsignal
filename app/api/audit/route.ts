import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { enqueueAudit } from '@/lib/audit-queue'
import { isValidAdminCookie, ADMIN_COOKIE } from '@/lib/auth'
import { appendAdminNote } from '@/lib/admin-notes'

export async function POST(req: NextRequest) {
  // Admin-only: this re-runs a paid audit and spends API credits.
  if (!isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { audit_id, reuse_geo_evidence = true } = await req.json()

    if (!audit_id) {
      return NextResponse.json({ error: 'audit_id required' }, { status: 400 })
    }

    // Check audit exists
    const { data: audit, error } = await supabaseAdmin
      .from('audits')
      .select('id, audit_status, admin_notes')
      .eq('id', audit_id)
      .single()

    if (error || !audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    if (audit.audit_status === 'processing') {
      return NextResponse.json({ error: 'Audit is already processing' }, { status: 409 })
    }

    const { error: clearStageCacheError } = await supabaseAdmin
      .from('audit_stage_executions')
      .delete()
      .eq('audit_id', audit_id)

    if (clearStageCacheError) {
      console.error('Failed to clear audit stage cache before regeneration:', clearStageCacheError)
      return NextResponse.json({ error: 'Failed to clear cached audit stages' }, { status: 500 })
    }

    // Make regeneration visible immediately in the admin UI. Trigger may take a
    // few seconds to start the task and flip the row to `processing`.
    const queuedAt = new Date().toISOString()
    const queuedNote = `[${queuedAt}] Queued for regeneration. Previous status: ${audit.audit_status}.`
    const { error: queueError } = await supabaseAdmin
      .from('audits')
      .update({
        audit_status: 'queued',
        last_generated_at: queuedAt,
        processing_started_at: null,
        recovery_attempts: 0,
        admin_notes: appendAdminNote((audit as { admin_notes?: string | null }).admin_notes, queuedNote),
      })
      .eq('id', audit_id)

    if (queueError) {
      console.error('Failed to mark audit queued before regeneration:', queueError)
      return NextResponse.json({ error: 'Failed to queue audit' }, { status: 500 })
    }

    // Enqueue (Trigger.dev when configured, else in-process for dev).
    await enqueueAudit(audit_id, {
      reuseGeoEvidence: Boolean(reuse_geo_evidence),
      trigger: 'admin_regenerate',
      endpoint: '/api/audit',
    })

    return NextResponse.json({ success: true, audit_id, reuse_geo_evidence: Boolean(reuse_geo_evidence) })
  } catch (err) {
    console.error('Manual audit trigger error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to run audit' },
      { status: 500 }
    )
  }
}
