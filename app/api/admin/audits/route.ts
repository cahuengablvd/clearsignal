import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  // Check admin session
  if (req.cookies.get('admin_session')?.value !== 'authenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: audits, error } = await supabaseAdmin
    .from('audits')
    .select('id, created_at, email, url, payment_status, audit_status, tier, admin_notes')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch audits' }, { status: 500 })
  }

  return NextResponse.json({ audits })
}
