import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { QueryProvenanceSchema } from '../lib/schemas'

const mocks = vi.hoisted(() => ({
  callClaudeJSON: vi.fn(),
  scrapeUrl: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  enqueueAudit: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ isValidAdminCookie: () => true, ADMIN_COOKIE: 'admin' }))
vi.mock('@/lib/anthropic', () => ({ callClaudeJSON: mocks.callClaudeJSON }))
vi.mock('@/lib/firecrawl', () => ({ scrapeUrl: mocks.scrapeUrl }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
vi.mock('@/lib/audit-queue', () => ({ enqueueAudit: mocks.enqueueAudit }))
vi.mock('@/lib/notify', () => ({ notify: vi.fn() }))
vi.mock('@/lib/tokens', () => ({ trySignToken: () => null }))

const input = {
  url: 'https://example.com',
  competitor_1: '',
  competitor_2: '',
  competitor_3: '',
  icp_description: 'Buyers researching local business services.',
  business_context: { target_markets_languages: 'Latvia, Riga - Latvian and Russian' },
}

const slots = [
  'category_discovery', 'problem_need', 'comparison_alternatives', 'icp_use_case', 'trust_or_pricing', 'local_or_second_decision',
  'category_discovery', 'trust_or_pricing',
] as const

const queries = [
  'lab\u0101kais pakalpojums R\u012bg\u0101 Latvij\u0101',
  'k\u0101 atrast pakalpojumu R\u012bg\u0101 Latvij\u0101',
  'pakalpojumu sal\u012bdzin\u0101jums R\u012bg\u0101 Latvij\u0101',
  'pakalpojums a\u0123ent\u016br\u0101m R\u012bg\u0101 Latvij\u0101',
  'uzticams pakalpojums R\u012bg\u0101 Latvij\u0101',
  'viet\u0113js pakalpojums R\u012bg\u0101 Latvij\u0101',
  '\u043b\u0443\u0447\u0448\u0430\u044f \u0443\u0441\u043b\u0443\u0433\u0430 \u0432 \u0420\u0438\u0433\u0435 \u041b\u0430\u0442\u0432\u0438\u044f',
  '\u043d\u0430\u0434\u0435\u0436\u043d\u0430\u044f \u0443\u0441\u043b\u0443\u0433\u0430 \u0432 \u0420\u0438\u0433\u0435 \u041b\u0430\u0442\u0432\u0438\u044f',
]

function request(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
}

describe('A4 preview-to-create structured-plan contract', () => {
  it('persists the exact preview plan after stripping only scope aliases from intent_choice', async () => {
    mocks.scrapeUrl.mockResolvedValue(null)
    mocks.callClaudeJSON.mockImplementation(async ({ validate }: { validate: (data: unknown) => unknown }) => validate({
      queries: queries.map((query, index) => ({
        query, slot: slots[index], language: index < 6 ? 'lv' : 'ru', market: 'Riga', geo_scope: 'explicit', rationale: 'Fits the requested buyer-intent test set.', intent_choice: index < 6 ? 'core' : 'supplemental',
      })),
    }))
    mocks.insert.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: 'audit-1' }, error: null }) }) })
    mocks.from.mockReturnValue({ insert: mocks.insert })

    const { POST: preview } = await import('../app/api/admin/audits/preview/route')
    const previewResponse = await preview(request('/api/admin/audits/preview', input))
    const previewBody = await previewResponse.json()

    expect(previewResponse.status).toBe(200)
    expect(previewBody.plan.provenance).toHaveLength(8)
    expect(previewBody.plan.provenance.every((row: unknown) => QueryProvenanceSchema.safeParse(row).success)).toBe(true)
    expect(previewBody.plan.provenance.every((row: { intent_choice?: string }) => row.intent_choice === undefined)).toBe(true)

    const { POST: create } = await import('../app/api/admin/audits/create/route')
    const createResponse = await create(request('/api/admin/audits/create', {
      ...input, email: 'operator@example.com', queries: previewBody.queries, query_plan: previewBody.plan,
    }))

    expect(createResponse.status).toBe(200)
    expect(await createResponse.json()).toMatchObject({ audit_id: 'audit-1' })
    const inserted = mocks.insert.mock.calls[0][0]
    expect(inserted.geo_queries).toEqual(previewBody.queries)
    expect(inserted.business_context.query_plan).toEqual(previewBody.plan)
    expect(mocks.enqueueAudit).toHaveBeenCalledWith('audit-1', expect.any(Object))
  })

  it('keeps scope and intent_choice as separate schema concepts', () => {
    const base = {
      query_id: 'Q1', query: 'service in Riga Latvia', slot: 'category_discovery', intent: 'category_discovery', language: 'lv', language_source: 'intake',
      source: 'generator', rationale: 'Fits the requested buyer-intent test set.', geo_scope: 'explicit',
      validation: { passed: true, errors: [], warnings: [], regenerated: false }, state: 'valid',
    }

    expect(QueryProvenanceSchema.safeParse({ ...base, scope: 'core', intent_choice: 'trust' }).success).toBe(true)
    expect(QueryProvenanceSchema.safeParse({ ...base, query_id: 'S1', scope: 'supplemental' }).success).toBe(true)
    expect(QueryProvenanceSchema.safeParse({ ...base, scope: 'core', intent_choice: 'core' }).success).toBe(false)
    expect(QueryProvenanceSchema.safeParse({ ...base, query_id: 'S1', scope: 'supplemental', intent_choice: 'supplemental' }).success).toBe(false)
  })
})
