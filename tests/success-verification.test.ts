import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ retrieve: vi.fn() }))

vi.mock('@/lib/stripe', () => ({
  stripe: { checkout: { sessions: { retrieve: mocks.retrieve } } },
}))

describe('success payment verification', () => {
  beforeEach(() => vi.clearAllMocks())

  async function render(sessionId?: string) {
    const { default: SuccessPage } = await import('../app/success/page')
    const element = await SuccessPage({ searchParams: sessionId ? { session_id: sessionId } : {} })
    return renderToStaticMarkup(element as React.ReactElement)
  }

  it('renders the neutral page when session_id is missing', async () => {
    const html = await render()
    expect(html).toContain('We could not verify this payment')
    expect(html).not.toContain('Payment confirmed')
  })

  it('renders the neutral page when Stripe cannot find the session', async () => {
    mocks.retrieve.mockRejectedValue(new Error('No such session'))
    const html = await render('cs_unknown')
    expect(html).toContain('We could not verify this payment')
  })

  it('renders the neutral page when the session is not paid', async () => {
    mocks.retrieve.mockResolvedValue({ payment_status: 'unpaid' })
    const html = await render('cs_unpaid')
    expect(html).toContain('We could not verify this payment')
    expect(html).not.toContain('Payment confirmed')
  })

  it('renders confirmation only for a paid Stripe session', async () => {
    mocks.retrieve.mockResolvedValue({ payment_status: 'paid' })
    const html = await render('cs_paid')
    expect(html).toContain('Payment confirmed')
    expect(html).toContain('Your audit is in the queue')
    expect(html).not.toContain('a few minutes')
  })
})
