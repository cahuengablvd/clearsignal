import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  queuedRows: [] as Record<string, unknown>[],
  staleProcessingRows: [] as Record<string, unknown>[],
  enqueueAudit: vi.fn(),
  update: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: (_column: string, status: string) =>
          status === 'queued'
            ? Promise.resolve({ data: mocks.queuedRows, error: null })
            : {
                lt: () => Promise.resolve({ data: mocks.staleProcessingRows, error: null }),
              },
      }),
      update: mocks.update.mockImplementation(() => ({
        eq: () => Promise.resolve({ error: null }),
      })),
    }),
  },
}))
vi.mock('../lib/audit-queue', () => ({ enqueueAudit: mocks.enqueueAudit }))
vi.mock('../lib/notify', () => ({ notify: vi.fn() }))

import {
  DETERMINISTIC_FAILURE_OVERRIDE_MARKER,
  isDeterministicAuditFailure,
  isProcessingStale,
  isQueuedStale,
  recoverStuckAudits,
  recoveryAttemptsExhausted,
  STALE_PROCESSING_MS,
  STALE_QUEUED_MS,
} from '../lib/audit-recovery'

describe('audit recovery guard', () => {
  beforeEach(() => {
    mocks.queuedRows = []
    mocks.staleProcessingRows = []
    mocks.enqueueAudit.mockReset().mockResolvedValue(undefined)
    mocks.update.mockClear()
  })

  it('treats schema and repeated report-validation failures as deterministic non-retry failures', () => {
    expect(isDeterministicAuditFailure('Claude output failed validation after retry: ZodError: invalid enum value')).toBe(true)
    expect(isDeterministicAuditFailure('Report validation blocked PDF export: replacement_phrase at action.top_fixes.0')).toBe(true)
    expect(isDeterministicAuditFailure('Report validation blocked PDF export: empty_field at implementation_briefs.4.acceptance_criteria')).toBe(true)
    expect(isDeterministicAuditFailure('Network timeout while calling Trigger.dev')).toBe(false)
  })

  it('treats a manual override as clearing only earlier deterministic failures', () => {
    const released = [
      'Claude output failed validation after retry: ZodError',
      `[2026-08-20T12:00:00.000Z] ${DETERMINISTIC_FAILURE_OVERRIDE_MARKER} by admin operator.`,
    ].join('\n')

    expect(isDeterministicAuditFailure(released)).toBe(false)
    expect(isDeterministicAuditFailure(`${released}\nReport validation blocked after regeneration`)).toBe(true)
  })

  it('stops automatic recovery after the retry budget is exhausted', () => {
    expect(recoveryAttemptsExhausted(0)).toBe(false)
    expect(recoveryAttemptsExhausted(1)).toBe(false)
    expect(recoveryAttemptsExhausted(2)).toBe(true)
    expect(recoveryAttemptsExhausted(3)).toBe(true)
  })

  it('computes processing staleness from processing_started_at only', () => {
    const now = Date.parse('2026-07-03T12:00:00.000Z')
    expect(isProcessingStale({ processing_started_at: null }, now)).toBe(false)
    expect(isProcessingStale({ processing_started_at: '2026-07-03T11:50:01.000Z' }, now)).toBe(false)
    expect(
      isProcessingStale(
        { processing_started_at: new Date(now - STALE_PROCESSING_MS - 1).toISOString() },
        now
      )
    ).toBe(true)
  })

  it('does not recover a newly queued audit but does recover one past the threshold', () => {
    const now = Date.parse('2026-08-20T12:00:00.000Z')
    expect(isQueuedStale({
      queued_at: new Date(now - 30_000).toISOString(),
      last_generated_at: null,
      created_at: '2026-08-01T00:00:00.000Z',
    }, now)).toBe(false)
    expect(isQueuedStale({
      queued_at: new Date(now - STALE_QUEUED_MS - 1).toISOString(),
      last_generated_at: null,
      created_at: '2026-08-01T00:00:00.000Z',
    }, now)).toBe(true)
  })

  it('ages pre-migration queued rows from last_generated_at, then created_at', () => {
    const now = Date.parse('2026-08-20T12:00:00.000Z')
    expect(isQueuedStale({
      queued_at: null,
      last_generated_at: null,
      created_at: new Date(now - 30_000).toISOString(),
    }, now)).toBe(false)
    expect(isQueuedStale({
      queued_at: null,
      last_generated_at: new Date(now - STALE_QUEUED_MS - 1).toISOString(),
      created_at: new Date(now - 30_000).toISOString(),
    }, now)).toBe(true)
  })

  it('does not enqueue a recent deterministic-failure override from the recovery sweep', async () => {
    mocks.queuedRows = [{
      id: 'recent-override',
      audit_status: 'queued',
      created_at: '2026-08-01T00:00:00.000Z',
      queued_at: new Date().toISOString(),
      last_generated_at: null,
      processing_started_at: null,
      recovery_attempts: 0,
      admin_notes: `Report validation blocked\n${DETERMINISTIC_FAILURE_OVERRIDE_MARKER}`,
    }]

    const summary = await recoverStuckAudits()

    expect(summary).toEqual(expect.objectContaining({ found: 0, queued: 0, re_enqueued: 0 }))
    expect(mocks.enqueueAudit).not.toHaveBeenCalled()
  })

  it('stops a stale query-plan-insufficient audit for manual correction without scheduling a provider retry', async () => {
    mocks.queuedRows = [{
      id: 'query-plan-manual-correction',
      audit_status: 'queued',
      created_at: '2026-08-01T00:00:00.000Z',
      queued_at: new Date(Date.now() - STALE_QUEUED_MS - 1).toISOString(),
      last_generated_at: null,
      processing_started_at: null,
      recovery_attempts: 0,
      admin_notes: '[2026-08-24T00:00:00.000Z] Audit generation failed: query_plan_insufficient',
    }]

    const summary = await recoverStuckAudits()

    expect(summary).toMatchObject({ found: 1, re_enqueued: 0, deterministic_skipped: 1, failed: 1 })
    expect(mocks.enqueueAudit).not.toHaveBeenCalled()
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      audit_status: 'failed',
      admin_notes: expect.stringContaining('manual fix required'),
    }))
  })

  it('still re-enqueues stale processing audits', async () => {
    mocks.staleProcessingRows = [{
      id: 'stale-processing',
      audit_status: 'processing',
      created_at: '2026-08-01T00:00:00.000Z',
      processing_started_at: new Date(Date.now() - STALE_PROCESSING_MS - 1).toISOString(),
      recovery_attempts: 0,
      admin_notes: null,
    }]

    const summary = await recoverStuckAudits()

    expect(summary).toEqual(expect.objectContaining({
      found: 1,
      stale_processing: 1,
      re_enqueued: 1,
    }))
    expect(mocks.enqueueAudit).toHaveBeenCalledWith('stale-processing', {
      trigger: 'recovery',
      endpoint: 'audit-recovery',
    })
  })
})
