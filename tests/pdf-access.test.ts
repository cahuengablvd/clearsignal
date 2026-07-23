import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  isValidAdminCookie: vi.fn(),
  generateAuditPDF: vi.fn(),
  generateScorePDF: vi.fn(),
  checkRateLimit: vi.fn(),
}))

vi.mock('@/lib/tokens', () => ({ verifyToken: mocks.verifyToken }))
vi.mock('@/lib/auth', () => ({
  ADMIN_COOKIE: 'cs_admin',
  isValidAdminCookie: mocks.isValidAdminCookie,
}))
vi.mock('@/lib/pdf', () => ({
  generateAuditPDF: mocks.generateAuditPDF,
  generateScorePDF: mocks.generateScorePDF,
}))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: 'score-12345678', url: 'https://www.example.com/path' },
          }),
        }),
      }),
    }),
  },
}))

describe('paid PDF access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyToken.mockReturnValue(false)
    mocks.isValidAdminCookie.mockReturnValue(false)
    mocks.checkRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetAt: Date.now() + 60 * 60 * 1000,
    })
    mocks.generateScorePDF.mockResolvedValue(Buffer.from('score-pdf'))
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

  it('returns 404 for a score PDF without a valid token', async () => {
    const { GET } = await import('../app/api/score/[id]/pdf/route')
    const response = await GET(
      new NextRequest('https://getclearsignal.io/api/score/score-12345678/pdf'),
      { params: { id: 'score-12345678' } }
    )

    expect(response.status).toBe(404)
    expect(mocks.checkRateLimit).not.toHaveBeenCalled()
    expect(mocks.generateScorePDF).not.toHaveBeenCalled()
  })

  it('rate-limits repeated score PDF generation by score id', async () => {
    mocks.verifyToken.mockReturnValue(true)
    mocks.checkRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 30 * 60 * 1000,
    })

    const { GET } = await import('../app/api/score/[id]/pdf/route')
    const response = await GET(
      new NextRequest('https://getclearsignal.io/api/score/score-12345678/pdf?token=valid'),
      { params: { id: 'score-12345678' } }
    )

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toEqual({
      error: 'This score has been downloaded several times recently. Please try again in about an hour.',
    })
    expect(response.headers.get('Retry-After')).toBeTruthy()
    expect(mocks.generateScorePDF).not.toHaveBeenCalled()
  })

  it('returns a domain-based score PDF filename for authorized requests', async () => {
    mocks.verifyToken.mockReturnValue(true)

    const { GET } = await import('../app/api/score/[id]/pdf/route')
    const response = await GET(
      new NextRequest('https://getclearsignal.io/api/score/score-12345678/pdf?token=valid'),
      { params: { id: 'score-12345678' } }
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="clearsignal-score-example-com-score-12.pdf"'
    )
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      'score:pdf:score-12345678',
      5,
      60 * 60 * 1000
    )
    expect(mocks.generateScorePDF).toHaveBeenCalledWith(
      'score-12345678',
      'https://getclearsignal.io'
    )
  })
})
