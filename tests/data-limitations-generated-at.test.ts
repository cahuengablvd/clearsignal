import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabaseAdmin: {} }))
vi.mock('../lib/anthropic', () => ({ callClaudeJSON: vi.fn() }))

import { buildDataLimitations } from '../lib/audit-runner'
import type { GeoResult } from '../lib/schemas'

const geoWithDates = { observed_at: '2026-08-21T10:00:00.000Z', observed_until: '2026-08-21T10:05:00.000Z', evidence: [], engines_tested: ['claude'] } as unknown as GeoResult

describe('A1 generated-date disclosure', () => {
  it('uses the shared generation timestamp for a fresh report', () => {
    const limits = buildDataLimitations(geoWithDates, false, undefined, { generatedAt: '2026-08-21T10:06:00.000Z' })
    const line = limits.find((item) => item.includes('was observed between'))

    expect(line).toContain('observed between 2026-08-21 and 2026-08-21')
    expect(line).toContain('generated on 2026-08-21')
    expect(limits.join(' ')).not.toContain('unknown date')
  })

  it('still says unknown only when the generation date is genuinely missing', () => {
    const limits = buildDataLimitations(geoWithDates, false, undefined)
    expect(limits.find((item) => item.includes('was observed between'))).toContain('an unknown date')
  })

  it('keeps the honest legacy line when reused evidence has no observation date', () => {
    const legacy = { evidence: [], engines_tested: ['claude'] } as unknown as GeoResult
    const limits = buildDataLimitations(legacy, true, undefined, { generatedAt: '2026-08-21T10:06:00.000Z' })
    expect(limits.join(' ')).toContain('AI visibility evidence date is unknown for this reused report.')
  })

  it('wires the same timestamp into report.meta and the limitations call in runFullAudit', () => {
    const source = readFileSync(join(process.cwd(), 'lib/audit-runner.ts'), 'utf8')
    expect(source).toContain('generated_at: generatedAt,')
    expect(source).toContain('buildDataLimitations(geo, Boolean(reusedGeo), targetPage, { generatedAt })')
  })
})
