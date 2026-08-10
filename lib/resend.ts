import { Resend } from 'resend'
import { signToken } from './tokens'
import { DELIVERY_PROMISE } from './delivery-promise'
import { displayDomain } from './normalize-url'

let _resend: Resend | null = null

function getResend() {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

/**
 * Email layout notes, because these are the things that break in mail clients:
 * - Tables, not flexbox/grid. Outlook renders through the Word engine.
 * - Inline styles carry everything that matters. The one <style> block holds the
 *   dark-mode overrides only, because several clients strip it entirely.
 * - No images. `public/` has no logo asset, and clients block remote images by
 *   default, so an image mark would show as a broken placeholder on first open.
 *   The wordmark is text and cannot fail to load.
 */
const BRAND = {
  page: '#FBF6EE',
  surface: '#FFFDF9',
  ink: '#2E2116',
  accent: '#A9531F',
  border: '#E5D7C5',
  muted: '#6E5A50',
} as const

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
}

/** Bulletproof button: an <a> with padding alone loses its shape in Outlook. */
function button(href: string, label: string): string {
  return `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0 8px;">
          <tr>
            <td class="cs-btn" bgcolor="${BRAND.ink}" style="border-radius: 999px;">
              <a href="${escapeHtml(href)}" style="display: inline-block; padding: 14px 30px; font-family: ${FONT}; font-size: 16px; font-weight: 600; line-height: 20px; color: #FFFFFF; text-decoration: none;">${escapeHtml(label)}</a>
            </td>
          </tr>
        </table>`
}

function emailShell(opts: {
  preheader: string
  eyebrow: string
  heading: string
  body: string
  cta?: { href: string; label: string }
  after?: string
}): string {
  return `<!-- preheader -->
<span style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;">${escapeHtml(opts.preheader)}</span>
<style>
  @media (prefers-color-scheme: dark) {
    .cs-page { background-color: #191108 !important; }
    .cs-surface { background-color: #241A11 !important; border-color: #3D2E22 !important; }
    .cs-ink { color: #FBF6EE !important; }
    .cs-muted { color: #C6B4A4 !important; }
    .cs-accent { color: #E79653 !important; }
    .cs-rule { border-color: #3D2E22 !important; }
    /* Keep the button light on dark so it never lands dark-on-dark. */
    .cs-btn { background-color: #E79653 !important; }
    .cs-btn a { color: #2E2116 !important; }
  }
</style>
<table role="presentation" class="cs-page" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.page}" style="background-color: ${BRAND.page}; margin: 0; padding: 0;">
  <tr>
    <td align="center" style="padding: 32px 16px 40px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px;">
        <tr>
          <td style="padding: 0 4px 18px; font-family: ${FONT};">
            <div class="cs-accent" style="font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: ${BRAND.accent};">AI Visibility Audit</div>
            <div class="cs-ink" style="font-size: 21px; font-weight: 700; letter-spacing: -0.01em; color: ${BRAND.ink}; padding-top: 4px;">ClearSignal</div>
          </td>
        </tr>
        <tr>
          <td class="cs-surface" bgcolor="${BRAND.surface}" style="background-color: ${BRAND.surface}; border: 1px solid ${BRAND.border}; border-radius: 14px; padding: 32px; font-family: ${FONT};">
            <div class="cs-accent" style="font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: ${BRAND.accent};">${escapeHtml(opts.eyebrow)}</div>
            <h1 class="cs-ink" style="margin: 12px 0 0; font-size: 25px; line-height: 1.25; font-weight: 700; color: ${BRAND.ink};">${escapeHtml(opts.heading)}</h1>
            ${opts.body}
            ${opts.cta ? button(opts.cta.href, opts.cta.label) : ''}
            ${opts.after || ''}
          </td>
        </tr>
        <tr>
          <td style="padding: 22px 4px 0; font-family: ${FONT};">
            <hr class="cs-rule" style="border: none; border-top: 1px solid ${BRAND.border}; margin: 0 0 14px;" />
            <p class="cs-muted" style="margin: 0; font-size: 12px; line-height: 1.6; color: ${BRAND.muted};">
              ClearSignal - expert-reviewed AI Visibility Audits. Every report is checked by a person before it is sent.
            </p>
            <p class="cs-muted" style="margin: 8px 0 0; font-size: 12px; line-height: 1.6; color: ${BRAND.muted};">
              <a href="${baseUrl()}/terms" style="color: ${BRAND.muted};">Terms</a> &nbsp;/&nbsp;
              <a href="${baseUrl()}/privacy" style="color: ${BRAND.muted};">Privacy</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
}

function paragraph(html: string, size = 16): string {
  return `<p class="cs-muted" style="margin: 16px 0 0; font-size: ${size}px; line-height: 1.65; color: ${BRAND.muted};">${html}</p>`
}

/** Build the delivery email HTML. Pure - handy for previews and tests. */
export function buildReportEmailHtml(url: string, reportLink: string, pdfLink: string): string {
  const domain = escapeHtml(displayDomain(url))
  return emailShell({
    preheader: `Your ClearSignal audit for ${displayDomain(url)} is ready to open.`,
    eyebrow: 'Your report is ready',
    heading: `AI Visibility Audit for ${displayDomain(url)}`,
    body: [
      paragraph(
        `We finished analyzing <strong class="cs-ink" style="color: ${BRAND.ink};">${domain}</strong> across the configured AI engines.`
      ),
      paragraph(
        'The report shows the measured AI visibility, the competitor and source evidence behind it, and the prioritized changes identified in the audit.'
      ),
    ].join(''),
    cta: { href: reportLink, label: 'View your report' },
    after: paragraph(
      `Prefer a file? <a href="${escapeHtml(pdfLink)}" style="color: ${BRAND.accent};">Open the PDF</a>.`,
      14
    ),
  })
}

/** Plain-text alternative. Its absence is a real spam signal. */
export function buildReportEmailText(url: string, reportLink: string, pdfLink: string): string {
  return [
    `Your AI Visibility Audit for ${displayDomain(url)} is ready.`,
    '',
    'We finished analyzing your site across the configured AI engines. The report shows',
    'the measured AI visibility, the competitor and source evidence behind it, and the',
    'prioritized changes identified in the audit.',
    '',
    `View your report: ${reportLink}`,
    `Open the PDF: ${pdfLink}`,
    '',
    'ClearSignal - expert-reviewed AI Visibility Audits.',
    'Every report is checked by a person before it is sent.',
  ].join('\n')
}

export function reportLinks(auditId: string): { reportLink: string; pdfLink: string } {
  // Signed access token gates the report + PDF to whoever has the email link.
  const token = signToken('audit', auditId)
  return {
    reportLink: `${baseUrl()}/audit/${auditId}?token=${token}`,
    pdfLink: `${baseUrl()}/api/audit/${auditId}/pdf?token=${token}`,
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
    // The bare domain, never the full URL: "https://" in a subject reads as spam.
    subject: `Your AI Visibility report is ready - ${displayDomain(url)}`,
    html: buildReportEmailHtml(url, reportLink, pdfLink),
    text: buildReportEmailText(url, reportLink, pdfLink),
  })

  if (error) {
    throw new Error(`Resend rejected the delivery email: ${JSON.stringify(error)}`)
  }
  return data
}

export function buildOrderConfirmationEmailHtml(url: string): string {
  const domain = escapeHtml(displayDomain(url))
  return emailShell({
    preheader: `We received your ClearSignal audit order for ${displayDomain(url)}.`,
    eyebrow: 'Order confirmed',
    heading: 'We received your audit order',
    body: [
      paragraph(
        `We will analyze <strong class="cs-ink" style="color: ${BRAND.ink};">${domain}</strong> across the configured AI engines, review the findings, and email you when the web report and PDF are ready.`
      ),
      paragraph(escapeHtml(DELIVERY_PROMISE)),
      paragraph('Questions about your order? Reply to this email and we will help.', 14),
    ].join(''),
  })
}

export function buildOrderConfirmationEmailText(url: string): string {
  return [
    'We received your ClearSignal audit order.',
    '',
    `We will analyze ${displayDomain(url)} across the configured AI engines, review the`,
    'findings, and email you when the web report and PDF are ready.',
    '',
    DELIVERY_PROMISE,
    '',
    'Questions about your order? Reply to this email and we will help.',
  ].join('\n')
}

export async function sendOrderConfirmationEmail(email: string, url: string) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set')
  }

  const { data, error } = await getResend().emails.send({
    from: process.env.RESEND_FROM || 'ClearSignal <reports@getclearsignal.io>',
    to: email,
    replyTo: process.env.RESEND_REPLY_TO || process.env.ADMIN_ALERT_EMAIL || 'hello@getclearsignal.io',
    subject: `Your ClearSignal audit order is confirmed - ${displayDomain(url)}`,
    html: buildOrderConfirmationEmailHtml(url),
    text: buildOrderConfirmationEmailText(url),
  })

  if (error) {
    throw new Error(`Resend rejected the order confirmation email: ${JSON.stringify(error)}`)
  }
  return data
}
