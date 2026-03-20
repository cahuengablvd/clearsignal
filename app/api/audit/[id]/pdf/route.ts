import { NextRequest, NextResponse } from 'next/server'
import { generateAuditPDF } from '@/lib/pdf'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
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
