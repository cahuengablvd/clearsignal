import { NextRequest, NextResponse } from 'next/server'
import { generateScorePDF } from '@/lib/pdf'
import { verifyToken } from '@/lib/tokens'
import { isValidAdminCookie, ADMIN_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60

const SCORE_PDF_LIMIT = 5
const SCORE_PDF_WINDOW_MS = 60 * 60 * 1000

function domainSlug(url?: string | null): string | null {
  if (!url) return null
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '')
    return host
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || null
  } catch {
    return null
  }
}

async function scoreRecord(scoreId: string) {
  const { data, error } = await supabaseAdmin
    .from('scores')
    .select('id, url')
    .eq('id', scoreId)
    .maybeSingle()

  if (error || !data) return null
  return data
}

function pdfFileName(scoreId: string, url?: string | null): string {
  const shortId = scoreId.slice(0, 8)
  const slug = domainSlug(url)
  return slug
    ? `clearsignal-score-${slug}-${shortId}.pdf`
    : `clearsignal-score-${shortId}.pdf`
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.nextUrl.searchParams.get('token')
  const hasAccess =
    verifyToken('score', params.id, token) ||
    isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)

  if (!hasAccess) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const score = await scoreRecord(params.id)
  if (!score) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const rate = await checkRateLimit(
    `score:pdf:${params.id}`,
    SCORE_PDF_LIMIT,
    SCORE_PDF_WINDOW_MS
  )
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'This score has been downloaded several times recently. Please try again in about an hour.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))),
        },
      }
    )
  }

  try {
    const pdfBuffer = await generateScorePDF(params.id, req.nextUrl.origin)
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfFileName(params.id, score.url)}"`,
      },
    })
  } catch (err) {
    console.error('Score PDF generation error:', err)
    return NextResponse.json(
      {
        error: 'Failed to generate score PDF',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}
