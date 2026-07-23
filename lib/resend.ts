import { Resend } from 'resend'
import { signToken } from './tokens'
import { DELIVERY_PROMISE } from './delivery-promise'

let _resend: Resend | null = null

function getResend() {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

/** Build the delivery email HTML. Pure - handy for previews and tests. */
export function buildReportEmailHtml(url: string, reportLink: string, pdfLink: string): string {
  return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; color: #111;">Your AI Visibility report is ready</h1>
        <p style="font-size: 16px; color: #444; line-height: 1.6;">
          We've finished analyzing <strong>${url}</strong> across ChatGPT, Perplexity and Google AI.
          Your report shows your AI Visibility Score, how you compare to competitors, which sources
          AI cites, and the exact fixes to get recommended more often.
        </p>
        <a href="${reportLink}" style="display: inline-block; background: #111; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 16px; margin: 20px 0;">
          View your report
        </a>
        <p style="font-size: 14px; color: #666;">
          You can also <a href="${pdfLink}" style="color: #111;">download the PDF</a>.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="font-size: 12px; color: #999;">
          ClearSignal - AI Visibility audits for B2B SaaS
        </p>
      </div>
    `
}

export function reportLinks(auditId: string): { reportLink: string; pdfLink: string } {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  // Signed access token gates the report + PDF to whoever has the email link.
  const token = signToken('audit', auditId)
  return {
    reportLink: `${baseUrl}/audit/${auditId}?token=${token}`,
    pdfLink: `${baseUrl}/api/audit/${auditId}/pdf?token=${token}`,
  }
}

export async function sendReportEmail(email: string, auditId: string, url: string) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set')
  }
  const { reportLink, pdfLink } = reportLinks(auditId)

  // Resend's send() returns { data, error } and does NOT throw on API errors
  // (e.g. an unverified sender domain). Surface the error so a failed send is
  // logged and the audit is not falsely marked "delivered".
  const { data, error } = await getResend().emails.send({
    from: process.env.RESEND_FROM || 'ClearSignal <reports@getclearsignal.io>',
    to: email,
    subject: `Your AI Visibility report is ready - ${url}`,
    html: buildReportEmailHtml(url, reportLink, pdfLink),
  })

  if (error) {
    throw new Error(`Resend rejected the delivery email: ${JSON.stringify(error)}`)
  }
  return data
}

export function buildOrderConfirmationEmailHtml(url: string): string {
  return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #2E2116;">
        <p style="font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #A9531F;">
          Order confirmed
        </p>
        <h1 style="font-size: 26px; color: #2E2116;">We received your ClearSignal audit order</h1>
        <p style="font-size: 16px; color: #5F4B40; line-height: 1.6;">
          We will analyze <strong>${url}</strong> across the configured AI engines, review the findings,
          and email you when the web report and PDF are ready.
        </p>
        <p style="font-size: 16px; color: #5F4B40; line-height: 1.6;">${DELIVERY_PROMISE}</p>
        <p style="font-size: 14px; color: #756257; line-height: 1.6;">
          Questions about your order? Reply to this email and we will help.
        </p>
      </div>
    `
}

export async function sendOrderConfirmationEmail(email: string, url: string) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set')
  }

  const { data, error } = await getResend().emails.send({
    from: process.env.RESEND_FROM || 'ClearSignal <reports@getclearsignal.io>',
    to: email,
    replyTo: process.env.RESEND_REPLY_TO || process.env.ADMIN_ALERT_EMAIL || 'hello@getclearsignal.io',
    subject: `Your ClearSignal audit order is confirmed - ${url}`,
    html: buildOrderConfirmationEmailHtml(url),
  })

  if (error) {
    throw new Error(`Resend rejected the order confirmation email: ${JSON.stringify(error)}`)
  }
  return data
}
