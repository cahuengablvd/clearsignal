import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  updates: [] as Record<string, unknown>[],
  report: {
    meta: {
      canonical_brand: 'Legacy Co',
      url: 'https://legacy.example',
      domain: 'legacy.example',
      generated_at: '2026-08-04T00:00:00.000Z',
      business_context: {},
    },
    action: { top_fixes: [] },
    geo: null,
    technical_eligibility: null,
    data_limitations: [],
  },
}))

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        single: vi.fn(async () => ({
          data: {
            id: 'legacy-audit',
            report: state.report,
            business_context: {},
            audit_status: 'completed',
            admin_notes: null,
          },
          error: null,
        })),
        update: vi.fn((payload: Record<string, unknown>) => {
          state.updates.push(payload)
          return { eq: vi.fn(async () => ({ error: null })) }
        }),
      }
      return query
    }),
  },
}))

vi.mock('../lib/report-validator', () => ({
  validateReport: vi.fn((report: unknown) => ({
    report,
    errors: [
      'schema_deliverable_mismatch at ready_materials.json_ld: VideoObject is recommended but is not present in the ready-to-use JSON-LD',
    ],
    warnings: [],
  })),
}))

vi.mock('../lib/sanitize', () => ({ sanitizeGeneratedReportValue: (report: unknown) => report }))
vi.mock('../lib/audit-runner', () => ({ rebuildReusedGeoNarrative: vi.fn() }))
vi.mock('../lib/report-versions', () => ({ archiveCurrentReportVersion: vi.fn(async () => undefined) }))
vi.mock('../lib/verified-facts', () => ({ buildVerifiedFactsLayer: vi.fn(() => []) }))
vi.mock('../lib/geo/recommendation-stages', () => ({
  attachActionRecommendationStages: (action: unknown) => action,
  buildStagedGeoRecommendations: vi.fn(() => []),
}))

import { rerenderStoredAuditReport } from '../lib/report-rerender'

describe('stored report re-render validation', () => {
  beforeEach(() => {
    state.updates.length = 0
  })

  it('keeps a legacy schema mismatch reviewable without repairing client prose', async () => {
    const result = await rerenderStoredAuditReport('legacy-audit')

    expect(result.validation_warnings).toEqual([
      expect.stringContaining('schema_deliverable_mismatch'),
    ])
    expect(state.updates).toContainEqual(expect.objectContaining({
      audit_status: 'awaiting_review',
      report: expect.objectContaining({
        validation_warnings: [expect.stringContaining('schema_deliverable_mismatch')],
      }),
    }))
    expect(JSON.stringify(state.updates)).not.toContain('client-side implementation')
  })
})
