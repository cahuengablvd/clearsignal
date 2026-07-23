import { describe, expect, it, vi } from 'vitest'
import { pollAuditStatus } from '../lib/audit-polling'

describe('audit regeneration polling', () => {
  it('polls through queued and processing until the report is reviewable', async () => {
    const states = ['queued', 'processing', 'awaiting_review']
    const refresh = vi.fn(async () => [
      { id: 'audit-1', audit_status: states.shift() || 'awaiting_review' },
    ])

    const result = await pollAuditStatus('audit-1', refresh, {
      intervalMs: 1,
      timeoutMs: 100,
      sleep: async () => undefined,
      now: (() => {
        let value = 0
        return () => value++
      })(),
    })

    expect(result?.audit_status).toBe('awaiting_review')
    expect(refresh).toHaveBeenCalledTimes(3)
  })

  it('returns null after the polling budget is exhausted', async () => {
    let now = 0
    const refresh = vi.fn(async () => [{ id: 'audit-1', audit_status: 'processing' }])

    const result = await pollAuditStatus('audit-1', refresh, {
      intervalMs: 1,
      timeoutMs: 3,
      sleep: async () => undefined,
      now: () => now++,
    })

    expect(result).toBeNull()
    expect(refresh).toHaveBeenCalled()
  })
})
