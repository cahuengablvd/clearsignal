import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendMock = vi.fn()

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: sendMock,
    },
  })),
}))

describe('report email delivery', () => {
  beforeEach(() => {
    vi.resetModules()
    sendMock.mockReset()
    process.env.RESEND_API_KEY = 'test-resend-key'
    process.env.NEXT_PUBLIC_BASE_URL = 'https://clearsignal.example'
    delete process.env.RESEND_FROM
  })

  it('uses the Resend onboarding sender as the beta-safe fallback', async () => {
    sendMock.mockResolvedValue({ data: { id: 'email_123' }, error: null })
    const { sendReportEmail } = await import('../lib/resend')

    await sendReportEmail('buyer@example.com', 'audit-123', 'https://example.com')

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'ClearSignal <onboarding@resend.dev>',
        to: 'buyer@example.com',
      })
    )
  })

  it('uses RESEND_FROM when it is configured', async () => {
    process.env.RESEND_FROM = 'ClearSignal <reports@example.com>'
    sendMock.mockResolvedValue({ data: { id: 'email_123' }, error: null })
    const { sendReportEmail } = await import('../lib/resend')

    await sendReportEmail('buyer@example.com', 'audit-123', 'https://example.com')

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'ClearSignal <reports@example.com>',
      })
    )
  })

  it('throws when Resend returns an API error', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'domain is not verified' } })
    const { sendReportEmail } = await import('../lib/resend')

    await expect(sendReportEmail('buyer@example.com', 'audit-123', 'https://example.com')).rejects.toThrow(
      /Resend rejected/
    )
  })

  it('throws before sending when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY
    const { sendReportEmail } = await import('../lib/resend')

    await expect(sendReportEmail('buyer@example.com', 'audit-123', 'https://example.com')).rejects.toThrow(
      /RESEND_API_KEY/
    )
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('sends a paid-order confirmation with the shared delivery promise and reply-to', async () => {
    process.env.ADMIN_ALERT_EMAIL = 'support@example.com'
    sendMock.mockResolvedValue({ data: { id: 'email_order_123' }, error: null })
    const { sendOrderConfirmationEmail } = await import('../lib/resend')
    const { DELIVERY_PROMISE } = await import('../lib/delivery-promise')

    await sendOrderConfirmationEmail('buyer@example.com', 'https://example.com')

    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
      to: 'buyer@example.com',
      replyTo: 'support@example.com',
      html: expect.stringContaining(DELIVERY_PROMISE),
    }))
  })
})
