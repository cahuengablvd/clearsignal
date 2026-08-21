import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  enforceDailyAiSpendCap: vi.fn(),
  trigger: vi.fn(),
  runFullAudit: vi.fn(),
}))

vi.mock('../lib/daily-ai-spend', () => ({
  enforceDailyAiSpendCap: mocks.enforceDailyAiSpendCap,
}))
vi.mock('../trigger/audit-task', () => ({
  runAuditTask: { trigger: mocks.trigger },
}))
vi.mock('../lib/audit-runner', () => ({ runFullAudit: mocks.runFullAudit }))
vi.mock('../lib/supabase', () => ({
  supabaseAdmin: { from: vi.fn() },
}))

import { enqueueAudit } from '../lib/audit-queue'

describe('paid audit queue spend guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TRIGGER_SECRET_KEY = 'trigger-test-key'
  })

  it('refuses enqueue before a generation can start when the daily cap is blocked', async () => {
    mocks.enforceDailyAiSpendCap.mockRejectedValueOnce(
      new Error('Daily AI spend cap $2.50 reached; current UTC-day total is $2.75.')
    )

    await expect(enqueueAudit('audit-blocked')).rejects.toThrow(
      'cap $2.50 reached; current UTC-day total is $2.75'
    )
    expect(mocks.trigger).not.toHaveBeenCalled()
    expect(mocks.runFullAudit).not.toHaveBeenCalled()
  })

  it('enqueues unchanged when spend is below the cap', async () => {
    mocks.enforceDailyAiSpendCap.mockResolvedValueOnce({ queue_blocked: false })
    mocks.trigger.mockResolvedValueOnce(undefined)

    await enqueueAudit('audit-allowed', { trigger: 'manual_create', endpoint: '/admin' })

    expect(mocks.trigger).toHaveBeenCalledWith({
      auditId: 'audit-allowed',
      reuseGeoEvidence: false,
      trigger: 'manual_create',
      endpoint: '/admin',
    })
  })
})
