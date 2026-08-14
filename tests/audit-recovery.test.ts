import { describe, expect, it } from 'vitest'
import {
  isDeterministicAuditFailure,
  isProcessingStale,
  recoveryAttemptsExhausted,
  STALE_PROCESSING_MS,
} from '../lib/audit-recovery'

describe('audit recovery guard', () => {
  it('treats schema and repeated report-validation failures as deterministic non-retry failures', () => {
    expect(isDeterministicAuditFailure('Claude output failed validation after retry: ZodError: invalid enum value')).toBe(true)
    expect(isDeterministicAuditFailure('Report validation blocked PDF export: replacement_phrase at action.top_fixes.0')).toBe(true)
    expect(isDeterministicAuditFailure('Report validation blocked PDF export: empty_field at implementation_briefs.4.acceptance_criteria')).toBe(true)
    expect(isDeterministicAuditFailure('Network timeout while calling Trigger.dev')).toBe(false)
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
})
