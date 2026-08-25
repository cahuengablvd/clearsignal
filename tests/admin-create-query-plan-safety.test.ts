import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { QUERY_SLOTS } from '../lib/geo/query-taxonomy'
import { intentForSlot } from '../lib/geo/query-taxonomy'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('@/lib/auth', () => ({ isValidAdminCookie: () => true, ADMIN_COOKIE: 'admin' }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
vi.mock('@/lib/audit-queue', () => ({ enqueueAudit: vi.fn() }))
vi.mock('@/lib/notify', () => ({ notify: vi.fn() }))
vi.mock('@/lib/tokens', () => ({ trySignToken: vi.fn() }))

const insufficientPlan = {
  core: [], supplemental: [], valid_core_slots: 0, review_required: true, primary_language: 'lv', markets: ['Latvia', 'Riga'],
  provenance: QUERY_SLOTS.map((slot, index) => ({
    query_id: `Q${index + 1}`, query: '', slot, intent: intentForSlot(slot), language: 'lv', language_source: 'intake', scope: 'core', source: 'generator', rationale: '', geo_scope: 'none',
    validation: { passed: false, errors: ['missing_slot'], warnings: [], regenerated: true }, state: 'unavailable', unavailable_reason: 'missing_slot',
  })),
}

describe('admin create query-plan safety', () => {
  it('does not insert or enqueue an audit from a plan with fewer than four valid core rows', async () => {
    const { POST } = await import('../app/api/admin/audits/create/route')
    const request = new NextRequest('http://localhost:3000/api/admin/audits/create', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'operator@example.com', url: 'https://example.com', competitor_1: '', competitor_2: '', competitor_3: '', icp_description: 'Buyers researching services.', query_plan: insufficientPlan,
        business_context: { target_markets_languages: 'Latvia, Riga - Latvian and Russian' },
      }),
    })
    const response = await POST(request)

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ error: 'query_plan_insufficient', query_plan: { valid_core_slots: 0 } })
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
