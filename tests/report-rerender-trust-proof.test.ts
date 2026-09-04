import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { validateReport } from '../lib/report-validator'
import type { ClearSignalReport } from '../lib/schemas'

const state = vi.hoisted(() => ({
  report: null as ClearSignalReport | null,
  updates: [] as Record<string, unknown>[],
}))

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        single: vi.fn(async () => ({
          data: {
            id: 'stored-alahli-audit', report: state.report, business_context: {},
            competitor_1: 'Al Rajhi Bank', competitor_2: 'Riyad Bank', competitor_3: 'Saudi Awwal Bank',
            audit_status: 'awaiting_review', admin_notes: null,
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

vi.mock('../lib/report-versions', () => ({ archiveCurrentReportVersion: vi.fn(async () => undefined) }))

import { rerenderStoredAuditReport } from '../lib/report-rerender'

const placeholder = 'This comparative or institutional claim was not verified in this audit.'
const alahliFinding = 'The crawled content shows no mention of Saudi Central Bank supervision on the homepage. This comparative or institutional claim was not verified in this audit.No customer figures, branch counts, or app ratings appear in the crawled text. Trust signals are present in the ICP\'s evaluation criteria but absent from the observed homepage content.'

describe('stored report re-render trust-proof projection', () => {
  beforeEach(() => {
    state.updates.length = 0
    state.report = JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/golden-report-rozie.json'), 'utf8')) as ClearSignalReport
  })

  it('removes the exact stale Alahli placeholder on the persisted stored-report re-render path', async () => {
    state.report!.clarity.trust_proof.finding = alahliFinding

    await rerenderStoredAuditReport('stored-alahli-audit')

    const finalReport = state.updates.find((update) => 'report' in update)?.report as ClearSignalReport
    const finding = finalReport.clarity.trust_proof.finding
    expect(finding).toBe('The crawled content shows no mention of Saudi Central Bank supervision on the homepage. No customer figures, branch counts, or app ratings appear in the crawled text. Trust signals are present in the ICP\'s evaluation criteria but absent from the observed homepage content.')
    expect(finding).not.toContain(placeholder)
    expect(finding).not.toContain('audit.No')
    expect(finding).toContain('The crawled content shows no mention of Saudi Central Bank supervision on the homepage.')
    expect(finding).toContain('No customer figures, branch counts, or app ratings appear in the crawled text.')
    expect(finding).toContain("Trust signals are present in the ICP's evaluation criteria but absent from the observed homepage content.")
    expect(validateReport(finalReport).errors).toEqual([])
  })
})
