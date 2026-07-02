import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { validateReport } from '../lib/report-validator'
import { sanitizeGeneratedReportValue } from '../lib/sanitize'
import { reusableGeoFromAudit } from '../lib/audit-runner'
import { buildGeoSummary } from '../lib/geo'
import type { ClearSignalReport } from '../lib/schemas'

const fixturePath = join(process.cwd(), 'tests', 'fixtures', 'golden-report-az-moving.json')
const snapshotPath = join(process.cwd(), 'tests', 'fixtures', 'golden-report-az-moving.snapshot.json')
const hasGoldenFixture = existsSync(fixturePath)
const fixtureIt = hasGoldenFixture ? it : it.skip

function loadGoldenReport(): ClearSignalReport {
  return JSON.parse(readFileSync(fixturePath, 'utf8')) as ClearSignalReport
}

function clientSafeGoldenReport(): ClearSignalReport {
  const sanitized = sanitizeGeneratedReportValue(loadGoldenReport())
  const validation = validateReport(sanitized)
  expect(validation.errors).toHaveLength(0)
  return validation.report
}

function stableClientSnapshot(report: ClearSignalReport) {
  return {
    meta: {
      url: report.meta.url,
      canonical_brand: report.meta.canonical_brand,
      domain: report.meta.domain,
      business_context: report.meta.business_context,
    },
    geo: report.geo
      ? {
          score: report.geo.ai_visibility_score,
          engines_tested: report.geo.engines_tested,
          queries_tested: report.geo.queries_tested,
          test_counts: report.geo.test_counts,
          evidence_count: report.geo.evidence.length,
          summary: report.geo.summary,
        }
      : null,
    executive_summary: report.action.executive_summary,
    top_fixes: report.action.top_fixes.map((fix) => ({
      id: fix.id,
      title: fix.title,
      category: fix.category,
      owner: fix.owner,
      contributor: fix.contributor,
      implementer: fix.implementer,
      confidence: fix.confidence,
      confidence_basis: fix.confidence_basis,
      evidence_ids: fix.evidence_ids ?? [],
      evidence_basis: fix.evidence_basis,
    })),
    ready_materials: report.ready_materials
      ? {
          meta_title: report.ready_materials.meta_title,
          meta_description: report.ready_materials.meta_description,
          cta_variants: report.ready_materials.cta_variants,
          faq: report.ready_materials.faq,
        }
      : null,
    implementation_briefs: (report.implementation_briefs || []).map((brief) => ({
      fix_title: brief.fix_title,
      acceptance_criteria: brief.acceptance_criteria,
    })),
    validation_warning_count: report.validation_warnings?.length ?? 0,
  }
}

describe('golden-report regression test', () => {
  it('documents where the AZ Moving golden fixture must live', () => {
    expect(fixturePath).toContain('golden-report-az-moving.json')
  })

  fixtureIt('sanitizer is idempotent (pass 1 === pass 2)', () => {
    const report = loadGoldenReport()
    const pass1 = sanitizeGeneratedReportValue(report)
    const pass2 = sanitizeGeneratedReportValue(pass1)

    expect(JSON.stringify(pass2)).toBe(JSON.stringify(pass1))
  })

  fixtureIt('validator has no errors on golden report', () => {
    const report = sanitizeGeneratedReportValue(loadGoldenReport())
    const validation = validateReport(report)

    expect(validation.errors).toHaveLength(0)
  })

  fixtureIt('no client artifacts or verification phrases in publishable text', () => {
    const text = JSON.stringify(clientSafeGoldenReport())

    expect(text).not.toMatch(/before publishing this wording/i)
    expect(text).not.toMatch(/should be confirmed with the business/i)
    expect(text).not.toMatch(/contact the business to confirm contact/i)
    expect(text).not.toMatch(/contact the business to confirm/i)
    expect(text).not.toMatch(/before booking/i)
    expect(text).not.toMatch(/\[insert verified data\]/i)
    expect(text).not.toMatch(/[\u0432][\u0402]/)
  })

  fixtureIt('no clipped role labels in action items', () => {
    const text = JSON.stringify(clientSafeGoldenReport())

    expect(text).not.toMatch(/\bDevelope\b/)
    expect(text).not.toMatch(/\bImpleme\b/)
    expect(text).not.toMatch(/\bCopywrite\b/)
  })

  fixtureIt('uses consistent AI visibility counts and tested engines', () => {
    const report = clientSafeGoldenReport()
    const counts = report.geo?.test_counts

    expect(counts).toBeTruthy()
    expect(counts?.expected_combinations).toBe(
      (counts?.configured_queries || 0) * (counts?.configured_engines || 0)
    )
    expect(
      (counts?.successful_combinations || 0) +
        (counts?.failed_combinations || 0) +
        (counts?.skipped_combinations || 0)
    ).toBe(counts?.expected_combinations)
    expect(report.geo?.evidence).toHaveLength(counts?.successful_combinations || 0)
    expect(report.geo?.engines_tested).toEqual(expect.arrayContaining(['perplexity', 'openai', 'claude']))
  })

  fixtureIt('exposes saved GEO evidence for regeneration reuse', () => {
    const reused = reusableGeoFromAudit({ report: clientSafeGoldenReport() })

    expect(reused).toBeTruthy()
    expect(reused?.evidence.length).toBeGreaterThan(0)
    expect(reused?.test_counts?.successful_combinations).toBe(reused?.evidence.length)
    expect(reused?.summary).toContain(`${reused?.evidence.length} successfully tested engine-query combinations`)
    expect(reused?.summary).toContain('AI visibility evidence was reused from the previous completed scan')
    expect(reused?.summary).toMatch(/Claude/i)
    expect(reused?.summary).not.toMatch(/0 of 6 tested|Perplexity and OpenAI|core reason/i)
  })

  fixtureIt('renders GEO summary from typed metrics only', () => {
    const report = clientSafeGoldenReport()
    expect(report.geo?.summary).toBe(
      buildGeoSummary({
        brand: report.geo!.brand,
        brandDomain: report.geo!.brand_domain,
        test_counts: report.geo!.test_counts!,
        mention_rate: report.geo!.mention_rate,
        citation_rate: report.geo!.citation_rate,
        ai_visibility_score: report.geo!.ai_visibility_score,
        mentionedCombinations: report.geo!.evidence.filter((e) => e.brand_mentioned).length,
        engines: report.geo!.engines_tested,
      })
    )
    expect(report.geo?.summary).toMatch(/mention rate was \d+% and citation rate was \d+%/)
  })

  it('does not reuse invalid or empty GEO evidence', () => {
    expect(reusableGeoFromAudit({ report: null })).toBeNull()
    expect(reusableGeoFromAudit({ report: { geo: { evidence: [] } } })).toBeNull()
  })

  fixtureIt('does not put unsupported credential confirmation copy into JSON-LD', () => {
    const report = clientSafeGoldenReport()
    const jsonLd = report.ready_materials?.json_ld || ''

    expect(jsonLd).not.toMatch(/Contact the business to confirm/i)
    expect(jsonLd).not.toMatch(/before booking/i)
    expect(jsonLd).not.toMatch(/holds WSIB and CVOR credentials/i)
    expect(jsonLd).not.toMatch(/carries insurance coverage/i)
  })

  fixtureIt('matches the stable client-facing golden snapshot', async () => {
    const snapshot = JSON.stringify(stableClientSnapshot(clientSafeGoldenReport()), null, 2) + '\n'
    await expect(snapshot).toMatchFileSnapshot(snapshotPath)
  })
})
