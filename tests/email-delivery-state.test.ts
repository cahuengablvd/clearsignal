import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  update: vi.fn(),
  send: vi.fn(),
  notify: vi.fn(),
  writeError: null as { message: string } | null,
}))

vi.mock('../lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
vi.mock('../lib/resend', () => ({ sendReportEmail: mocks.send }))
vi.mock('../lib/notify', () => ({ notify: mocks.notify }))

import { deliverAuditEmail } from '../lib/email-delivery'

function writeChain() {
  const chain = {
    eq: vi.fn(),
    then: (resolve: (value: { error: typeof mocks.writeError }) => unknown) =>
      Promise.resolve({ error: mocks.writeError }).then(resolve),
  }
  chain.eq.mockReturnValue(chain)
  return chain
}

describe('delivery state persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.writeError = null
    mocks.send.mockResolvedValue(undefined)
    mocks.notify.mockResolvedValue(undefined)
    mocks.update.mockImplementation(() => writeChain())
    mocks.from.mockImplementation(() => ({
      select: () => ({ eq: () => ({ single: async () => ({
        data: { id: 'audit-1', email: 'buyer@example.com', url: 'https://example.com', admin_notes: null, report: {} },
        error: null,
      }) }) }),
      update: mocks.update,
    }))
  })

  it('surfaces a delivered-state write failure and records delivery_failed instead', async () => {
    mocks.writeError = { message: 'database unavailable' }
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(deliverAuditEmail('audit-1')).rejects.toThrow(/audits delivery state for audit audit-1/)

    expect(mocks.update).toHaveBeenNthCalledWith(1, expect.objectContaining({ audit_status: 'delivered' }))
    expect(mocks.update).toHaveBeenNthCalledWith(2, expect.objectContaining({ audit_status: 'delivery_failed' }))
    expect(error).toHaveBeenCalledWith(expect.stringContaining('audits delivery state for audit audit-1 failed'))
    error.mockRestore()
  })
})
