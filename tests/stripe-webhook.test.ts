import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  selectSingle: vi.fn(),
  insertSingle: vi.fn(),
  updateEq: vi.fn(),
  enqueueAudit: vi.fn(),
  notify: vi.fn(),
  sendOrderConfirmationEmail: vi.fn(),
  selectedEq: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}))

vi.mock('next/headers', () => ({ headers: () => ({ get: () => 'test-signature' }) }))
vi.mock('@/lib/stripe', () => ({ stripe: { webhooks: { constructEvent: mocks.constructEvent } } }))
vi.mock('@/lib/audit-queue', () => ({ enqueueAudit: mocks.enqueueAudit }))
vi.mock('@/lib/notify', () => ({ notify: mocks.notify }))
vi.mock('@/lib/resend', () => ({ sendOrderConfirmationEmail: mocks.sendOrderConfirmationEmail }))
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: (column: string, value: string) => {
          mocks.selectedEq(column, value)
          return { single: () => mocks.selectSingle(column, value) }
        },
      }),
      insert: mocks.insert.mockImplementation((value) => ({
        select: () => ({ single: () => mocks.insertSingle(value) }),
      })),
      update: mocks.update.mockImplementation((value) => ({
        eq: (column: string, id: string) => mocks.updateEq(value, column, id),
      })),
    }),
  },
}))

function completedEvent(metadata: Record<string, string> = { audit_id: 'audit-1', tier: 'automated' }) {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_1',
        customer_email: 'buyer@example.com',
        metadata,
      },
    },
  }
}

async function callWebhook() {
  const { POST } = await import('../app/api/stripe/webhook/route')
  return POST(new Request('http://localhost/api/stripe/webhook', { method: 'POST', body: '{}' }))
}

describe('Stripe paid-audit webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    mocks.constructEvent.mockReturnValue(completedEvent())
    mocks.selectSingle.mockResolvedValue({
      data: {
        id: 'audit-1',
        email: 'buyer@example.com',
        url: 'https://example.com',
        payment_status: 'pending',
        audit_status: 'awaiting_payment',
        processing_started_at: null,
      },
    })
    mocks.updateEq.mockResolvedValue({ error: null })
    mocks.enqueueAudit.mockResolvedValue(undefined)
    mocks.notify.mockResolvedValue(undefined)
    mocks.sendOrderConfirmationEmail.mockResolvedValue(undefined)
  })

  it('resolves the pending order by audit_id and enqueues it once', async () => {
    const response = await callWebhook()

    expect(response.status).toBe(200)
    expect(mocks.selectedEq).toHaveBeenCalledWith('id', 'audit-1')
    expect(mocks.enqueueAudit).toHaveBeenCalledTimes(1)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      stripe_session: 'cs_test_1',
      payment_status: 'paid',
      audit_status: 'queued',
      queued_at: expect.any(String),
    }))
    expect(mocks.notify).toHaveBeenCalledWith('paid_audit_received', expect.objectContaining({ audit_id: 'audit-1' }))
    expect(mocks.sendOrderConfirmationEmail).toHaveBeenCalledWith('buyer@example.com', 'https://example.com')
  })

  it('falls back to stripe_session for sessions created before audit_id metadata', async () => {
    mocks.constructEvent.mockReturnValue(completedEvent({
      email: 'legacy@example.com',
      url: 'https://legacy.example.com',
      tier: 'automated',
    }))
    const response = await callWebhook()

    expect(response.status).toBe(200)
    expect(mocks.selectedEq).toHaveBeenCalledWith('stripe_session', 'cs_test_1')
    expect(mocks.enqueueAudit).toHaveBeenCalledTimes(1)
  })

  it.each(['processing', 'done'])('does not re-enqueue an audit already %s', async (auditStatus) => {
    mocks.selectSingle.mockResolvedValue({
      data: {
        id: 'audit-1',
        email: 'buyer@example.com',
        url: 'https://example.com',
        payment_status: 'paid',
        audit_status: auditStatus,
        processing_started_at: auditStatus === 'processing' ? new Date().toISOString() : null,
      },
    })

    const first = await callWebhook()
    const second = await callWebhook()

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(mocks.enqueueAudit).not.toHaveBeenCalled()
  })

  it('returns 500 on enqueue failure and leaves the row queued', async () => {
    mocks.enqueueAudit.mockRejectedValue(new Error('Trigger unavailable'))
    const response = await callWebhook()

    expect(response.status).toBe(500)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      audit_status: 'queued',
      queued_at: expect.any(String),
    }))
    expect(mocks.notify).toHaveBeenCalledWith('audit_enqueue_failed', expect.any(Object))
    expect(mocks.sendOrderConfirmationEmail).not.toHaveBeenCalled()
  })

  it('returns 200 and keeps the audit queued when confirmation email fails', async () => {
    mocks.sendOrderConfirmationEmail.mockRejectedValue(new Error('Resend unavailable'))
    const response = await callWebhook()

    expect(response.status).toBe(200)
    expect(mocks.enqueueAudit).toHaveBeenCalledTimes(1)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ audit_status: 'queued' }))
    expect(mocks.notify).toHaveBeenCalledWith('confirmation_email_failed', expect.objectContaining({ audit_id: 'audit-1' }))
  })
})
