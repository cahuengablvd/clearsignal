import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isValidAdminCookie, ADMIN_COOKIE } from '@/lib/auth'

export async function POST(req: NextRequest) {
  if (!isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { audit_id, audit_status } = await req.json()

  const validStatuses = ['queued', 'processing', 'done', 'delivery_failed', 'delivered', 'failed']
  if (!validStatuses.includes(audit_status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('audits')
    .update({ audit_status })
    .eq('id', audit_id)

  if (error) {
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
