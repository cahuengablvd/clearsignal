import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { buildAdminEngineCoverage } from '../lib/admin-engine-coverage'

describe('admin engine coverage', () => {
  it('flags a configured engine that produced no evidence', () => {
    const coverage = buildAdminEngineCoverage({
      geo: {
        engines_tested: ['openai', 'perplexity'],
        test_counts: {
          configured_queries: 6,
          configured_engines: 3,
          expected_combinations: 18,
          successful_combinations: 11,
          failed_combinations: 7,
          skipped_combinations: 0,
        },
      },
    })

    expect(coverage).toEqual({
      configured_engines: ['claude', 'perplexity', 'openai'],
      engines_with_evidence: ['openai', 'perplexity'],
      missing_engines: ['claude'],
      expected_combinations: 18,
      successful_combinations: 11,
      failed_or_skipped_combinations: 7,
      complete: false,
    })
  })

  it('renders the coverage gap in the admin queue before approval', () => {
    const source = readFileSync(join(process.cwd(), 'app/admin/page.tsx'), 'utf8')

    expect(source).toContain('Engine coverage gap before approval')
    expect(source).toContain('No evidence:')
    expect(source).toContain('audit.engine_coverage_summary.missing_engines')
  })
})
