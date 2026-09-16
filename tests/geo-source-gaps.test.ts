import { readFileSync } from 'fs'
import { join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  callClaudeJSON: vi.fn(),
  scrapeUrl: vi.fn(),
}))

vi.mock('../lib/anthropic', () => ({ callClaudeJSON: mocks.callClaudeJSON }))
vi.mock('../lib/firecrawl', () => ({ scrapeUrl: mocks.scrapeUrl }))

import { analyzeCitedSources } from '../lib/geo/sources'
import { GEO_SOURCES_SYSTEM } from '../lib/prompts'
import { validateReport } from '../lib/report-validator'

const emptySignals = {
  comparison_page: false,
  faq_structure: false,
  clear_category_language: false,
  names_competitors: false,
  review_or_proof_signals: false,
  specific_icp_language: false,
  pricing_or_use_cases: false,
  third_party_authority: false,
}

describe('cited-source gap truth contract', () => {
  beforeEach(() => {
    mocks.callClaudeJSON.mockClear()
    mocks.scrapeUrl.mockClear()
    mocks.scrapeUrl.mockResolvedValue('# Independent review page')
    mocks.callClaudeJSON.mockResolvedValue({
      target_signals: emptySignals,
      sources: [
        {
          url: 'https://reviews.example.com/best-tools',
          signals: { ...emptySignals, third_party_authority: true },
          why_cited: 'The page is independently published and compares several tools.',
          recommended_fix: 'Validate whether this source reaches relevant buyers before investing.',
        },
      ],
    })
  })

  it('shows source independence as context, never as something the first-party page is missing', async () => {
    const gaps = await analyzeCitedSources({
      brand: 'Example',
      targetUrl: 'https://brand.example',
      targetMarkdown: '# Brand homepage',
      evidence: [{ citations: ['https://reviews.example.com/best-tools'] }] as never,
      maxSources: 1,
    })

    expect(gaps).toHaveLength(1)
    expect(gaps?.[0].signals_found).toContain('Independent/editorial source')
    expect(gaps?.[0].target_missing_signals).not.toContain('Independent/editorial source')
    expect(gaps?.[0].target_missing_signals).not.toContain('Third-party authority')
  })

  it('asks for observed characteristics, not a causal explanation of citations', () => {
    expect(GEO_SOURCES_SYSTEM).toContain('observed characteristics')
    expect(GEO_SOURCES_SYSTEM).not.toMatch(/analyze why|explain why .* get cited/i)
    expect(GEO_SOURCES_SYSTEM).toContain('validate-first language')
  })

  it('preserves an unavailable cited source as an unassessed limitation without a target remedy', async () => {
    mocks.scrapeUrl.mockResolvedValueOnce(null)
    const gaps = await analyzeCitedSources({
      brand: 'Example', targetUrl: 'https://brand.example', targetMarkdown: '# Brand homepage',
      evidence: [{ citation_attachment: 'resolved', cited_urls: ['https://blocked.example/page'] }] as never,
      maxSources: 1,
    })
    expect(gaps).toEqual([expect.objectContaining({
      cited_source: 'blocked.example', signals_found: [], target_missing_signals: [], recommended_fix: '',
    })])
    expect(gaps?.[0].why_this_source_gets_cited).toMatch(/could not be retrieved.*not assessed/i)
    expect(mocks.callClaudeJSON).not.toHaveBeenCalled()
  })

  it('removes a target HTTP remedy derived only from an unavailable third-party source', () => {
    const result = validateReport({
      meta: { url: 'https://atelierframe.eu', generated_at: '', icp_description: '', competitors: [], tier: 'automated' },
      clarity: {}, gap: { competitor_analysis: [] }, action: { executive_summary: '', top_fixes: [] },
      technical_eligibility: { overall_status: 'eligible', checks: [], crawler_access: [] },
      geo: { source_gap_analysis: [{ cited_source: 'cortinascarmen.com', signals_found: [], target_missing_signals: [], why_this_source_gets_cited: 'This cited source could not be retrieved for assessment; its characteristics were not assessed.', recommended_fix: 'Ensure pages on atelierframe.eu return HTTP 200.' }] },
    } as any)
    expect(result.report.geo?.source_gap_analysis?.[0].recommended_fix).toBe('')
    expect(result.warnings).toContain('source_gap: removed target access remediation derived only from unavailable cited source (cortinascarmen.com)')
  })

  it('labels cited-source comparisons as observations on report surfaces', () => {
    for (const path of ['app/audit/[id]/page.tsx', 'app/sample/page.tsx']) {
      const reportSurface = readFileSync(join(process.cwd(), path), 'utf8')
      expect(reportSurface, path).toContain('Observed characteristics of cited sources')
      expect(reportSurface, path).not.toContain('Why these sources get cited')
    }

    const sample = readFileSync(join(process.cwd(), 'app/sample/page.tsx'), 'utf8')
    expect(sample).toContain('First validate whether G2/Capterra reaches relevant buyers')
    expect(sample).not.toContain('exactly the structured, citable content answer engines quote')
  })
})
