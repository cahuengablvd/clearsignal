import { describe, expect, it } from 'vitest'
import { finalizeReportValidation } from '../lib/audit-runner'

describe('audit validation fallback', () => {
  it('saves a report with a steps-only fifth brief and retains its validation warning', () => {
    const report = {
      meta: { url: 'https://example.com', generated_at: '', icp_description: '', competitors: [], tier: 'automated', canonical_brand: 'Example' },
      clarity: {},
      gap: { competitor_analysis: [] },
      action: { executive_summary: 'Example was reviewed.', top_fixes: [] },
      implementation_briefs: Array.from({ length: 5 }, (_, index) => ({
        fix_title: `Fix ${index + 1}`,
        steps: ['Apply the verified update.', 'Check the published page against the source evidence.'],
        acceptance_criteria: index === 4 ? [] : ['Done when the verified update is live.'],
      })),
    } as any

    const validation = finalizeReportValidation(report)

    expect(validation.errors).toEqual([])
    expect(validation.report.implementation_briefs?.[4]?.steps).toEqual([
      'Apply the verified update.',
      'Check the published page against the source evidence.',
    ])
    expect(validation.warnings).toContain('implementation_briefs.4.acceptance_criteria: missing; rendered without acceptance criteria')
  })
})
