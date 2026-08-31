import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = { id: string; audit_status: string; created_at: string; queued_at: string | null; last_generated_at: string | null; processing_started_at: string | null; recovery_attempts: number; admin_notes: string | null; report: null }
const mocks = vi.hoisted(() => ({ row: null as Row | null, enqueueAudit: vi.fn(), stageDeletes: 0 }))

function matches(row: Row, filters: Array<[string, string, unknown]>) {
  return filters.every(([kind, column, value]) => kind === 'eq' ? row[column as keyof Row] === value : String(row[column as keyof Row] ?? '') < String(value))
}

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === 'audit_stage_executions') return { delete: () => ({ eq: () => { mocks.stageDeletes += 1; return Promise.resolve({ error: null }) } }) }
      if (table !== 'audits') throw new Error(`Unexpected table ${table}`)
      return {
        select: () => {
          const filters: Array<[string, string, unknown]> = []
          const builder: any = { eq: (column: string, value: unknown) => { filters.push(['eq', column, value]); return builder }, lt: (column: string, value: unknown) => { filters.push(['lt', column, value]); return builder }, single: () => Promise.resolve({ data: mocks.row && matches(mocks.row, filters) ? mocks.row : null, error: null }), then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: mocks.row && matches(mocks.row, filters) ? [mocks.row] : [], error: null }).then(resolve) }
          return builder
        },
        update: (patch: Partial<Row>) => {
          const filters: Array<[string, string, unknown]> = []
          const write = () => {
            const row = mocks.row
            if (!row || !matches(row, filters)) return { data: [], error: null }
            Object.assign(row, patch)
            return { data: [{ id: row.id }], error: null }
          }
          const builder: any = { eq: (column: string, value: unknown) => { filters.push(['eq', column, value]); return builder }, lt: (column: string, value: unknown) => { filters.push(['lt', column, value]); return builder }, select: () => Promise.resolve(write()), then: (resolve: (value: unknown) => unknown) => Promise.resolve(write()).then(resolve) }
          return builder
        },
      }
    },
  },
}))
vi.mock('../lib/audit-queue', () => ({ enqueueAudit: mocks.enqueueAudit }))
vi.mock('../lib/notify', () => ({ notify: vi.fn() }))

import { claimAuditRecovery, releaseAuditRecoveryClaim } from '../lib/audit-recovery'

function fresh(status = 'queued'): Row {
  return { id: 'audit-1', audit_status: status, created_at: '2026-08-01T00:00:00.000Z', queued_at: '2026-08-01T00:00:00.000Z', last_generated_at: null, processing_started_at: status === 'processing' ? '2026-08-01T00:00:00.000Z' : null, recovery_attempts: 0, admin_notes: null, report: null }
}
function manual() { return claimAuditRecovery({ kind: 'manual', auditId: 'audit-1', observedStatus: 'queued' }) }
function sweep(kind: 'queued' | 'processing' = 'queued') {
  return claimAuditRecovery({ kind, audit: mocks.row!, cutoff: '2026-08-31T00:00:00.000Z' })
}

describe('atomic audit recovery claims', () => {
  beforeEach(() => { mocks.row = fresh(); mocks.enqueueAudit.mockReset().mockResolvedValue(undefined); mocks.stageDeletes = 0 })

  it('manual/manual produces one claim, one enqueue, and one cache clear', async () => {
    const claims = await Promise.all([manual(), manual()])
    for (const claim of claims) if (claim) { mocks.stageDeletes += 1; await mocks.enqueueAudit(claim.auditId) }
    expect(claims.filter(Boolean)).toHaveLength(1); expect(mocks.enqueueAudit).toHaveBeenCalledTimes(1); expect(mocks.stageDeletes).toBe(1)
  })

  it('manual/sweep produces one owner and one enqueue', async () => {
    const claims = await Promise.all([manual(), sweep()])
    for (const claim of claims) if (claim) await mocks.enqueueAudit(claim.auditId)
    expect(claims.filter(Boolean)).toHaveLength(1); expect(mocks.enqueueAudit).toHaveBeenCalledTimes(1)
  })

  it('sweep/sweep produces one owner and one enqueue', async () => {
    const claims = await Promise.all([sweep(), sweep()])
    for (const claim of claims) if (claim) await mocks.enqueueAudit(claim.auditId)
    expect(claims.filter(Boolean)).toHaveLength(1); expect(mocks.enqueueAudit).toHaveBeenCalledTimes(1)
  })

  it('rejects a sequential duplicate after a successful claim', async () => {
    expect(await manual()).toBeTruthy(); expect(await manual()).toBeNull(); expect(mocks.row!.audit_status).toBe('processing')
  })

  it('releases an enqueue failure to a recoverable queued row', async () => {
    const claim = await manual(); expect(claim).toBeTruthy()
    expect(await releaseAuditRecoveryClaim(claim!)).toBe(true)
    expect(mocks.row).toMatchObject({ audit_status: 'queued', processing_started_at: null, recovery_attempts: 0 })
  })

  it('does not release after a task starts and refreshes the ownership timestamp', async () => {
    const claim = await manual(); expect(claim).toBeTruthy()
    mocks.row!.processing_started_at = '2026-08-31T12:00:00.000Z'
    expect(await releaseAuditRecoveryClaim(claim!)).toBe(false)
    expect(mocks.row).toMatchObject({ audit_status: 'processing', processing_started_at: '2026-08-31T12:00:00.000Z' })
  })
})
