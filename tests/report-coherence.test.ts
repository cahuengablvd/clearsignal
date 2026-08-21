import { describe, expect, it } from 'vitest'
import { assembleMaterials } from '../lib/materials'
import { actionUserPrompt } from '../lib/prompts'
import { validateReport } from '../lib/report-validator'
import type { BusinessContext, ClearSignalReport } from '../lib/schemas'

function businessContext(businessModel: string): BusinessContext {
  return {
    business_model: businessModel,
    primary_conversion_goal: 'inquiry',
    purchase_availability: 'unknown',
    ships_internationally: 'unknown',
    provenance_or_authentication: 'unknown',
    target_markets_languages: '',
    verified_facts: '',
  }
}

function finding(id: string, status: 'present' | 'absent') {
  return {
    id,
    label: id,
    classification: 'detected' as const,
    status,
    confidence: 95,
    confidence_basis: 'Measured from rendered HTML.',
    detail: status === 'present' ? 'Signal detected.' : 'Signal not detected.',
  }
}

function report(overrides: Partial<ClearSignalReport> = {}): ClearSignalReport {
  return {
    meta: {
      url: 'https://example.com',
      generated_at: '2026-08-21T00:00:00.000Z',
      icp_description: '',
      competitors: [],
      tier: 'automated',
      canonical_brand: 'Example',
    },
    clarity: { cta: { finding: '' }, trust_proof: { finding: '' } } as ClearSignalReport['clarity'],
    gap: { competitor_analysis: [] } as unknown as ClearSignalReport['gap'],
    action: {
      executive_summary: 'Example has clear service copy. It was absent from buyer comparisons. No competitor appeared instead. Change the footer first.',
      top_fixes: [
        { id: 1, title: 'Add a verified service page', description: 'Publish a focused service page.', impact: 'high', effort: 'easy', category: 'structure' },
        { id: 2, title: 'Clarify the CTA', description: 'Make the CTA specific.', impact: 'medium', effort: 'easy', category: 'cta' },
        { id: 3, title: 'Improve proof', description: 'Add verified proof.', impact: 'medium', effort: 'medium', category: 'proof' },
      ],
      ship_first: ['Change the footer'],
      ignore_for_now: [],
      outreach_messages: [],
    },
    technical_findings: [],
    ...overrides,
  }
}

describe('report section coherence', () => {
  it('uses top_fixes[0] as the first action in the summary and ship-first list', () => {
    const result = validateReport(report())

    expect(result.report.action.top_fixes[0].title).toBe('Add a verified service page')
    expect(result.report.action.executive_summary).toMatch(/First, add a verified service page\.$/)
    expect(result.report.action.ship_first[0]).toBe('Add a verified service page')
    expect(result.warnings).toContain('action_coherence: reconciled the first action to action.top_fixes.0')
  })

  it('keeps a possessive brand summary at four sentences while replacing its final action', () => {
    const input = report()
    input.action.executive_summary = "Vertex's positioning is clear. It was absent from buyer comparisons. No competitor appeared instead. Change the footer first."

    const result = validateReport(input)
    const summary = result.report.action.executive_summary

    expect(summary.match(/[.!?](?:\s|$)/g)).toHaveLength(4)
    expect(summary).toBe("Vertex's positioning is clear. It was absent from buyer comparisons. No competitor appeared instead. First, add a verified service page.")
  })

  it('names a confirmed generic operator category without claiming it was unestablished', () => {
    const materials = assembleMaterials(
      'Vertex Spain',
      'https://vertexspain.com',
      { meta_title: '', meta_description: '', faq: [], cta_variants: [] },
      { businessContext: businessContext('local_business') }
    )

    expect(materials.meta_description).toMatch(/local business/i)
    expect(materials.meta_description).not.toMatch(/category was not established/i)
  })

  it('keeps abstaining when the operator category is genuinely unknown', () => {
    const materials = assembleMaterials(
      'Example',
      'https://example.com',
      { meta_title: '', meta_description: '', faq: [], cta_variants: [] },
      { businessContext: businessContext('unknown') }
    )

    expect(materials.meta_description).toMatch(/category was not established/i)
  })

  it('gives the action generator the deterministic signal statuses', () => {
    const prompt = actionUserPrompt(
      '{}',
      '{}',
      'buyers',
      'Example',
      undefined,
      '2026-08-21T00:00:00.000Z',
      null,
      [finding('json_ld', 'present')]
    )

    expect(prompt).toContain('Deterministic page findings')
    expect(prompt).toContain('"id":"json_ld","status":"present"')
    expect(prompt).toContain('the measured status wins over generated prose')
  })

  it.each([
    ['json_ld', 'Add JSON-LD structured data', /existing JSON-LD/i],
    ['meta_description', 'Create a meta description', /existing meta description/i],
    ['h1_present', 'Add an H1 headline', /existing H1/i],
    ['faq_structure', 'Add FAQ structure', /existing FAQ/i],
    ['cta_present', 'Add a primary CTA', /existing primary CTA/i],
  ] as const)('rewrites a %s recommendation when the deterministic finding is present', (id, title, repaired) => {
    const input = report({
      technical_findings: [finding(id, 'present')],
      action: {
        ...report().action,
        executive_summary: `Example has clear service copy. It was absent from buyer comparisons. No competitor appeared instead. ${title}.`,
        top_fixes: [
          { ...report().action.top_fixes[0], title, description: `${title} because the page is missing it.` },
          ...report().action.top_fixes.slice(1),
        ],
        ship_first: [title],
      },
    })

    const result = validateReport(input)

    expect(result.report.technical_findings?.[0].status).toBe('present')
    expect(result.report.action.top_fixes[0].title).toMatch(repaired)
    expect(result.report.action.ship_first[0]).toBe(result.report.action.top_fixes[0].title)
    expect(result.warnings.some((warning) => warning.startsWith(`finding_contradiction: ${id}`))).toBe(true)
  })

  it('rewrites an existing-signal claim when the deterministic finding is absent', () => {
    const input = report({
      technical_findings: [finding('json_ld', 'absent')],
      action: {
        ...report().action,
        executive_summary: 'Example has clear service copy. It was absent from buyer comparisons. No competitor appeared instead. Review existing JSON-LD first.',
        top_fixes: [
          { ...report().action.top_fixes[0], title: 'Review existing JSON-LD', description: 'Improve the existing JSON-LD markup.' },
          ...report().action.top_fixes.slice(1),
        ],
        ship_first: ['Review existing JSON-LD'],
      },
    })

    const result = validateReport(input)

    expect(result.report.technical_findings?.[0].status).toBe('absent')
    expect(result.report.action.top_fixes[0].title).toMatch(/Add JSON-LD structured data/i)
    expect(result.warnings.some((warning) => warning.startsWith('finding_contradiction: json_ld'))).toBe(true)
  })

  it('does not treat an additional supported schema type as a claim that all JSON-LD is missing', () => {
    const input = report({
      technical_findings: [finding('json_ld', 'present')],
      action: {
        ...report().action,
        top_fixes: [
          {
            ...report().action.top_fixes[0],
            title: 'Add LocalBusiness and Service schema markup',
            description: 'Extend the existing JSON-LD with supported business types.',
          },
          ...report().action.top_fixes.slice(1),
        ],
        ship_first: ['Add LocalBusiness and Service schema markup'],
      },
    })

    const result = validateReport(input)

    expect(result.report.action.top_fixes[0].title).toBe('Add LocalBusiness and Service schema markup')
    expect(result.warnings.some((warning) => warning.startsWith('finding_contradiction: json_ld'))).toBe(false)
  })

  it('repairs contradictory prose after a stored report is deserialized', () => {
    const stored = JSON.parse(JSON.stringify(report({
      technical_findings: [finding('json_ld', 'present')],
      action: {
        ...report().action,
        top_fixes: [
          { ...report().action.top_fixes[0], title: 'Add JSON-LD structured data', description: 'Add JSON-LD because it is missing.' },
          ...report().action.top_fixes.slice(1),
        ],
        ship_first: ['Add JSON-LD structured data'],
      },
    }))) as ClearSignalReport

    const result = validateReport(stored)

    expect(result.report.action.top_fixes[0].title).toMatch(/existing JSON-LD/i)
    expect(result.report.technical_findings?.[0].status).toBe('present')
  })
})
