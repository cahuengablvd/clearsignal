import { NextRequest, NextResponse } from 'next/server'
import { generateAuditPDF } from '@/lib/pdf'
import { verifyToken } from '@/lib/tokens'
import { isValidAdminCookie, ADMIN_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// Chromium launch + page render needs well over the default function timeout.
export const maxDuration = 60

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

async function pdfFileName(auditId: string): Promise<string> {
  const shortId = auditId.slice(0, 8)
  try {
    const { data } = await supabaseAdmin
      .from('audits')
      .select('url')
      .eq('id', auditId)
      .maybeSingle()
    const slug = domainSlug(data?.url)
    if (slug) return `clearsignal-audit-${slug}-${shortId}.pdf`
  } catch (err) {
    console.warn('Could not build domain-based PDF filename:', err)
  }
  return `clearsignal-audit-${shortId}.pdf`
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Gate the paid PDF behind the signed access token (emailed link) or admin.
  const token = req.nextUrl.searchParams.get('token')
  const hasAccess =
    verifyToken('audit', params.id, token) ||
    isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)
  if (!hasAccess) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const pdfBuffer = await generateAuditPDF(params.id, req.nextUrl.origin)
    const filename = await pdfFileName(params.id)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        // `inline`, not `attachment`. An attachment download leaves the tab blank
        // and titled "Untitled" while the file lands silently in a folder - which
        // reads as a broken link, to the operator and to a paying customer alike.
        // The browser's PDF viewer shows the report and offers its own save button.
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('PDF generation error:', err)
    // Caller is already access-gated (token/admin); surface the detail to help
    // diagnose serverless Chromium issues.
    return NextResponse.json(
      { error: 'Failed to generate PDF', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
