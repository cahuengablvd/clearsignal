import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { sanitizeGeneratedReportValue } from '../lib/sanitize'
import { normalizeEncodingArtifacts, validateReport } from '../lib/report-validator'
import type { ClearSignalReport } from '../lib/schemas'

function validMovingReport(): ClearSignalReport {
  const source = JSON.parse(
    readFileSync(
      join(process.cwd(), 'tests', 'fixtures', 'golden-report-az-moving.json'),
      'utf8'
    )
  ) as ClearSignalReport
  const sanitized = sanitizeGeneratedReportValue(source, undefined, undefined, {
    businessContext: source.meta.business_context,
  })
  return validateReport(sanitized).report
}

describe('schema recommendation coverage', () => {
  it('normalizes typographic ligatures inside JSON-LD code', () => {
    const code = '{"pro\uFB01le":"veri\uFB01ed","o\uFB03ce":"open"}'
    const normalized = normalizeEncodingArtifacts(code)

    expect(normalized).toBe('{"profile":"verified","office":"open"}')
    expect(normalized).not.toMatch(/[\uFB00-\uFB06]/)
  })

  it('fails when a recommended schema type is absent from the attached JSON-LD', () => {
    const report = validMovingReport()
    report.action.top_fixes = [
      {
        ...report.action.top_fixes[0],
        title: 'Add VideoObject schema',
        description: 'Implement VideoObject structured data on the homepage.',
      },
    ]
    report.implementation_briefs = []

    expect(validateReport(report).errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'schema_deliverable_mismatch at action.top_fixes.0.title: VideoObject'
        ),
      ])
    )
  })

  it('accepts an explicit client-side exclusion for a type not in the deliverable', () => {
    const report = validMovingReport()
    report.action.top_fixes = [
      {
        ...report.action.top_fixes[0],
        title: 'Add structured data',
        description:
          'Consider VideoObject schema. Client-side implementation; not included in the attached JSON-LD.',
      },
    ]
    report.implementation_briefs = []

    expect(validateReport(report).errors.join('\n')).not.toContain(
      'schema_deliverable_mismatch at action.top_fixes.0.description'
    )
  })

  it('accepts a recommended type that exists in the attached JSON-LD', () => {
    const report = validMovingReport()
    report.action.top_fixes = [
      {
        ...report.action.top_fixes[0],
        title: 'Add Service schema',
        description: 'Use the attached Service structured data.',
      },
    ]
    report.implementation_briefs = []

    expect(validateReport(report).errors.join('\n')).not.toContain(
      'schema_deliverable_mismatch'
    )
  })

  it('does not treat a prohibited Review type as a recommendation', () => {
    const report = validMovingReport()
    report.action.top_fixes = [
      {
        ...report.action.top_fixes[0],
        title: 'Keep schema evidence-safe',
        description: 'Do not add Review schema without a verified review source.',
      },
    ]
    report.implementation_briefs = []

    expect(validateReport(report).errors.join('\n')).not.toContain('Review is recommended')
  })

  it('accepts MovingCompany as the delivered LocalBusiness subtype', () => {
    const report = validMovingReport()
    report.action.top_fixes = [
      {
        ...report.action.top_fixes[0],
        title: 'Add LocalBusiness schema',
        description: 'Use the attached LocalBusiness structured data.',
      },
    ]
    report.implementation_briefs = []

    expect(validateReport(report).errors.join('\n')).not.toContain(
      'LocalBusiness is recommended'
    )
  })
})
