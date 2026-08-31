import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { enqueueAudit } from '@/lib/audit-queue'
import { isValidAdminCookie, ADMIN_COOKIE } from '@/lib/auth'
import { appendAdminNote } from '@/lib/admin-notes'
import { DETERMINISTIC_FAILURE_OVERRIDE_MARKER, claimAuditRecovery, isDeterministicAuditFailure, releaseAuditRecoveryClaim } from '@/lib/audit-recovery'

export async function POST(req: NextRequest) {
  if (!isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { audit_id, reuse_geo_evidence = false, confirm_reuse_age = false, override_deterministic_failure = false } = await req.json()
    if (!audit_id) return NextResponse.json({ error: 'audit_id required' }, { status: 400 })
    const { data: audit, error } = await supabaseAdmin.from('audits').select('id, audit_status, admin_notes, report').eq('id', audit_id).single()
    if (error || !audit) return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    if (audit.audit_status === 'processing') return NextResponse.json({ error: 'Audit is already processing' }, { status: 409 })

    const observedAt = (audit.report as { geo?: { observed_at?: string } } | null)?.geo?.observed_at
    const warnDays = Number(process.env.GEO_REUSE_AGE_WARN_DAYS || 14)
    const ageDays = observedAt ? Math.max(0, Math.floor((Date.now() - Date.parse(observedAt)) / 86400000)) : null
    if (reuse_geo_evidence && ageDays !== null && Number.isFinite(ageDays) && ageDays > warnDays && !confirm_reuse_age) return NextResponse.json({ error: 'reuse_evidence_age_confirmation_required', evidence_age_days: ageDays, observed_at: observedAt, threshold_days: warnDays }, { status: 409 })
    const deterministicFailure = isDeterministicAuditFailure((audit as { admin_notes?: string | null }).admin_notes)
    if (deterministicFailure && !override_deterministic_failure) return NextResponse.json({ error: 'This audit has a deterministic failure. Use the explicit admin override to requeue it.' }, { status: 409 })
    if (override_deterministic_failure && !deterministicFailure) return NextResponse.json({ error: 'No active deterministic failure marker to override.' }, { status: 409 })

    const claim = await claimAuditRecovery({ kind: 'manual', auditId: audit_id, observedStatus: audit.audit_status })
    if (!claim) return NextResponse.json({ error: 'Audit changed before recovery could be claimed' }, { status: 409 })
    const { error: clearStageCacheError } = await supabaseAdmin.from('audit_stage_executions').delete().eq('audit_id', audit_id)
    if (clearStageCacheError) {
      await releaseAuditRecoveryClaim(claim)
      console.error('Failed to clear audit stage cache before regeneration:', clearStageCacheError)
      return NextResponse.json({ error: 'Failed to clear cached audit stages' }, { status: 500 })
    }
    try {
      await enqueueAudit(audit_id, { reuseGeoEvidence: Boolean(reuse_geo_evidence), trigger: 'admin_regenerate', endpoint: '/api/audit' })
    } catch (enqueueError) {
      await releaseAuditRecoveryClaim(claim)
      throw enqueueError
    }

    // The CAS claim resets recovery_attempts only after ownership is proven:
    // an operator-requested regeneration starts a new bounded recovery cycle.
    const note = override_deterministic_failure
      ? `[${claim.claimedAt}] ${DETERMINISTIC_FAILURE_OVERRIDE_MARKER} by admin operator. Claimed for regeneration. Previous status: ${audit.audit_status}.`
      : `[${claim.claimedAt}] Claimed for regeneration. Previous status: ${audit.audit_status}.`
    const { error: noteError } = await supabaseAdmin.from('audits').update({ admin_notes: appendAdminNote((audit as { admin_notes?: string | null }).admin_notes, note) })
      .eq('id', audit_id).eq('audit_status', 'processing').eq('processing_started_at', claim.claimedAt)
    if (noteError) console.error('Failed to append audit recovery note:', noteError)
    return NextResponse.json({ success: true, audit_id, reuse_geo_evidence: Boolean(reuse_geo_evidence), evidence_age_days: ageDays, deterministic_failure_overridden: Boolean(override_deterministic_failure) })
  } catch (err) {
    console.error('Manual audit trigger error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to run audit' }, { status: 500 })
  }
}
