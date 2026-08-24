import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  scrapeUrl: vi.fn(),
  generateValidatedQueryPlan: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  isValidAdminCookie: () => true,
  ADMIN_COOKIE: 'admin',
}))
vi.mock('@/lib/firecrawl', () => ({ scrapeUrl: mocks.scrapeUrl }))
vi.mock('@/lib/geo', () => ({ generateValidatedQueryPlan: mocks.generateValidatedQueryPlan }))

function request() {
  return new NextRequest('http://localhost:3000/api/admin/audits/preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      url: 'https://example.com',
      competitor_1: '',
      competitor_2: '',
      competitor_3: '',
      icp_description: 'Small businesses buying security services.',
    }),
  })
}

describe('admin preview input quality', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.generateValidatedQueryPlan.mockResolvedValue({ core: [{ query: 'Which security service should I choose?', slot: 'category_discovery', language: 'en', geo_scope: 'none', rationale: '' }], supplemental: [], provenance: [], valid_core_slots: 6, review_required: false, primary_language: 'en', markets: [] })
  })

  it('does not generate queries from a browser-verification response', async () => {
    mocks.scrapeUrl.mockResolvedValue('Just a moment... Checking your browser. Ray ID: abc123')
    const { POST } = await import('../app/api/admin/audits/preview/route')
    const response = await POST(request())

    expect(response.status).toBe(422)
    expect(mocks.generateValidatedQueryPlan).not.toHaveBeenCalled()
  })

  it('generates normally for a long legitimate page mentioning Cloudflare', async () => {
    mocks.scrapeUrl.mockResolvedValue(
      ('We implement Cloudflare. Performance & security by Cloudflare may appear in browser messages. ' +
        'Our consultants provide migrations, reviews, support, and incident response. ').repeat(20)
    )
    const { POST } = await import('../app/api/admin/audits/preview/route')
    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(mocks.generateValidatedQueryPlan).toHaveBeenCalledOnce()
  })

  it('does not invent a vertical when neither a readable page nor a description is available', async () => {
    mocks.scrapeUrl.mockResolvedValue(null)
    const emptyRequest = new NextRequest('http://localhost:3000/api/admin/audits/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com',
        competitor_1: '',
        competitor_2: '',
        competitor_3: '',
        icp_description: '',
      }),
    })
    const { POST } = await import('../app/api/admin/audits/preview/route')
    const response = await POST(emptyRequest)

    expect(response.status).toBe(422)
    expect(mocks.generateValidatedQueryPlan).not.toHaveBeenCalled()
  })
})
