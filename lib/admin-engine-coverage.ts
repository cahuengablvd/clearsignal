import { FULL_AUDIT_ENGINES } from './engine-scope'

export type AdminEngineCoverage = {
  configured_engines: string[]
  engines_with_evidence: string[]
  missing_engines: string[]
  expected_combinations: number
  successful_combinations: number
  failed_or_skipped_combinations: number
  complete: boolean
}

function finiteCount(value: unknown): number {
  const count = Number(value ?? 0)
  return Number.isFinite(count) && count >= 0 ? count : 0
}

export function buildAdminEngineCoverage(report: unknown): AdminEngineCoverage | null {
  if (!report || typeof report !== 'object') return null
  const geo = (report as { geo?: unknown }).geo
  if (!geo || typeof geo !== 'object') return null

  const rawEngines = (geo as { engines_tested?: unknown }).engines_tested
  if (!Array.isArray(rawEngines)) return null

  const configuredEngines = [...FULL_AUDIT_ENGINES]
  const enginesWithEvidence = [...new Set(
    rawEngines
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.toLowerCase())
      .filter((value) => configuredEngines.includes(value as typeof configuredEngines[number]))
  )]
  const missingEngines = configuredEngines.filter((engine) => !enginesWithEvidence.includes(engine))
  const counts = (geo as { test_counts?: Record<string, unknown> }).test_counts
  const expectedCombinations = finiteCount(counts?.expected_combinations)
  const successfulCombinations = finiteCount(counts?.successful_combinations)
  const failedOrSkippedCombinations =
    finiteCount(counts?.failed_combinations) + finiteCount(counts?.skipped_combinations)

  return {
    configured_engines: configuredEngines,
    engines_with_evidence: enginesWithEvidence,
    missing_engines: missingEngines,
    expected_combinations: expectedCombinations,
    successful_combinations: successfulCombinations,
    failed_or_skipped_combinations: failedOrSkippedCombinations,
    complete: missingEngines.length === 0 && failedOrSkippedCombinations === 0,
  }
}
