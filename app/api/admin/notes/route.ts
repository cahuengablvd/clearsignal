import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  if (req.cookies.get('admin_session')?.value !== 'authenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { audit_id, notes } = await req.json()

  const { error } = await supabaseAdmin
    .from('audits')
    .update({ admin_notes: notes })
    .eq('id', audit_id)

  if (error) {
    return NextResponse.json({ error: 'Failed to save notes' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
