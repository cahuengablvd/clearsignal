import { NextRequest, NextResponse } from 'next/server'
import { generateAuditPDF } from '@/lib/pdf'
import { verifyToken } from '@/lib/tokens'
import { isValidAdminCookie, ADMIN_COOKIE } from '@/lib/auth'

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
    const pdfBuffer = await generateAuditPDF(params.id)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="clearsignal-audit-${params.id}.pdf"`,
      },
    })
  } catch (err) {
    console.error('PDF generation error:', err)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
