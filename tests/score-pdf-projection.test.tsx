import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { GeoResult } from '../lib/schemas'

vi.mock('@/lib/supabase', () => ({ supabaseAdmin: {} }))
vi.mock('@/lib/auth', () => ({ isAdminAuthenticated: () => false }))

describe('free score PDF projection', () => {
  it('renders teaser data without full-audit content', async () => {
    const { ScorePdfView } = await import('../app/score/[id]/score-pdf-view')
    const geo = {
      ai_visibility_score: 34,
      mention_rate: 21,
      share_of_voice: 14,
      engines_tested: ['Claude'],
      evidence: [],
      test_counts: { successful_combinations: 4 },
      competitor_visibility: [{ name: 'Competitor A', mention_rate: 50 }],
      recommendations: ['PRIVATE ACTION PLAN DETAIL'],
      missing_signals: ['PRIVATE MISSING SIGNAL DETAIL'],
      source_gap_analysis: [
        {
          cited_source: 'private-source.example',
          why_this_source_gets_cited: 'PRIVATE SOURCE GAP DETAIL',
          target_missing_signals: ['PRIVATE TARGET GAP'],
        },
      ],
    } as unknown as GeoResult

    const markup = renderToStaticMarkup(
      <ScorePdfView
        id="score-12345678"
        createdAt="2026-07-23T12:00:00.000Z"
        url="https://example.com"
        scores={{
          icp: 5,
          headline: 6,
          cta: 4,
          trust: 3,
          ai_search: 2,
          geo,
        }}
        geo={geo}
        average={4}
        checkoutHref="/checkout?score_id=score-12345678&token=signed-token"
      />
    )

    expect(markup).toContain('Who AI names instead of you')
    expect(markup).toContain('Competitor A')
    expect(markup).toContain('Full multi-engine GEO scan with web search')
    expect(markup).toContain('Source gap analysis')
    expect(markup).toContain('Prioritized action plan')
    expect(markup).toContain('Source: ClearSignal AI Visibility Score — getclearsignal.io')
    expect(markup).toContain('/checkout?score_id=score-12345678&amp;token=signed-token')

    expect(markup).not.toContain('PRIVATE ACTION PLAN DETAIL')
    expect(markup).not.toContain('PRIVATE MISSING SIGNAL DETAIL')
    expect(markup).not.toContain('PRIVATE SOURCE GAP DETAIL')
    expect(markup).not.toContain('PRIVATE TARGET GAP')
    expect(markup).not.toContain('private-source.example')
  })

  it('renders legacy numeric score ids', async () => {
    const { ScorePdfView } = await import('../app/score/[id]/score-pdf-view')
    const geo = {
      ai_visibility_score: 34,
      mention_rate: 21,
      share_of_voice: 14,
      engines_tested: ['Claude'],
      evidence: [],
      competitor_visibility: [],
    } as unknown as GeoResult

    expect(() =>
      renderToStaticMarkup(
        <ScorePdfView
          id={16}
          createdAt="2026-07-23T12:00:00.000Z"
          url="https://example.com"
          scores={{ geo }}
          geo={geo}
          average={0}
          checkoutHref="/checkout?score_id=16&token=signed-token"
        />
      )
    ).not.toThrow()
  })

  it('renders an unavailable AI visibility score neutrally without substituting messaging average', async () => {
    const { ScorePdfView } = await import('../app/score/[id]/score-pdf-view')
    const geo = { ai_visibility_score: null, mention_rate: 0, share_of_voice: null, engines_tested: ['Claude'], evidence: [], competitor_visibility: [] } as unknown as GeoResult
    const markup = renderToStaticMarkup(<ScorePdfView id="score-null" createdAt={null} url="https://example.com" scores={{ geo }} geo={geo} average={7} checkoutHref={null} />)
    expect(markup).toContain('n/a')
    expect(markup).not.toContain('/100')
    expect(markup).not.toContain('text-[#A64B35]')
  })
})
