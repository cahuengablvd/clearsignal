import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  insertSingle: vi.fn(),
  update: vi.fn(),
  updateEq: vi.fn(),
  createSession: vi.fn(),
  retrievePrice: vi.fn(),
  enforceRateLimits: vi.fn(),
  verifyToken: vi.fn(),
}))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    prices: { retrieve: mocks.retrievePrice },
    checkout: { sessions: { create: mocks.createSession } },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimits: mocks.enforceRateLimits,
  clientIp: () => '127.0.0.1',
  emailDomain: () => 'example.com',
}))

vi.mock('@/lib/tokens', () => ({ verifyToken: mocks.verifyToken }))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      insert: mocks.insert.mockImplementation((value) => ({
        select: () => ({ single: () => mocks.insertSingle(value) }),
      })),
      update: mocks.update.mockImplementation((value) => ({
        eq: (column: string, id: string) => mocks.updateEq(value, column, id),
      })),
    }),
  },
}))

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/stripe/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('paid checkout intake', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_PRICE_ID_AUDIT = 'price_test_149'
    mocks.enforceRateLimits.mockResolvedValue({ allowed: true })
    mocks.verifyToken.mockReturnValue(true)
    mocks.retrievePrice.mockResolvedValue({
      active: true,
      currency: 'eur',
      unit_amount: 14900,
      type: 'one_time',
    })
    mocks.insertSingle.mockResolvedValue({ data: { id: 'audit-pending-1' }, error: null })
    mocks.createSession.mockResolvedValue({ id: 'cs_test_1', url: 'https://checkout.stripe.test/session' })
    mocks.updateEq.mockResolvedValue({ error: null })
  })

  it('accepts and persists a 1500-character ICP while keeping Stripe metadata free of intake text', async () => {
    const { POST } = await import('../app/api/stripe/checkout/route')
    const icp = 'A'.repeat(1500)
    const response = await POST(request({
      email: 'buyer@example.com',
      url: 'https://example.com',
      competitor_1: '',
      competitor_2: '',
      competitor_3: '',
      icp_description: icp,
      business_context: {
        business_model: 'service_business',
        primary_conversion_goal: 'booking',
        target_markets_languages: 'Toronto; English',
        verified_facts: 'Residential and commercial moving are confirmed.',
      },
    }))

    expect(response.status).toBe(200)
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      icp_description: icp,
      payment_status: 'pending',
      audit_status: 'awaiting_payment',
      business_context: expect.objectContaining({
        business_model: 'service_business',
        primary_conversion_goal: 'booking',
      }),
    }))
    expect(mocks.createSession).toHaveBeenCalledWith(expect.objectContaining({
      metadata: { audit_id: 'audit-pending-1', tier: 'automated' },
    }))
    const stripeInput = mocks.createSession.mock.calls[0][0]
    expect(JSON.stringify(stripeInput.metadata)).not.toContain('buyer@example.com')
    expect(JSON.stringify(stripeInput.metadata)).not.toContain(icp)
  })

  it('rejects over-max intake with a readable 400 response', async () => {
    const { POST } = await import('../app/api/stripe/checkout/route')
    const response = await POST(request({
      email: 'buyer@example.com',
      url: 'https://example.com',
      icp_description: 'A'.repeat(2001),
    }))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toMatch(/2000 characters or fewer/i)
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(mocks.createSession).not.toHaveBeenCalled()
  })

  it('rejects an invalid score token before persisting the order', async () => {
    mocks.verifyToken.mockReturnValue(false)
    const { POST } = await import('../app/api/stripe/checkout/route')
    const response = await POST(request({
      email: 'buyer@example.com',
      url: 'https://example.com',
      score_id: 'score-1',
      score_token: 'invalid',
    }))

    expect(response.status).toBe(403)
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(mocks.createSession).not.toHaveBeenCalled()
  })

  it('fails closed before persisting an order when the configured price is not EUR 149', async () => {
    mocks.retrievePrice.mockResolvedValue({
      active: true,
      currency: 'eur',
      unit_amount: 39900,
      type: 'one_time',
    })
    const { POST } = await import('../app/api/stripe/checkout/route')
    const response = await POST(request({
      email: 'buyer@example.com',
      url: 'https://example.com',
    }))

    expect(response.status).toBe(503)
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(mocks.createSession).not.toHaveBeenCalled()
  })
})
