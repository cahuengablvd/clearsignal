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

  it('preserves a deterministic insufficient plan for operator diagnosis without creating an audit', async () => {
    const plan = {
      core: [], supplemental: [], valid_core_slots: 3, review_required: true, primary_language: 'lv', markets: ['Latvia', 'Riga'],
      provenance: [{ query_id: 'Q1', query: 'pakalpojums Rīgā Latvijā', slot: 'category_discovery', language: 'lv', geo_scope: 'explicit', rationale: '', intent: 'category_discovery', language_source: 'intake', scope: 'core', source: 'generator', validation: { passed: false, errors: ['geo_scope_missing'], warnings: [], regenerated: true }, state: 'unavailable', unavailable_reason: 'geo_scope_missing' }],
    }
    mocks.scrapeUrl.mockResolvedValue(null)
    mocks.generateValidatedQueryPlan.mockRejectedValue(Object.assign(new Error('query_plan_insufficient'), { deterministic: true, plan }))
    const { POST } = await import('../app/api/admin/audits/preview/route')
    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body).toMatchObject({ error: 'query_plan_insufficient', status: 'query_plan_insufficient', plan: { valid_core_slots: 3, review_required: true, provenance: [expect.objectContaining({ query_id: 'Q1', validation: expect.objectContaining({ errors: ['geo_scope_missing'] }) })] } })
  })
})
