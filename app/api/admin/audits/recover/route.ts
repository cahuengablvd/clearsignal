import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isValidAdminCookie, ADMIN_COOKIE } from '@/lib/auth'
import { enqueueAudit } from '@/lib/audit-queue'
import { notify } from '@/lib/notify'

export const maxDuration = 60

// An audit stuck in `processing` longer than this is considered stale.
const STALE_PROCESSING_MS = 20 * 60 * 1000

/**
 * Recover paid audits that never completed: anything still `queued`, plus
 * anything `processing` older than the stale TTL (a normal audit finishes in
 * 1-3 min). Each is re-enqueued. This is the manual/cron safety net so a paid
 * audit can't sit stuck forever without recovery.
 */
export async function POST(req: NextRequest) {
  if (!isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const cutoff = new Date(Date.now() - STALE_PROCESSING_MS).toISOString()

    const [{ data: queued, error: qErr }, { data: staleProcessing, error: pErr }] = await Promise.all([
      supabaseAdmin.from('audits').select('id, created_at').eq('audit_status', 'queued'),
      supabaseAdmin
        .from('audits')
        .select('id, created_at')
        .eq('audit_status', 'processing')
        .lt('created_at', cutoff),
    ])

    if (qErr || pErr) {
      return NextResponse.json(
        { error: `Failed to query audits: ${qErr?.message || pErr?.message}` },
        { status: 500 }
      )
    }

    // De-dupe by id (shouldn't overlap, but be safe).
    const candidates = [...(queued || []), ...(staleProcessing || [])]
    const ids = [...new Set(candidates.map((a) => a.id))]

    let reEnqueued = 0
    const errors: { id: string; error: string }[] = []

    for (const id of ids) {
      try {
        await enqueueAudit(id)
        reEnqueued += 1
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        errors.push({ id, error: message })
        await notify('audit_recovery_failed', { audit_id: id, error: message })
      }
    }

    return NextResponse.json({
      found: ids.length,
      queued: queued?.length ?? 0,
      stale_processing: staleProcessing?.length ?? 0,
      re_enqueued: reEnqueued,
      failed: errors.length,
      errors,
    })
  } catch (err) {
    console.error('[recover] unexpected error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Recovery failed' },
      { status: 500 }
    )
  }
}
