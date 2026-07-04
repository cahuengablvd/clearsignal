import { describe, expect, it } from 'vitest'
import { validateCriticIssues } from '../lib/quality/critic'
import type { ClearSignalReport } from '../lib/schemas'

const baseReport = {
  meta: {
    url: 'https://example.com',
    generated_at: '',
    icp_description: '',
    competitors: [],
    tier: 'automated',
    canonical_brand: 'Example',
  },
  clarity: {
    cta: {
      suggested_rewrite: 'Request a consultation',
    },
  },
  gap: {
    ai_search: {
      finding: 'Example has limited answer density.',
    },
    competitor_analysis: [],
  },
  action: {
    executive_summary: 'Example was reviewed.',
    top_fixes: [
      {
        id: 1,
        title: 'Improve FAQ',
        description: 'Add direct answers to buyer questions.',
        impact: 'high',
        effort: 'easy',
        category: 'ai_search',
        evidence_ids: ['OBS-FAQ-001'],
      },
    ],
    ship_first: [],
    ignore_for_now: [],
    outreach_messages: [],
  },
  geo: {
    ai_visibility_score: 0,
    mention_rate: 0,
    citation_rate: 0,
    test_counts: { successful_combinations: 1 },
    evidence: [{ answer: 'raw answer' }],
  },
} as unknown as ClearSignalReport

describe('quality critic shadow guards', () => {
  it('drops unresolved and protected-path issues while keeping real report paths', () => {
    const issues = validateCriticIssues(baseReport, [
      {
        id: 'Q1',
        severity: 'high',
        category: 'question_answer_mismatch',
        path: 'action.top_fixes[0].description',
        explanation: 'Action text is vague.',
        canAutoFix: true,
      },
      {
        id: 'Q2',
        severity: 'high',
        category: 'evidence_mismatch',
        path: 'action.top_fixes[0].evidence_ids',
        explanation: 'Do not touch evidence ids.',
        canAutoFix: false,
      },
      {
        id: 'Q3',
        severity: 'medium',
        category: 'other',
        path: 'readyMaterials.faq[0].answer',
        explanation: 'Invented path casing.',
        canAutoFix: false,
      },
      {
        id: 'Q4',
        severity: 'critical',
        category: 'internal_contradiction',
        path: 'geo.evidence[0].answer',
        explanation: 'Raw GEO evidence is protected.',
        canAutoFix: false,
      },
    ])

    expect(issues.map((issue) => issue.id)).toEqual(['Q1'])
  })
})
