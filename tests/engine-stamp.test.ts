import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runFullAudit: vi.fn(),
  task: vi.fn((definition) => definition),
}))

vi.mock('@trigger.dev/sdk', () => ({
  queue: vi.fn((definition) => definition),
  task: mocks.task,
}))
vi.mock('../lib/audit-runner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/audit-runner')>()),
  runFullAudit: mocks.runFullAudit,
}))

import { buildGenerationMeta } from '../lib/audit-runner'
import { runAuditWithDeployment } from '../trigger/audit-task'
import { latestObservedEngineVersion } from '../lib/engine-version'

describe('generation deployment identity', () => {
  it('passes the Trigger deployment version into the audit run', async () => {
    await runAuditWithDeployment(
      { auditId: 'audit-123' },
      { version: '20260812.3', shortCode: 'stamp123', git: { commitSha: 'abc123def' } }
    )

    expect(mocks.runFullAudit).toHaveBeenCalledWith('audit-123', expect.objectContaining({
      engineVersion: '20260812.3',
      engineCommit: 'abc123def',
    }))
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
