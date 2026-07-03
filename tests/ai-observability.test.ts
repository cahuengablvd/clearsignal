import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const state = {
    table: '',
    logs: [] as any[],
    audit: { api_cost_usd: 0, admin_notes: null as string | null },
    updates: [] as Array<{ table: string; patch: Record<string, unknown> }>,
    notifications: [] as Array<{ event: string; details: Record<string, unknown> }>,
  }
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ data: state.audit, error: null })),
    update: vi.fn((patch: Record<string, unknown>) => {
      state.updates.push({ table: state.table, patch })
      return chain
    }),
    then: (resolve: any) => {
      if (state.table === 'audit_ai_call_logs') {
        return Promise.resolve({ data: state.logs, error: null }).then(resolve)
      }
      return Promise.resolve({ data: null, error: null }).then(resolve)
    },
  }
  return {
    state,
    from: vi.fn((table: string) => {
      state.table = table
      return chain
    }),
    notify: vi.fn((event: string, details: Record<string, unknown>) => {
      state.notifications.push({ event, details })
      return Promise.resolve()
    }),
  }
})

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('../lib/notify', () => ({
  notify: mocks.notify,
}))

import { reconcileAuditAiCost } from '../lib/ai-observability'

describe('AI observability cost reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.state.table = ''
    mocks.state.logs = []
    mocks.state.audit = { api_cost_usd: 0, admin_notes: null }
    mocks.state.updates = []
    mocks.state.notifications = []
    process.env.AUDIT_AI_COST_ALERT_USD = '2.5'
    process.env.AUDIT_AI_CALL_ALERT_COUNT = '30'
  })

  it('updates audit api_cost_usd from persisted AI call logs', async () => {
    mocks.state.logs = [
      { estimated_cost_usd: 0.5, input_tokens: 100, output_tokens: 50 },
      { estimated_cost_usd: 0.75, input_tokens: 200, output_tokens: 70 },
    ]

    const summary = await reconcileAuditAiCost('audit-1')

    expect(summary?.totalUsd).toBe(1.25)
    expect(mocks.state.updates).toContainEqual({
      table: 'audits',
      patch: { api_cost_usd: 1.25 },
    })
    expect(mocks.notify).not.toHaveBeenCalled()
  })

  it('adds a one-time cost alert when the audit crosses the configured threshold', async () => {
    mocks.state.logs = [
      { estimated_cost_usd: 1.5, input_tokens: 1000, output_tokens: 500 },
      { estimated_cost_usd: 1.25, input_tokens: 2000, output_tokens: 700 },
    ]

    const summary = await reconcileAuditAiCost('audit-1')

    expect(summary?.totalUsd).toBe(2.75)
    expect(mocks.notify).toHaveBeenCalledWith('audit_cost_threshold_exceeded', expect.objectContaining({
      audit_id: 'audit-1',
      total_usd: 2.75,
      reason: 'cost',
    }))
    expect(mocks.state.updates.at(-1)?.patch.admin_notes).toContain('[cost-alert]')
  })
})
