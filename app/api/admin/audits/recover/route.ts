import { NextRequest, NextResponse } from 'next/server'
import { isValidAdminCookie, ADMIN_COOKIE } from '@/lib/auth'
import { recoverStuckAudits } from '@/lib/audit-recovery'

export const maxDuration = 60

/**
 * Admin-triggered recovery of stuck paid audits. Shares its logic with the
 * recovery cron via lib/audit-recovery.
 */
export async function POST(req: NextRequest) {
  if (!isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const summary = await recoverStuckAudits()
    return NextResponse.json(summary)
  } catch (err) {
    console.error('[recover] unexpected error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Recovery failed' },
      { status: 500 }
    )
  }
}
