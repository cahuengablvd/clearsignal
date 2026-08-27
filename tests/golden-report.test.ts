import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { validateReport } from '../lib/report-validator'
import { sanitizeGeneratedReportValue } from '../lib/sanitize'
import { reusableGeoFromAudit } from '../lib/audit-runner'
import { buildGeoSummary } from '../lib/geo'
import type { ClearSignalReport } from '../lib/schemas'

const fixtureDir = join(process.cwd(), 'tests', 'fixtures')
const fixturePath = join(fixtureDir, 'golden-report-az-moving.json')
const snapshotPath = join(fixtureDir, 'golden-report-az-moving.snapshot.json')
const hasGoldenFixture = existsSync(fixturePath)
const fixtureIt = hasGoldenFixture ? it : it.skip
const verticalFixtures = [
  { slug: 'az-moving', category: 'moving', schemaBaseline: 'strict' },
  { slug: 'blvdprod', category: 'video_production', schemaBaseline: 'historical' },
  { slug: 'latvianart', category: 'art_gallery', schemaBaseline: 'historical' },
  { slug: 'monokelriga', category: 'tailoring_atelier', schemaBaseline: 'historical' },
  { slug: 'rozie', category: 'marketplace', schemaBaseline: 'strict' },
] as const

function loadGoldenReport(): ClearSignalReport {
  return JSON.parse(readFileSync(fixturePath, 'utf8')) as ClearSignalReport
}

function clientSafeGoldenReport(): ClearSignalReport {
  const source = loadGoldenReport()
  const sanitized = sanitizeGeneratedReportValue(source, undefined, undefined, {
    businessContext: source.meta.business_context,
  })
  const validation = validateReport(sanitized)
  expect(validation.errors).toEqual([])
  return validation.report
}

function loadFixture(slug: string): ClearSignalReport {
  return JSON.parse(readFileSync(join(fixtureDir, `golden-report-${slug}.json`), 'utf8')) as ClearSignalReport
}

function clientSafeFixture(
  slug: string,
  schemaBaseline: 'strict' | 'historical' = 'strict'
): ClearSignalReport {
  const source = loadFixture(slug)
  const sanitized = sanitizeGeneratedReportValue(source, undefined, undefined, {
    businessContext: source.meta.business_context,
  })
  const validation = validateReport(sanitized)
  const unexpectedErrors =
    schemaBaseline === 'historical'
      ? validation.errors.filter(
          (error) =>
            !error.startsWith('schema_mismatch') &&
            !error.startsWith('schema_deliverable_mismatch')
        )
      : validation.errors
  expect(unexpectedErrors).toEqual([])
  return validation.report
}

function clientText(report: ClearSignalReport): string {
  return JSON.stringify(report)
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
    const source = loadGoldenReport()
    const report = sanitizeGeneratedReportValue(source, undefined, undefined, {
      businessContext: source.meta.business_context,
    })
    const validation = validateReport(report)

    expect(validation.errors).toEqual([])
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
    // Legacy synthesis reports real per-engine evidence against the configured query
    // count - never fake zeros, and never "expected" shrunk to the surviving rows.
    expect(reused?.engine_coverage?.length).toBeGreaterThan(0)
    for (const row of reused?.engine_coverage ?? []) {
      expect(row.successful_samples).toBeGreaterThan(0)
      expect(row.queries_with_evidence).toBeGreaterThan(0)
      expect(row.expected_samples).toBe(reused?.test_counts?.configured_queries)
    }
    // The AZ Moving scan answered only 3 of 6 Claude questions, so the coverage gate
    // legitimately fails - and the summary must then carry no index or percentages.
    expect(reused?.coverage_gate?.passed).toBe(false)
    expect(reused?.coverage_gate?.reasons.join(' ')).toMatch(/Claude answered 3 of 6 questions/)
    expect(reused?.coverage_gate?.reasons.join(' ')).not.toMatch(/answered 0 of/)
    expect(reused?.summary).toContain('Coverage was insufficient to report an AI visibility index')
    expect(reused?.summary).toContain('AI visibility evidence was reused from the previous completed scan')
    expect(reused?.summary).not.toMatch(/\/100|mention rate was/)
  })

  fixtureIt('removes inferred answer-engine aliases from reused GEO evidence', () => {
    const report = clientSafeGoldenReport()
    report.geo!.competitor_visibility.unshift({ name: 'Google AI', mention_rate: 100 })
    report.geo!.evidence = report.geo!.evidence.map((evidence) => ({
      ...evidence,
      answer_excerpt: `Google AI. ${evidence.answer_excerpt}`,
      competitors_mentioned: [...evidence.competitors_mentioned, 'Google AI'],
    }))

    const reused = reusableGeoFromAudit({ report })

    expect(reused?.competitor_visibility.map((competitor) => competitor.name)).not.toContain('Google AI')
    expect(reused?.evidence.flatMap((evidence) => evidence.competitors_mentioned)).not.toContain('Google AI')
  })

  fixtureIt('keeps an operator-supplied answer engine out of reused competitor metrics', () => {
    const report = clientSafeGoldenReport()
    report.geo!.competitor_visibility.unshift({ name: 'Google AI', mention_rate: 100 })
    report.geo!.evidence = report.geo!.evidence.map((evidence) => ({
      ...evidence,
      answer_excerpt: `Google AI. ${evidence.answer_excerpt}`,
      competitors_mentioned: [...evidence.competitors_mentioned, 'Google AI'],
    }))

    const reused = reusableGeoFromAudit({ report, competitor_1: 'Google AI' })

    expect(reused?.competitor_visibility.map((competitor) => competitor.name)).not.toContain('Google AI')
    expect(reused?.evidence.flatMap((evidence) => evidence.competitors_mentioned)).not.toContain('Google AI')
  })

  fixtureIt('renders GEO summary from typed metrics only', () => {
    const report = clientSafeGoldenReport()
    expect(report.geo?.summary).toBe(
      buildGeoSummary({
        brand: report.geo!.brand,
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

  for (const fixture of verticalFixtures) {
    const path = join(fixtureDir, `golden-report-${fixture.slug}.json`)
    const run = existsSync(path) ? it : it.skip

    run(`keeps ${fixture.slug} fixture client-safe`, () => {
      const report = clientSafeFixture(fixture.slug, fixture.schemaBaseline)
      const text = clientText(report)
      const publishableText = JSON.stringify({
        ready_materials: report.ready_materials,
        top_fixes: report.action.top_fixes,
        implementation_briefs: report.implementation_briefs,
      })

      expect(text).not.toMatch(/before publishing this wording/i)
      expect(text).not.toMatch(/contact the business to confirm/i)
      expect(publishableText).not.toMatch(/before booking/i)
      expect(text).not.toMatch(/\[insert verified data\]/i)
      expect(text).not.toMatch(/[\u0432][\u0402]/)
    })

    run(`keeps ${fixture.slug} outreach channels unique when present`, () => {
      const report = clientSafeFixture(fixture.slug, fixture.schemaBaseline)
      const channels = report.action?.outreach_messages?.map((m) => m.channel) || []
      if (channels.length === 0) return

      expect(new Set(channels).size).toBe(channels.length)
    })

    run(`keeps ${fixture.slug} ready materials free of slash-joined locations`, () => {
      const report = clientSafeFixture(fixture.slug, fixture.schemaBaseline)
      const text = clientText(report.ready_materials as unknown as ClearSignalReport)

      expect(text).not.toMatch(/\b[A-Za-z][A-Za-z .-]{1,40}\s+\/\s+[A-Za-z][A-Za-z .-]{1,40}\s+\/\s+[A-Za-z][A-Za-z .-]{1,40}\b/)
    })

    run(`keeps ${fixture.slug} schema aligned with its vertical`, () => {
      const report = clientSafeFixture(fixture.slug, fixture.schemaBaseline)
      const jsonLd = report.ready_materials?.json_ld || ''

      if (fixture.category !== 'moving') {
        expect(jsonLd).not.toMatch(/"@type"\s*:\s*"MovingCompany"/)
      }
    })
  }

  it('keeps the Rozie marketplace and dual-ICP context without foreign vertical drift', () => {
    const report = clientSafeFixture('rozie', 'strict')
    const text = clientText(report)
    const jsonLd = JSON.parse(
      (report.ready_materials?.json_ld || '').replace(/<\/?script[^>]*>/g, '').trim()
    )
    const schemaTypes = jsonLd['@graph'].map((node: { '@type': string }) => node['@type'])

    expect(report.meta.business_context?.business_model).toBe('two_sided_marketplace')
    expect(schemaTypes).toEqual(expect.arrayContaining(['Organization', 'OfferCatalog', 'FAQPage']))
    expect(report.meta.icp_description).toMatch(/Secondary ICP:/)
    expect(text).not.toMatch(/\bCanada\b/i)
    expect(text).not.toMatch(/\bstorage (?:company|service|facility|unit)\b/i)
    expect(text).not.toMatch(/future[- ]dated|future dates?/i)
  })
})
