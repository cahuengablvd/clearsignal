import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const chain: { error: unknown; eq: ReturnType<typeof vi.fn> } = {
    error: null,
    eq: vi.fn(),
  }
  chain.eq.mockImplementation(() => chain)
  return {
    rpc: vi.fn(),
    update: vi.fn(),
    from: vi.fn(),
    chain,
  }
})

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    rpc: mocks.rpc,
    from: mocks.from,
  },
}))

import { runAuditStage, type AuditExecutionContext } from '../lib/audit-execution'

const ctx: AuditExecutionContext = {
  auditId: '00000000-0000-0000-0000-000000000001',
  attempt: 0,
  trigger: 'manual_create',
  workerId: 'worker-test',
  endpoint: '/test',
}

function updateChain(error: unknown = null) {
  mocks.chain.error = error
  mocks.chain.eq.mockClear()
  mocks.update.mockReturnValue(mocks.chain)
  mocks.from.mockReturnValue({ update: mocks.update })
}

describe('audit stage execution guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.chain.eq.mockImplementation(() => mocks.chain)
    updateChain()
  })

  it('returns a persisted completed stage result without running it again', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        claimed: false,
        alreadyCompleted: true,
        executionKey: `${ctx.auditId}:audit_clarity:0`,
        result: { score: 90 },
      },
      error: null,
    })

    const run = vi.fn()
    const result = await runAuditStage(ctx, 'audit_clarity', run, (value) => value as { score: number })

    expect(result).toEqual({ score: 90 })
    expect(run).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('blocks a second worker while the stage claim is active', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        claimed: false,
        alreadyCompleted: false,
        active: true,
        executionKey: `${ctx.auditId}:audit_gap:0`,
      },
      error: null,
    })

    await expect(runAuditStage(ctx, 'audit_gap', async () => ({ ok: true }))).rejects.toThrow(
      'Audit stage already active'
    )
  })

  it('marks a claimed stage completed after the runner succeeds', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        claimed: true,
        alreadyCompleted: false,
        executionKey: `${ctx.auditId}:audit_action:0`,
        claimToken: 'claim-token',
      },
      error: null,
    })

    const result = await runAuditStage(ctx, 'audit_action', async () => ({ ok: true }))

    expect(result).toEqual({ ok: true })
    expect(mocks.from).toHaveBeenCalledWith('audit_stage_executions')
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
      result: { ok: true },
    }))
  })
})
