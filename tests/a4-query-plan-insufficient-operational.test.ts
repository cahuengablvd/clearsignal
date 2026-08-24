import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  audit: {} as Record<string, any>,
  updates: [] as Record<string, unknown>[],
  notify: vi.fn(),
  generateValidatedQueryPlan: vi.fn(),
  runGeoScan: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: mocks.audit, error: null }) }) }),
      update: (patch: Record<string, unknown>) => {
        mocks.updates.push(patch)
        return { eq: async () => ({ error: null }) }
      },
    }),
  },
}))
vi.mock('../lib/firecrawl', () => ({
  scrapePage: vi.fn(async () => ({ markdown: '# Dental Riga\nFamily dental care in Riga.', html: '<h1>Dental Riga</h1>' })),
  scrapeUrl: vi.fn(),
}))
vi.mock('../lib/normalize-markdown', () => ({ normalizeMarkdown: (value: string) => value }))
vi.mock('../lib/scrape-quality', () => ({ requireUsableScrape: vi.fn() }))
vi.mock('../lib/brand', () => ({ resolveBrandEntity: () => ({ canonical_brand: 'Dental Riga', domain: 'dentalriga.lv', alternative_brand_forms: ['DentalRiga'] }) }))
vi.mock('../lib/business-context', () => ({ normalizeBusinessContext: (value: unknown) => value || {}, inferObservedBusinessContext: () => ({}) }))
vi.mock('../lib/verified-facts', () => ({ buildVerifiedFactsLayer: () => ({}) }))
vi.mock('../lib/findings', () => ({ computeTechnicalFindings: () => ({}) }))
vi.mock('../lib/geo/eligibility', () => ({ checkTechnicalEligibility: async () => null }))
vi.mock('../lib/geo', () => ({ generateValidatedQueryPlan: mocks.generateValidatedQueryPlan, runGeoScan: mocks.runGeoScan, validateSavedQueryPlan: vi.fn() }))
vi.mock('../lib/audit-execution', () => ({
  auditExecutionContext: () => ({ trigger: 'test', attempt: 0, workerId: 'test', endpoint: 'test' }),
  runAuditStage: (_ctx: unknown, stage: string, work: () => unknown) => stage === 'geo_scan' ? work() : {},
}))
vi.mock('../lib/ai-observability', () => ({ reconcileAuditAiCost: vi.fn(async () => null) }))
vi.mock('../lib/notify', () => ({ notify: mocks.notify }))

import { runFullAudit } from '../lib/audit-runner'
import { isDeterministicAuditFailure } from '../lib/audit-recovery'

describe('query_plan_insufficient paid-audit operation', () => {
  beforeEach(() => {
    mocks.updates = []
    mocks.notify.mockReset()
    mocks.audit = {
      id: 'a4-insufficient', url: 'https://dentalriga.lv', audit_status: 'queued', report: null,
      admin_notes: null, recovery_attempts: 0, competitor_1: null, competitor_2: null, competitor_3: null,
      icp_description: '', business_context: { target_markets_languages: 'Latvia, Riga - Latvian and Russian' }, geo_queries: null,
    }
    const error = Object.assign(new Error('query_plan_insufficient'), { deterministic: true })
    mocks.generateValidatedQueryPlan.mockReset().mockRejectedValue(error)
  })

  it('fails the audit without persisting a report and exposes a deterministic manual-correction failure', async () => {
    await expect(runFullAudit('a4-insufficient', { trigger: 'recovery', endpoint: 'test' })).rejects.toThrow('query_plan_insufficient')

    const failure = mocks.updates.at(-1) as Record<string, unknown>
    expect(failure).toMatchObject({ audit_status: 'failed' })
    expect(failure).not.toHaveProperty('report')
    expect(mocks.audit.report).toBeNull()
    expect(String(failure.admin_notes)).toContain('query_plan_insufficient')
    expect(isDeterministicAuditFailure(String(failure.admin_notes))).toBe(true)
    expect(mocks.notify).toHaveBeenCalledWith('audit_generation_failed', expect.objectContaining({ error: 'query_plan_insufficient' }))
    expect(mocks.generateValidatedQueryPlan).toHaveBeenCalledWith(expect.objectContaining({
      targetMarketsLanguages: 'Latvia, Riga - Latvian and Russian',
      brandAliases: ['Dental Riga', 'dentalriga.lv', 'DentalRiga'],
    }))
  })

  it('uses the compatible six-string GEO path when GEO_QUERY_PLAN_MODE=legacy', async () => {
    const previous = process.env.GEO_QUERY_PLAN_MODE
    process.env.GEO_QUERY_PLAN_MODE = 'legacy'
    mocks.runGeoScan.mockReset().mockRejectedValue(new Error('stop after legacy GEO invocation'))
    try {
      await expect(runFullAudit('a4-insufficient', { trigger: 'recovery', endpoint: 'test' })).rejects.toBeInstanceOf(Error)
      expect(mocks.generateValidatedQueryPlan).not.toHaveBeenCalled()
      expect(mocks.runGeoScan).toHaveBeenCalledWith(expect.objectContaining({ queryCount: 6, queryPlan: undefined, providedQueries: undefined }))
    } finally {
      if (previous === undefined) delete process.env.GEO_QUERY_PLAN_MODE
      else process.env.GEO_QUERY_PLAN_MODE = previous
    }
  })
})
