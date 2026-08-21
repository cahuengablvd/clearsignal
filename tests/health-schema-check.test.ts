import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  missingColumn: 'reviewer_note',
}))

type QueryResult = { data: unknown[]; error: { message: string; code?: string } | null; count: number }

function query(result: Partial<QueryResult>) {
  const value: QueryResult = { data: [], count: 0, error: null, ...result }
  const chain = {
    limit: () => Promise.resolve(value),
    eq: () => chain,
    gte: () => chain,
    lt: () => Promise.resolve(value),
    not: () => chain,
    order: () => chain,
    then: (onfulfilled?: ((value: QueryResult) => unknown) | null, onrejected?: ((reason: unknown) => unknown) | null) =>
      Promise.resolve(value).then(onfulfilled, onrejected),
  }
  return chain
}

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      select: (column: string) => query(
        table === 'audit_ai_call_logs'
          ? { data: [{ estimated_cost_usd: 1.25 }, { estimated_cost_usd: 0.5 }] }
          : table === 'audits' && column === mocks.missingColumn
          ? { error: { code: '42703', message: `column audits.${column} does not exist` } }
          : table === 'audits' && column === 'report, last_generated_at'
            ? { data: [{ report: { meta: { engine_version: '20260810.4', engine_commit: 'worker123' } } }] }
          : {}
      ),
    }),
  },
}))
vi.mock('@/lib/auth', () => ({ isValidAdminCookie: () => true, ADMIN_COOKIE: 'admin' }))
vi.mock('@/lib/geo', () => ({ availableEngines: () => ['openai'] }))
vi.mock('@/lib/audit-recovery', () => ({ STALE_PROCESSING_MS: 1 }))

describe('authorized health schema check', () => {
  it('names a missing admin-query column when its migration is unapplied', async () => {
    const { GET } = await import('../app/api/health/route')
    const response = await GET(new NextRequest('http://localhost:3000/api/health'))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.checks.admin_audits_schema).toEqual({
      ok: false,
      type: 'live',
      detail: 'Missing audits columns: reviewer_note',
    })
    expect(body.deployment).toEqual(expect.objectContaining({
      latest_generation_engine_version: '20260810.4',
      latest_generation_engine_commit: 'worker123',
    }))
    expect(body.daily_ai_spend).toEqual(expect.objectContaining({
      spend_usd: 1.75,
      cap_usd: 5,
      queue_blocked: false,
    }))
  })
})
