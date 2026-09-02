import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isRawPath, validateReport } from '../lib/report-validator'
import { sanitizeGeneratedReportValue } from '../lib/sanitize'
import type { ClearSignalReport } from '../lib/schemas'

const source = () => JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/golden-report-rozie.json'), 'utf8')) as ClearSignalReport

describe('RD-00 acquisition metadata raw-path protection', () => {
  it('preserves protocol and operational metadata through sanitizer and validator repair', () => {
    const acquisition_protocol = {
      version: 'rd-00 many buyers search',
      engines: [{ engine: 'claude', model_requested: 'claude-sonnet-4-6', tool_type_version: 'web_search_20260209', max_uses: 2, max_tokens: 1500, web_search_mode: 'provider_default' }],
      user_location: null,
      samples_per_combination: 1 as const,
      query_plan_hash: 'sha256:many-buyers-search',
    }
    const acquisition_operational = { provider_concurrency: [{ engine: 'claude', concurrency: 3 }] }
    const report = source()
    const input = { ...report, geo: { ...report.geo!, acquisition_protocol, acquisition_operational } }
    const sanitized = sanitizeGeneratedReportValue(input)
    const validated = validateReport(sanitized)

    expect(sanitized.geo!.acquisition_protocol).toEqual(acquisition_protocol)
    expect(validated.report.geo!.acquisition_protocol).toEqual(acquisition_protocol)
    expect(validated.report.geo!.acquisition_operational).toEqual(acquisition_operational)
    expect(isRawPath(['geo', 'acquisition_protocol', 'query_plan_hash'], 'query_plan_hash')).toBe(true)
    expect(isRawPath(['geo', 'acquisition_operational', 'provider_concurrency', '0', 'engine'], 'engine')).toBe(true)
  })
})
