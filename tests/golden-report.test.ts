import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { validateReport } from '../lib/report-validator'
import { sanitizeGeneratedReportValue } from '../lib/sanitize'
import type { ClearSignalReport } from '../lib/schemas'

const fixturePath = join(process.cwd(), 'tests', 'fixtures', 'golden-report-az-moving.json')
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

  fixtureIt('does not put unsupported credential confirmation copy into JSON-LD', () => {
    const report = clientSafeGoldenReport()
    const jsonLd = report.ready_materials?.json_ld || ''

    expect(jsonLd).not.toMatch(/Contact the business to confirm/i)
    expect(jsonLd).not.toMatch(/before booking/i)
    expect(jsonLd).not.toMatch(/holds WSIB and CVOR credentials/i)
    expect(jsonLd).not.toMatch(/carries insurance coverage/i)
  })
})
