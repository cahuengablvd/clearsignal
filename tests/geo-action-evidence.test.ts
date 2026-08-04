import { describe, expect, it } from 'vitest'
import { attachActionConfidence } from '../lib/action-confidence'
import {
  buildGeoActionEvidenceCatalog,
  filterGeoActionEvidenceIds,
} from '../lib/geo/action-evidence'
import { ACTION_SYSTEM, actionUserPrompt } from '../lib/prompts'
import { validateReport } from '../lib/report-validator'
import {
  ActionGenerationBlockSchema,
  type ActionBlock,
  type GeoResult,
} from '../lib/schemas'

function geoFixture(): GeoResult {
  return {
    brand: 'Acme',
    brand_domain: 'acme.example',
    queries_tested: 2,
    engines_tested: ['ChatGPT'],
    ai_visibility_score: 25,
    mention_rate: 50,
    citation_rate: 0,
    share_of_voice: 25,
    avg_position: 2,
    score_breakdown: {
      mention_rate: 50,
      citation_rate: 0,
      position_score: 50,
      share_of_voice: 25,
      weights: { mention: 0.4, citation: 0.3, position: 0.15, share_of_voice: 0.15 },
    },
    evidence: [
      {
        evidence_id: 'GEO-QUERY-001',
        engine: 'ChatGPT',
        query: 'Best analytics platform',
        query_intent: 'category_discovery',
        answer_excerpt: 'RAW ANSWER MUST NOT REACH THE ACTION PROMPT',
        citations: ['https://editorial.example/acme-alternatives'],
        brand_mentioned: false,
        brand_cited: false,
        brand_position: null,
        competitors_mentioned: ['Rival One'],
        cited_domains: ['editorial.example'],
      },
      {
        evidence_id: 'GEO-QUERY-002',
        engine: 'ChatGPT',
        query: 'Acme pricing',
        query_intent: 'pricing',
        answer_excerpt: 'ANOTHER RAW ANSWER',
        citations: ['https://reviews.example/acme'],
        brand_mentioned: true,
        brand_cited: false,
        brand_position: 2,
        competitors_mentioned: ['Rival One', 'Rival Two'],
        cited_domains: ['reviews.example'],
      },
    ],
    competitor_visibility: [
      { name: 'Rival One', mention_rate: 100 },
      { name: 'Rival Two', mention_rate: 50 },
    ],
    cited_domains_ranked: [
      { domain: 'editorial.example', count: 1 },
      { domain: 'reviews.example', count: 1 },
    ],
    missing_signals: [],
    recommendations: [],
    summary: 'Measured summary.',
    source_gap_analysis: [
      {
        cited_source: 'editorial.example',
        signals_found: ['Named methodology', 'Independent comparison'],
        target_missing_signals: ['Named methodology'],
        why_this_source_gets_cited: 'Causal narrative must not enter the catalog.',
        recommended_fix: 'Raw recommendation must not enter the catalog.',
      },
    ],
  }
}

function actionFixture(): ActionBlock {
  const fixes = Array.from({ length: 5 }, (_, index) => ({
    id: index + 1,
    title: index === 0 ? 'Address the Rival One discovery gap' : `Fix ${index + 1}`,
    description: index === 0 ? 'Use the measured category discovery evidence.' : 'Evidence-based action.',
    impact: 'high' as const,
    effort: 'medium' as const,
    category: index === 0 ? 'ai_search' as const : 'copy' as const,
    ...(index === 0 ? {
      observed: 'Rival One appeared in the category discovery answer while Acme did not.',
      inferred: 'This may indicate that the tested answer had clearer evidence for Rival One; it does not establish causation.',
      recommended: 'Publish a verifiable comparison page; treat third-party inclusion as a lower-control alternative.',
      evidence_ids: ['GEO-COMP-001', 'GEO-DOMAIN-002', 'GEO-NOT-REAL'],
    } : {}),
  }))
  return {
    executive_summary: 'Summary.',
    top_fixes: fixes,
    ship_first: ['First', 'Second', 'Third'],
    ignore_for_now: ['Later', 'Later still'],
    outreach_messages: [
      { channel: 'linkedin', message: 'LinkedIn.', note: '' },
      { channel: 'email', message: 'Email.', note: '' },
      { channel: 'twitter', message: 'Twitter.', note: '' },
    ],
  }
}

describe('compact GEO evidence for the action stage', () => {
  it('builds a deterministic catalog with measured aggregates and no raw answers', () => {
    const catalog = buildGeoActionEvidenceCatalog(geoFixture())
    const serialized = JSON.stringify(catalog)

    expect(catalog.query_intent_coverage).toEqual(expect.arrayContaining([
      expect.objectContaining({
        evidence_id: 'GEO-INTENT-CATEGORY-DISCOVERY',
        intent: 'category_discovery',
        mentioned_combinations: 0,
        mention_rate: 0,
      }),
    ]))
    expect(catalog.top_competitors[0]).toEqual({
      evidence_id: 'GEO-COMP-001',
      name: 'Rival One',
      mention_count: 2,
      mention_rate: 100,
    })
    expect(catalog.cited_domains[0]).toEqual({
      evidence_id: 'GEO-DOMAIN-001',
      domain: 'editorial.example',
      citation_count: 1,
    })
    expect(catalog.source_gaps[0]).toEqual({
      evidence_id: 'GEO-SOURCE-001',
      cited_source: 'editorial.example',
      observed_characteristics: ['Named methodology', 'Independent comparison'],
      target_missing_signals: ['Named methodology'],
    })
    expect(serialized).not.toContain('RAW ANSWER')
    expect(serialized).not.toContain('Causal narrative')
    expect(serialized).not.toContain('Raw recommendation')
  })

  it('puts only the compact catalog and the three claim levels into the action prompt', () => {
    const catalog = buildGeoActionEvidenceCatalog(geoFixture())
    const prompt = actionUserPrompt('{}', '{}', 'ICP', 'Acme', undefined, undefined, catalog)

    expect(prompt).toContain('Compact GEO evidence catalog')
    expect(prompt).toContain('GEO-COMP-001')
    expect(prompt).not.toContain('RAW ANSWER')
    expect(prompt).toContain('"observed"')
    expect(prompt).toContain('"inferred"')
    expect(prompt).toContain('"recommended"')
    expect(ACTION_SYSTEM).toContain('5 prioritized fixes')
    expect(prompt).toContain('Provide exactly 5 concise fixes')
    expect(prompt).toContain('one concise sentence each')
  })

  it('keeps only catalog IDs relevant to the AI-visibility fix', () => {
    const catalog = buildGeoActionEvidenceCatalog(geoFixture())
    const fix = actionFixture().top_fixes[0]

    expect(filterGeoActionEvidenceIds(fix, catalog)).toEqual(['GEO-COMP-001'])
    const enriched = attachActionConfidence(actionFixture(), [], geoFixture())
    expect(enriched.top_fixes[0].evidence_ids).toEqual(['GEO-COMP-001'])
    expect(enriched.top_fixes[0].description).toContain('Observed:')
    expect(enriched.top_fixes[0].description).toContain('Inferred:')
    expect(enriched.top_fixes[0].description).toContain('Recommended:')
  })

  it('rechecks selected catalog IDs in the pre-save report validator', () => {
    const result = validateReport({
      meta: { url: 'https://acme.example', generated_at: '', icp_description: '', competitors: [], tier: 'automated' },
      clarity: {},
      gap: { competitor_analysis: [] },
      action: actionFixture(),
      geo: geoFixture(),
    } as any)

    expect(result.report.action.top_fixes[0].evidence_ids).toEqual(['GEO-COMP-001'])
    expect(result.report.action.top_fixes[0].evidence_basis).toBe('Based on: GEO-COMP-001')
    expect(result.warnings).toContain(
      'evidence: removed invalid or irrelevant GEO catalog ids from an AI-visibility fix (#1)'
    )
  })

  it('rejects an AI-visibility fix that does not separate claim levels', () => {
    const action = actionFixture()
    const incomplete = {
      ...action,
      top_fixes: action.top_fixes.map((fix, index) => index === 0
        ? { ...fix, observed: undefined, inferred: undefined, recommended: undefined }
        : fix),
    }

    expect(ActionGenerationBlockSchema.safeParse(incomplete).success).toBe(false)
    expect(ActionGenerationBlockSchema.safeParse(action).success).toBe(true)
  })
})
