import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  isValidAdminCookie: vi.fn(),
  generateAuditPDF: vi.fn(),
}))

vi.mock('@/lib/tokens', () => ({ verifyToken: mocks.verifyToken }))
vi.mock('@/lib/auth', () => ({
  ADMIN_COOKIE: 'cs_admin',
  isValidAdminCookie: mocks.isValidAdminCookie,
}))
vi.mock('@/lib/pdf', () => ({ generateAuditPDF: mocks.generateAuditPDF }))
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { url: 'https://example.com' } }) }),
      }),
    }),
  },
}))

describe('paid PDF access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyToken.mockReturnValue(false)
    mocks.isValidAdminCookie.mockReturnValue(false)
  })

  it('returns 404 without a report token or admin session', async () => {
    const { GET } = await import('../app/api/audit/[id]/pdf/route')
    const response = await GET(
      new NextRequest('https://getclearsignal.io/api/audit/audit-1/pdf'),
      { params: { id: 'audit-1' } }
    )

    expect(response.status).toBe(404)
    expect(mocks.generateAuditPDF).not.toHaveBeenCalled()
  })
})
