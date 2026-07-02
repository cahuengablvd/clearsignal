import { NextRequest, NextResponse } from 'next/server'
import { isValidAdminCookie, ADMIN_COOKIE } from '@/lib/auth'
import { deliverAuditEmail } from '@/lib/email-delivery'

export async function POST(req: NextRequest) {
  if (!isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { audit_id } = await req.json()
  if (!audit_id) {
    return NextResponse.json({ error: 'audit_id required' }, { status: 400 })
  }

  try {
    await deliverAuditEmail(audit_id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send report email' },
      { status: 500 }
    )
  }
}
