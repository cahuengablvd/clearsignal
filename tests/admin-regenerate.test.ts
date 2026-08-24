import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  audit: {
    id: 'audit-1',
    audit_status: 'awaiting_review',
    admin_notes: null as string | null,
    report: null as unknown,
  },
  selectSingle: vi.fn(),
  auditEq: vi.fn(),
  auditUpdate: vi.fn(),
  stageDelete: vi.fn(),
  stageEq: vi.fn(),
  from: vi.fn(),
  enqueueAudit: vi.fn(),
  isValidAdminCookie: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/audit-queue', () => ({
  enqueueAudit: mocks.enqueueAudit,
}))

vi.mock('@/lib/auth', () => ({
  ADMIN_COOKIE: 'admin_session',
  isValidAdminCookie: mocks.isValidAdminCookie,
}))

vi.mock('@/lib/admin-notes', () => ({
  appendAdminNote: vi.fn((existing: string | null | undefined, note: string) =>
    existing ? `${existing}\n${note}` : note
  ),
}))

import { POST } from '../app/api/audit/route'

function request(body: Record<string, unknown>) {
  return {
    cookies: {
      get: vi.fn(() => ({ value: 'valid-cookie' })),
    },
    json: vi.fn(async () => body),
  }
}

function setupSupabase({ stageDeleteError = null }: { stageDeleteError?: unknown } = {}) {
  mocks.auditEq.mockReset()
  mocks.selectSingle.mockResolvedValue({ data: mocks.audit, error: null })
  mocks.auditEq
    .mockReturnValueOnce({ single: mocks.selectSingle })
    .mockReturnValueOnce({ error: null })
  mocks.auditUpdate.mockReturnValue({ eq: mocks.auditEq })
  mocks.stageEq.mockReturnValue({ error: stageDeleteError })
  mocks.stageDelete.mockReturnValue({ eq: mocks.stageEq })
  mocks.from.mockImplementation((table: string) => {
    if (table === 'audits') {
      return {
        select: vi.fn(() => ({ eq: mocks.auditEq })),
        update: mocks.auditUpdate,
      }
    }
    if (table === 'audit_stage_executions') {
      return {
        delete: mocks.stageDelete,
      }
    }
    throw new Error(`Unexpected table: ${table}`)
  })
}

describe('admin audit regeneration route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.audit = {
      id: 'audit-1',
      audit_status: 'awaiting_review',
      admin_notes: null,
      report: null,
    }
    mocks.isValidAdminCookie.mockReturnValue(true)
    mocks.enqueueAudit.mockResolvedValue(undefined)
    setupSupabase()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('clears cached stage executions before enqueueing regeneration', async () => {
    const res = await POST(request({ audit_id: 'audit-1' }) as never)

    expect(res.status).toBe(200)
    expect(mocks.from).toHaveBeenCalledWith('audit_stage_executions')
    expect(mocks.stageDelete).toHaveBeenCalled()
    expect(mocks.stageEq).toHaveBeenCalledWith('audit_id', 'audit-1')
    expect(mocks.auditUpdate).toHaveBeenCalledWith(expect.objectContaining({
      audit_status: 'queued',
      queued_at: expect.any(String),
      recovery_attempts: 0,
    }))
    expect(mocks.enqueueAudit).toHaveBeenCalledWith('audit-1', expect.objectContaining({
      trigger: 'admin_regenerate',
      reuseGeoEvidence: true,
    }))
    expect(mocks.stageDelete.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.enqueueAudit.mock.invocationCallOrder[0]
    )
  })

  it('does not enqueue regeneration if clearing cached stages fails', async () => {
    setupSupabase({ stageDeleteError: { message: 'delete failed' } })

    const res = await POST(request({ audit_id: 'audit-1' }) as never)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body).toEqual({ error: 'Failed to clear cached audit stages' })
    expect(mocks.auditUpdate).not.toHaveBeenCalled()
    expect(mocks.enqueueAudit).not.toHaveBeenCalled()
  })

  it('warns only for old reused evidence and accepts explicit confirmation', async () => {
    mocks.audit = { id: 'audit-1', audit_status: 'awaiting_review', admin_notes: null, report: { geo: { observed_at: new Date(Date.now() - 15 * 86400000).toISOString() } } }
    setupSupabase()
    const warning = await POST(request({ audit_id: 'audit-1', reuse_geo_evidence: true }) as never)
    expect(warning.status).toBe(409)
    expect((await warning.json()).error).toBe('reuse_evidence_age_confirmation_required')
    setupSupabase()
    const confirmed = await POST(request({ audit_id: 'audit-1', reuse_geo_evidence: true, confirm_reuse_age: true }) as never)
    expect(confirmed.status).toBe(200)
  })

  it('does not warn below threshold or when legacy evidence has no observation date', async () => {
    mocks.audit = { id: 'audit-1', audit_status: 'awaiting_review', admin_notes: null, report: { geo: { observed_at: new Date().toISOString() } } }; setupSupabase()
    expect((await POST(request({ audit_id: 'audit-1' }) as never)).status).toBe(200)
    mocks.audit = { id: 'audit-1', audit_status: 'awaiting_review', admin_notes: null, report: { geo: {} } }; setupSupabase()
    expect((await POST(request({ audit_id: 'audit-1' }) as never)).status).toBe(200)
  })

  it('requires an explicit override before requeueing a deterministic failure', async () => {
    mocks.audit = {
      id: 'audit-1',
      audit_status: 'failed',
      admin_notes: 'Claude output failed validation after retry: ZodError',
      report: null,
    }
    setupSupabase()

    const res = await POST(request({ audit_id: 'audit-1' }) as never)

    expect(res.status).toBe(409)
    expect(mocks.stageDelete).not.toHaveBeenCalled()
    expect(mocks.auditUpdate).not.toHaveBeenCalled()
    expect(mocks.enqueueAudit).not.toHaveBeenCalled()
  })

  it('explicitly releases and requeues a deterministic failure with an operator audit note', async () => {
    mocks.audit = {
      id: 'audit-1',
      audit_status: 'failed',
      admin_notes: 'Claude output failed validation after retry: ZodError',
      report: null,
    }
    setupSupabase()

    const res = await POST(request({ audit_id: 'audit-1', override_deterministic_failure: true }) as never)

    expect(res.status).toBe(200)
    expect(mocks.auditUpdate).toHaveBeenCalledWith(expect.objectContaining({
      audit_status: 'queued',
      queued_at: expect.any(String),
      recovery_attempts: 0,
      admin_notes: expect.stringMatching(/Deterministic failure override.*admin operator/i),
    }))
    expect(mocks.enqueueAudit).toHaveBeenCalledWith('audit-1', expect.objectContaining({
      trigger: 'admin_regenerate',
    }))
  })
})
