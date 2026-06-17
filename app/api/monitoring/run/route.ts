import { NextRequest, NextResponse } from 'next/server'
import { isValidAdminCookie, ADMIN_COOKIE } from '@/lib/auth'
import { processDueSites, runMonitoringForSite } from '@/lib/monitoring'

// Monitoring scans are long-running.
export const maxDuration = 300

/**
 * Admin-only manual trigger. Runs all due sites, or a single site if `site_id`
 * is given. Useful for demos/testing without waiting for the daily cron.
 */
export async function POST(req: NextRequest) {
  if (!isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const siteId = body?.site_id as string | undefined

    if (siteId) {
      await runMonitoringForSite(siteId)
      return NextResponse.json({ success: true, site_id: siteId })
    }

    const result = await processDueSites()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('Manual monitoring run error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to run monitoring' },
      { status: 500 }
    )
  }
}
