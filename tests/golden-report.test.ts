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
    const report = loadGoldenReport()
    const validation = validateReport(report)

    expect(validation.errors).toHaveLength(0)
  })

  fixtureIt('no client artifacts or verification phrases in publishable text', () => {
    const text = JSON.stringify(loadGoldenReport())

    expect(text).not.toMatch(/before publishing this wording/i)
    expect(text).not.toMatch(/should be confirmed with the business/i)
    expect(text).not.toMatch(/contact the business to confirm contact/i)
    expect(text).not.toMatch(/\[insert verified data\]/i)
  })

  fixtureIt('no clipped role labels in action items', () => {
    const text = JSON.stringify(loadGoldenReport())

    expect(text).not.toMatch(/\bDevelope\b/)
    expect(text).not.toMatch(/\bImpleme\b/)
    expect(text).not.toMatch(/\bCopywrite\b/)
  })
})
