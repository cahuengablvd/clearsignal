import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const state = {
    logs: [] as Array<{ estimated_cost_usd: number }>,
    logError: null as { message: string } | null,
    alertInsertError: null as { code?: string; message: string } | null,
  }

  const logQuery: any = {
    select: vi.fn(() => logQuery),
    gte: vi.fn(() => logQuery),
    lt: vi.fn(() => Promise.resolve({ data: state.logs, error: state.logError })),
  }
  const auditUpdate: any = {
    update: vi.fn(() => auditUpdate),
    eq: vi.fn(() => Promise.resolve({ error: null })),
  }
  const alertInsert = {
    insert: vi.fn(() => Promise.resolve({ error: state.alertInsertError })),
  }

  return {
    state,
    logQuery,
    auditUpdate,
    alertInsert,
    from: vi.fn((table: string) => {
      if (table === 'audit_ai_call_logs') return logQuery
      if (table === 'audits') return auditUpdate
      if (table === 'daily_ai_spend_alerts') return alertInsert
      throw new Error(`Unexpected table ${table}`)
    }),
    notify: vi.fn(() => Promise.resolve()),
  }
})

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('../lib/notify', () => ({ notify: mocks.notify }))

import {
  DailyAiSpendBlockedError,
  enforceDailyAiSpendCap,
  getDailyAiSpendStatus,
} from '../lib/daily-ai-spend'

describe('daily AI spend guard', () => {
  const originalCap = process.env.DAILY_AI_SPEND_CAP_USD

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.state.logs = []
    mocks.state.logError = null
    mocks.state.alertInsertError = null
    process.env.DAILY_AI_SPEND_CAP_USD = '2.5'
  })

  afterEach(() => {
    if (originalCap === undefined) delete process.env.DAILY_AI_SPEND_CAP_USD
    else process.env.DAILY_AI_SPEND_CAP_USD = originalCap
  })

  it('sums only the current UTC day and reports a blocked queue above the cap', async () => {
    mocks.state.logs = [
      { estimated_cost_usd: 1.4 },
      { estimated_cost_usd: 1.25 },
    ]

    const status = await getDailyAiSpendStatus(new Date('2026-08-21T12:00:00.000Z'))

    expect(status).toEqual({
      utc_date: '2026-08-21',
      spend_usd: 2.65,
      cap_usd: 2.5,
      queue_blocked: true,
    })
    expect(mocks.logQuery.gte).toHaveBeenCalledWith('created_at', '2026-08-21T00:00:00.000Z')
    expect(mocks.logQuery.lt).toHaveBeenCalledWith('created_at', '2026-08-22T00:00:00.000Z')
  })

  it('blocks the queue, names the cap and total, and alerts only once per UTC day', async () => {
    mocks.state.logs = [{ estimated_cost_usd: 2.75 }]

    await expect(
      enforceDailyAiSpendCap('audit-1', new Date('2026-08-21T12:00:00.000Z'))
    ).rejects.toEqual(expect.objectContaining({
      name: DailyAiSpendBlockedError.name,
      message: expect.stringMatching(/cap.*\$2\.50.*current.*\$2\.75/i),
    }))

    expect(mocks.auditUpdate.update).not.toHaveBeenCalled()
    expect(mocks.notify).toHaveBeenCalledTimes(1)

    mocks.state.alertInsertError = { code: '23505', message: 'duplicate key' }
    await expect(
      enforceDailyAiSpendCap('audit-2', new Date('2026-08-21T12:05:00.000Z'))
    ).rejects.toBeInstanceOf(DailyAiSpendBlockedError)
    expect(mocks.notify).toHaveBeenCalledTimes(1)
  })

  it('allows generation below the cap', async () => {
    mocks.state.logs = [{ estimated_cost_usd: 1.2 }]

    await expect(
      enforceDailyAiSpendCap('audit-1', new Date('2026-08-21T12:00:00.000Z'))
    ).resolves.toEqual(expect.objectContaining({ queue_blocked: false }))

    expect(mocks.auditUpdate.update).not.toHaveBeenCalled()
    expect(mocks.notify).not.toHaveBeenCalled()
  })
})
