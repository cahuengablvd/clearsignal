import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { buildGeoSummary } from '../lib/geo'
import { checkTechnicalEligibility, eligibilityInternals } from '../lib/geo/eligibility'
import { buildQueryAnalysis, classifyQueryIntent } from '../lib/geo/query-taxonomy'
import {
  attachActionRecommendationStages,
  buildStagedGeoRecommendations,
  recommendationStageLabel,
  recommendationStageFor,
  RECOMMENDATION_STAGE_LABELS,
} from '../lib/geo/recommendation-stages'
import { GeoResultSchema, type ActionBlock, type GeoEvidence } from '../lib/schemas'
import { geoQueriesUserPrompt } from '../lib/prompts'

function fetcherFor(args: { targetStatus?: number; robotsStatus?: number; robots?: string }) {
  return (async (input: URL | RequestInfo) => {
    const url = String(input)
    if (url.endsWith('/robots.txt')) {
      return new Response(args.robots || '', { status: args.robotsStatus ?? 200 })
    }
    return new Response('<html><body>ok</body></html>', {
      status: args.targetStatus ?? 200,
      headers: { 'content-type': 'text/html' },
    })
  }) as typeof fetch
}

describe('technical AI eligibility', () => {
  it('detects an engine-specific robots block without claiming every engine is blocked', async () => {
    const result = await checkTechnicalEligibility({
      url: 'https://example.com/services',
      renderedHtml: '<html><head><link rel="canonical" href="https://example.com/services"></head><body>' + 'Useful text '.repeat(30) + '</body></html>',
      markdown: 'Useful text '.repeat(30),
      fetcher: fetcherFor({
        robots: 'User-agent: OAI-SearchBot\nDisallow: /\n\nUser-agent: PerplexityBot\nAllow: /',
      }),
    })

    expect(result.overall_status).toBe('limited')
    expect(result.crawler_access.find((item) => item.crawler === 'OAI-SearchBot')?.status).toBe('blocked')
    expect(result.crawler_access.find((item) => item.crawler === 'PerplexityBot')?.status).toBe('eligible')
  })

  it('treats an explicit noindex as a global blocker', async () => {
    const result = await checkTechnicalEligibility({
      url: 'https://example.com/',
      renderedHtml: '<html><head><meta name="robots" content="noindex"></head><body>' + 'Text '.repeat(60) + '</body></html>',
      markdown: 'Text '.repeat(60),
      fetcher: fetcherFor({ robotsStatus: 404 }),
    })

    expect(result.overall_status).toBe('blocked')
    expect(result.checks.find((item) => item.id === 'ELIG-INDEX-001')?.status).toBe('blocked')
  })

  it('uses the longest matching robots rule and lets Allow win a tie', () => {
    const robots = 'User-agent: *\nDisallow: /private\nAllow: /private/public'
    expect(eligibilityInternals.crawlerAllowed(robots, 'OAI-SearchBot', '/private/file').allowed).toBe(false)
    expect(eligibilityInternals.crawlerAllowed(robots, 'OAI-SearchBot', '/private/public/page').allowed).toBe(true)
  })
})

describe('query intent taxonomy', () => {
  it('requests the six paid questions in the intended buyer-decision mix', () => {
    const prompt = geoQueriesUserPrompt('Example', 'Accounting software', 'Small firms', 6)

    expect(prompt).toContain('1. category/discovery')
    expect(prompt).toContain('2. problem/need')
    expect(prompt).toContain('3. comparison or alternatives')
    expect(prompt).toContain('4. ICP/use case')
    expect(prompt).toContain('5. trust or pricing')
    expect(prompt).toContain('6. local if geography is material')

    const reportPage = readFileSync(join(process.cwd(), 'app/audit/[id]/page.tsx'), 'utf8')
    expect(reportPage).toContain(
      'Visibility is specific to this tested query set; different buyer questions can produce different results.'
    )
  })

  it.each([
    ['best moving company near me', 'local'],
    ['Acme vs Example for enterprise teams', 'comparison'],
    ['alternatives to Acme', 'alternatives'],
    ['how much does a moving service cost', 'pricing'],
    ['most reliable certified movers', 'trust'],
    ['project management software for agencies', 'use_case'],
    ['how do I choose a moving company', 'problem'],
    ['which moving company should I hire', 'category_discovery'],
  ] as const)('classifies %s as %s', (query, intent) => {
    expect(classifyQueryIntent(query)).toBe(intent)
  })

  it('builds intent coverage from existing evidence without another model call', () => {
    const evidence: GeoEvidence[] = [
      {
        engine: 'openai', query: 'best mover near me', answer_excerpt: '', citations: [],
        brand_mentioned: true, brand_cited: false, brand_position: 1,
        competitors_mentioned: [], cited_domains: [], evidence_id: 'GEO-QUERY-001',
      },
      {
        engine: 'perplexity', query: 'best mover near me', answer_excerpt: '', citations: ['https://example.com'],
        brand_mentioned: false, brand_cited: true, brand_position: null,
        competitors_mentioned: [], cited_domains: ['example.com'], evidence_id: 'GEO-QUERY-002',
      },
    ]
    const analysis = buildQueryAnalysis(evidence)
    expect(analysis.queries).toEqual([{ query: 'best mover near me', intent: 'local' }])
    expect(analysis.coverage[0]).toMatchObject({
      intent: 'local', query_count: 1, successful_combinations: 2,
      mentioned_combinations: 1, cited_combinations: 1, mention_rate: 50, citation_rate: 50,
    })
  })
})

describe('stage-aware recommendations', () => {
  it('translates stored recommendation stages only at the display boundary', () => {
    expect(RECOMMENDATION_STAGE_LABELS).toEqual({
      ACCESS: 'Technical access',
      RETRIEVAL: 'First-party clarity/content',
      CITATION: 'Cited-source opportunity',
      ENTITY: 'Business facts/entity',
      AUTHORITY: 'Proof/third-party evidence',
      PROMINENCE: 'Messaging/comparison presence',
      MEASUREMENT: 'Re-test the same query set',
    })
    expect(recommendationStageLabel('ACCESS')).toBe('Technical access')
    expect(recommendationStageFor('Fix robots.txt crawler access')).toBe('ACCESS')
  })

  it('classifies common actions by the mechanism they address', () => {
    expect(recommendationStageFor('Allow OAI-SearchBot in robots.txt')).toBe('ACCESS')
    expect(recommendationStageFor('Add Organization JSON-LD')).toBe('ENTITY')
    expect(recommendationStageFor('Earn independent customer reviews')).toBe('AUTHORITY')
    expect(recommendationStageFor('Create an FAQ page for buyer questions')).toBe('RETRIEVAL')
    expect(recommendationStageFor('Rewrite the hero headline')).toBe('PROMINENCE')
    expect(recommendationStageFor('Re-run the same query set after launch')).toBe('MEASUREMENT')
  })

  it('puts an explicit access fix first and marks downstream work as dependent', () => {
    const staged = buildStagedGeoRecommendations(['Create a comparison page'], {
      overall_status: 'limited',
      checked_at: new Date(0).toISOString(),
      checks: [],
      crawler_access: [{
        engine: 'OpenAI / ChatGPT Search', crawler: 'OAI-SearchBot', status: 'blocked',
        detail: 'robots.txt blocks this crawler for the audited path.',
      }],
    })
    expect(staged[0]).toMatchObject({ stage: 'ACCESS', depends_on_access: false })
    expect(staged[1]).toMatchObject({ stage: 'RETRIEVAL', depends_on_access: true })
  })

  it('adds optional stages without changing the number of action items', () => {
    const action = {
      executive_summary: 'Summary', ship_first: [], ignore_for_now: [], outreach_messages: [],
      top_fixes: [{ id: 1, title: 'Rewrite the H1', description: 'Clarify positioning.', impact: 'high', effort: 'easy', category: 'copy' }],
    } as unknown as ActionBlock
    const result = attachActionRecommendationStages(action)
    expect(result.top_fixes).toHaveLength(1)
    expect(result.top_fixes[0].recommendation_stage).toBe('PROMINENCE')
  })
})

describe('measurement v2 backward compatibility', () => {
  it('continues to parse a legacy GEO result without v2 fields', () => {
    expect(GeoResultSchema.safeParse({
      brand: 'Example', brand_domain: 'example.com', queries_tested: 0, engines_tested: [],
      ai_visibility_score: 0, mention_rate: 0, citation_rate: 0, share_of_voice: 0, avg_position: null,
      score_breakdown: { mention_rate: 0, citation_rate: 0, position_score: 0, share_of_voice: 0, weights: { mention: 0.4, citation: 0.25, position: 0.2, share_of_voice: 0.15 } },
      evidence: [], competitor_visibility: [], cited_domains_ranked: [], missing_signals: [], recommendations: [], summary: '',
    }).success).toBe(true)
  })
})

describe('measurement summary truth contract', () => {
  it('does not add unmeasured causes to the deterministic GEO summary', () => {
    const summary = buildGeoSummary({
      brand: 'Example',
      test_counts: {
        configured_queries: 2,
        configured_engines: 3,
        expected_combinations: 6,
        successful_combinations: 6,
        failed_combinations: 0,
        skipped_combinations: 0,
      },
      mention_rate: 50,
      citation_rate: 16.7,
      ai_visibility_score: 34,
      mentionedCombinations: 3,
      engines: ['openai', 'claude', 'perplexity'],
    })

    expect(summary).toContain('Example was named in 3 of 6 successfully tested engine-query combinations')
    expect(summary).not.toMatch(
      /likely contributing factors|owned-page answer density|stronger third-party source visibility/i
    )
  })
})
