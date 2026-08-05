import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/tokens', () => ({ verifyToken: () => true }))
vi.mock('@/lib/auth', () => ({ isValidAdminCookie: () => false, ADMIN_COOKIE: 'admin' }))
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              id: 'score-1',
              url: 'https://example.com',
              email: 'buyer@example.com',
              competitor_1: null,
              status: 'done',
              top_insight: 'Clarify the audience.',
              scores: {
                business_description_draft: 'Acme serves small retailers with inventory planning software.',
              },
            },
            error: null,
          }),
        }),
      }),
    }),
  },
}))

describe('score intake draft API', () => {
  it('returns the persisted draft for an authorized completed score', async () => {
    const { GET } = await import('../app/api/score/[id]/route')
    const response = await GET(
      new NextRequest('http://localhost:3000/api/score/score-1?token=valid'),
      { params: { id: 'score-1' } }
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.business_description_draft).toMatch(/small retailers/i)
    expect(payload.scores).toBeUndefined()
  })
})
