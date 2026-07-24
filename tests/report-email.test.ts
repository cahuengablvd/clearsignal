import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendMock = vi.fn()

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: sendMock,
    },
  })),
}))

const REPORT_LINK = 'https://clearsignal.example/audit/a1?token=tok'
const PDF_LINK = 'https://clearsignal.example/api/audit/a1/pdf?token=tok'

describe('branded delivery email', () => {
  beforeEach(() => {
    vi.resetModules()
    sendMock.mockReset()
    process.env.RESEND_API_KEY = 'test-resend-key'
    process.env.NEXT_PUBLIC_BASE_URL = 'https://clearsignal.example'
  })

  it('carries both access links in the HTML and the text alternative', async () => {
    const { buildReportEmailHtml, buildReportEmailText } = await import('../lib/resend')
    const html = buildReportEmailHtml('https://rozie.app/', REPORT_LINK, PDF_LINK)
    const text = buildReportEmailText('https://rozie.app/', REPORT_LINK, PDF_LINK)

    for (const body of [html, text]) {
      expect(body).toContain(REPORT_LINK)
      expect(body).toContain(PDF_LINK)
    }
  })

  it('sends a text alternative alongside the HTML', async () => {
    sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null })
    const { sendReportEmail } = await import('../lib/resend')

    await sendReportEmail('buyer@example.com', 'audit-123', 'https://rozie.app/')

    const payload = sendMock.mock.calls[0][0]
    expect(payload.text).toContain('rozie.app')
    expect(payload.html).toContain('<table')
  })

  it('subjects use the bare domain, never a raw URL', async () => {
    sendMock.mockResolvedValue({ data: { id: 'email_2' }, error: null })
    const { sendReportEmail, sendOrderConfirmationEmail } = await import('../lib/resend')

    await sendReportEmail('buyer@example.com', 'audit-123', 'https://www.Rozie.app/pricing')
    await sendOrderConfirmationEmail('buyer@example.com', 'https://www.Rozie.app/pricing')

    for (const call of sendMock.mock.calls) {
      expect(call[0].subject).toContain('rozie.app')
      expect(call[0].subject).not.toContain('https://')
      expect(call[0].subject).not.toContain('www.')
    }
  })

  it('uses no images, so a client blocking them loses nothing', async () => {
    const { buildReportEmailHtml, buildOrderConfirmationEmailHtml } = await import('../lib/resend')

    for (const html of [
      buildReportEmailHtml('https://rozie.app/', REPORT_LINK, PDF_LINK),
      buildOrderConfirmationEmailHtml('https://rozie.app/'),
    ]) {
      expect(html).not.toMatch(/<img\b/i)
      expect(html).toContain('ClearSignal')
    }
  })

  it('keeps layout inline and reserves the style block for dark mode only', async () => {
    const { buildReportEmailHtml } = await import('../lib/resend')
    const html = buildReportEmailHtml('https://rozie.app/', REPORT_LINK, PDF_LINK)

    const styleBlock = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] || ''
    expect(styleBlock).toContain('prefers-color-scheme: dark')
    // Everything outside the dark-mode query must survive a client that strips
    // <style> entirely, so no layout rule may live in there.
    expect(styleBlock).not.toMatch(/display:\s*flex|display:\s*grid|max-width/)
    // The button must not end up dark-on-dark after inversion.
    expect(styleBlock).toContain('.cs-btn a')
  })

  it('escapes the target URL instead of interpolating markup', async () => {
    const { buildReportEmailHtml } = await import('../lib/resend')
    const html = buildReportEmailHtml('https://evil.example/"><script>x</script>', REPORT_LINK, PDF_LINK)

    expect(html).not.toContain('<script>')
  })

  it('confirmation email keeps the shared delivery promise', async () => {
    const { buildOrderConfirmationEmailHtml, buildOrderConfirmationEmailText } = await import(
      '../lib/resend'
    )
    const { DELIVERY_PROMISE } = await import('../lib/delivery-promise')

    expect(buildOrderConfirmationEmailText('https://rozie.app/')).toContain(DELIVERY_PROMISE)
    expect(buildOrderConfirmationEmailHtml('https://rozie.app/')).toContain('Order confirmed')
  })
})
