import { Resend } from 'resend'

let _resend: Resend | null = null

function getResend() {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

export async function sendReportEmail(email: string, auditId: string, url: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const reportLink = `${baseUrl}/audit/${auditId}`
  const pdfLink = `${baseUrl}/api/audit/${auditId}/pdf`

  await getResend().emails.send({
    from: 'ClearSignal <reports@clearsignal.dev>',
    to: email,
    subject: `Your ClearSignal audit is ready — ${url}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; color: #111;">Your ClearSignal report is ready</h1>
        <p style="font-size: 16px; color: #444; line-height: 1.6;">
          We've finished analyzing <strong>${url}</strong>. Your full audit report — including
          messaging clarity scores, competitive gap analysis, and a prioritized action plan — is ready to view.
        </p>
        <a href="${reportLink}" style="display: inline-block; background: #111; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 16px; margin: 20px 0;">
          View your report
        </a>
        <p style="font-size: 14px; color: #666;">
          You can also <a href="${pdfLink}" style="color: #111;">download the PDF</a>.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="font-size: 12px; color: #999;">
          ClearSignal — B2B SaaS homepage audits
        </p>
      </div>
    `,
  })
}
