import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runFullAudit: vi.fn(),
  task: vi.fn((definition) => definition),
  enforceDailyAiSpendCap: vi.fn(),
  AbortTaskRunError: class AbortTaskRunError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'AbortTaskRunError'
    }
  },
  DailyAiSpendBlockedError: class DailyAiSpendBlockedError extends Error {},
  markAuditTaskStarted: vi.fn(),
  markUnhandledAuditTaskFailure: vi.fn(),
}))

vi.mock('@trigger.dev/sdk', () => ({
  queue: vi.fn((definition) => definition),
  task: mocks.task,
  AbortTaskRunError: mocks.AbortTaskRunError,
}))
vi.mock('../lib/audit-runner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/audit-runner')>()),
  runFullAudit: mocks.runFullAudit,
}))
vi.mock('../lib/daily-ai-spend', () => ({
  enforceDailyAiSpendCap: mocks.enforceDailyAiSpendCap,
  DailyAiSpendBlockedError: mocks.DailyAiSpendBlockedError,
}))
vi.mock('../lib/audit-task-lifecycle', () => ({
  markAuditTaskStarted: mocks.markAuditTaskStarted,
  markUnhandledAuditTaskFailure: mocks.markUnhandledAuditTaskFailure,
}))

import { buildGenerationMeta } from '../lib/audit-runner'
import { runAuditTask, runAuditWithDeployment } from '../trigger/audit-task'
import { latestObservedEngineVersion } from '../lib/engine-version'

describe('generation deployment identity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.enforceDailyAiSpendCap.mockResolvedValue({ queue_blocked: false })
    mocks.markAuditTaskStarted.mockResolvedValue(undefined)
    mocks.markUnhandledAuditTaskFailure.mockResolvedValue(undefined)
  })

  it('passes the Trigger deployment version into the audit run', async () => {
    await runAuditWithDeployment(
      { auditId: 'audit-123' },
      { version: '20260812.3', shortCode: 'stamp123', git: { commitSha: 'abc123def' } }
    )

    expect(mocks.runFullAudit).toHaveBeenCalledWith('audit-123', expect.objectContaining({
      engineVersion: '20260812.3',
      engineCommit: 'abc123def',
    }))
    expect(mocks.markAuditTaskStarted).toHaveBeenCalledWith('audit-123')
  })

  it('aborts task-level retries for a classified deterministic failure', async () => {
    mocks.runFullAudit.mockRejectedValueOnce(
      new Error('Report validation blocked PDF export: invalid enum value')
    )

    await expect(runAuditWithDeployment({ auditId: 'audit-deterministic' })).rejects.toMatchObject({
      name: 'AbortTaskRunError',
      message: expect.stringContaining('Report validation blocked'),
    })
    expect(mocks.markUnhandledAuditTaskFailure).not.toHaveBeenCalled()
  })

  it('does not start a queued Trigger run after earlier work consumes the cap', async () => {
    mocks.enforceDailyAiSpendCap.mockRejectedValueOnce(
      new mocks.DailyAiSpendBlockedError('Daily AI spend cap reached')
    )

    await expect(runAuditWithDeployment({ auditId: 'audit-cap-blocked' })).rejects.toMatchObject({
      name: 'AbortTaskRunError',
    })
    expect(mocks.runFullAudit).not.toHaveBeenCalled()
    expect(mocks.markUnhandledAuditTaskFailure).not.toHaveBeenCalled()
  })

  it('does not leave a queued audit behind when task-start work fails before generation', async () => {
    const startupFailure = new Error('Supabase runtime initialization failed')
    mocks.enforceDailyAiSpendCap.mockRejectedValueOnce(startupFailure)

    await expect(runAuditWithDeployment({ auditId: 'audit-startup-failure' })).rejects.toBe(startupFailure)

    expect(mocks.runFullAudit).not.toHaveBeenCalled()
    expect(mocks.markUnhandledAuditTaskFailure).toHaveBeenCalledWith(
      'audit-startup-failure',
      'Supabase runtime initialization failed'
    )
  })

  it('keeps task-level retries enabled for transient failures', async () => {
    const transient = new Error('Anthropic network timeout')
    mocks.runFullAudit.mockRejectedValueOnce(transient)

    await expect(runAuditWithDeployment({ auditId: 'audit-transient' })).rejects.toBe(transient)
    expect(mocks.markUnhandledAuditTaskFailure).toHaveBeenCalledWith('audit-transient', 'Anthropic network timeout')
    expect((runAuditTask as any).retry).toEqual({ maxAttempts: 2 })
  })

  it('writes an explicitly supplied engine version to report metadata', () => {
    expect(buildGenerationMeta({ engineVersion: '20260812.3' })).toEqual({
      engine_version: '20260812.3',
      engine_commit: undefined,
    })
  })

  it('leaves engine metadata unset for local runs', () => {
    expect(buildGenerationMeta({})).toEqual({
      engine_version: undefined,
      engine_commit: undefined,
    })
  })
})

describe('admin drift reference', () => {
  it('uses the engine version of the most recently generated report', () => {
    const version = latestObservedEngineVersion([
      { report: { meta: { engine_version: '20260812.2' } }, last_generated_at: '2026-08-12T10:00:00.000Z' },
      { report: { meta: { engine_version: '20260812.10' } }, last_generated_at: '2026-08-12T12:00:00.000Z' },
      { report: null, last_generated_at: '2026-08-12T13:00:00.000Z' },
    ])
    // Newest by generation time, not by string order: '20260812.10' < '20260812.2'.
    expect(version).toBe('20260812.10')
  })

  it('has no reference when no report recorded an engine version', () => {
    expect(latestObservedEngineVersion([{ report: null, last_generated_at: '2026-08-12T13:00:00.000Z' }])).toBeNull()
  })
})
