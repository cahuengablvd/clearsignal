import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/tokens'
import { isValidAdminCookie, ADMIN_COOKIE } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data, error } = await supabaseAdmin
    .from('scores')
    .select('id, url, email, competitor_1, status, top_insight, scores')
    .eq('id', params.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Score not found' }, { status: 404 })
  }

  // Email is sensitive (a lead address). Only return it with a valid signed
  // token (from the score result page) or an admin session. Otherwise return
  // only the non-sensitive fields needed to pre-fill checkout.
  const token = req.nextUrl.searchParams.get('token')
  const authorized =
    verifyToken('score', params.id, token) ||
    isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)

  if (!authorized) {
    return NextResponse.json({ id: data.id, url: data.url, competitor_1: data.competitor_1 })
  }

  const processingStartedAt =
    data.scores && typeof data.scores === 'object' && !Array.isArray(data.scores)
      ? (data.scores as Record<string, unknown>)._processing_started_at
      : null
  const businessDescriptionDraft =
    data.status === 'done' &&
    data.scores && typeof data.scores === 'object' && !Array.isArray(data.scores) &&
    typeof (data.scores as Record<string, unknown>).business_description_draft === 'string'
      ? (data.scores as Record<string, unknown>).business_description_draft
      : ''
  const stale =
    data.status === 'processing' &&
    typeof processingStartedAt === 'string' &&
    Date.now() - new Date(processingStartedAt).getTime() > 10 * 60 * 1000

  return NextResponse.json({
    ...data,
    scores: undefined,
    business_description_draft: businessDescriptionDraft,
    status: stale ? 'failed' : data.status,
    top_insight: stale
      ? 'The check took too long to finish. Please start a new check.'
      : data.top_insight,
  })
}
