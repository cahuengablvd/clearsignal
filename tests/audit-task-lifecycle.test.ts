import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  updates: [] as Record<string, unknown>[],
  notes: 'existing audit note' as string | null,
  writeError: null as { message: string } | null,
}))

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { admin_notes: mocks.notes }, error: null }),
        }),
      }),
      update: (patch: Record<string, unknown>) => {
        mocks.updates.push(patch)
        const builder = {
          eq: (_column: string, _value: string) => builder,
          in: (_column: string, _values: string[]) => builder,
          is: (_column: string, _value: null) => builder,
          select: (_columns: string) => Promise.resolve({ data: [{ id: 'audit-1' }], error: mocks.writeError }),
          then: (resolve: (value: { error: typeof mocks.writeError }) => unknown) =>
            Promise.resolve({ error: mocks.writeError }).then(resolve),
        }
        return builder
      },
    }),
  },
}))

import { markAuditTaskStarted, markUnhandledAuditTaskFailure } from '../lib/audit-task-lifecycle'

describe('Trigger audit task lifecycle', () => {
  beforeEach(() => {
    mocks.updates = []
    mocks.notes = 'existing audit note'
    mocks.writeError = null
  })

  it('moves an audit out of queued as soon as the task starts', async () => {
    await markAuditTaskStarted('queued-audit', { triggerRunId: 'run-1', attempt: 1 })

    expect(mocks.updates).toEqual([expect.objectContaining({
      audit_status: 'processing',
      processing_started_at: expect.any(String),
    })])
  })

  it('records an escaped task-start failure as failed with a useful code', async () => {
    await markUnhandledAuditTaskFailure('queued-audit', 'runtime failed before generation', 'run-1')

    expect(mocks.updates).toEqual([expect.objectContaining({
      audit_status: 'failed',
      admin_notes: expect.stringContaining('task_runtime_failure: runtime failed before generation'),
    })])
  })
})
