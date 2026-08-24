import { FULL_AUDIT_ENGINES } from './engine-scope'
import { SUCCESSFUL_STATUSES, type CoverageGate, type EngineCoverage, type LedgerRow } from './geo/coverage'

export type AdminEngineCoverage = {
  configured_engines: string[]
  engines_with_evidence: string[]
  missing_engines: string[]
  expected_combinations: number
  successful_combinations: number
  failed_or_skipped_combinations: number
  complete: boolean
  per_engine: EngineCoverage[]
  failed_rows: Array<Pick<LedgerRow, 'query' | 'engine' | 'status' | 'status_reason' | 'attempts' | 'diagnostic_answer_text'>>
  gate: CoverageGate | null
  observed_at?: string
  evidence_age_days?: number
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

  const perEngine = Array.isArray((geo as { engine_coverage?: unknown }).engine_coverage) ? (geo as { engine_coverage: EngineCoverage[] }).engine_coverage : []
  const ledger = Array.isArray((geo as { ledger?: unknown }).ledger) ? (geo as { ledger: LedgerRow[] }).ledger : []
  const failedRows = ledger
    .filter((row) => !SUCCESSFUL_STATUSES.includes(row.status))
    .map(({ query, engine, status, status_reason, attempts, diagnostic_answer_text }) => ({
      query, engine, status, status_reason, attempts,
      diagnostic_answer_text: diagnostic_answer_text?.slice(0, 240),
    }))
  const gate = ((geo as { coverage_gate?: CoverageGate }).coverage_gate) || null
  const observedAt = (geo as { observed_at?: string }).observed_at
  const age = observedAt ? Math.max(0, Math.floor((Date.now() - Date.parse(observedAt)) / 86_400_000)) : undefined
  return {
    configured_engines: configuredEngines,
    engines_with_evidence: enginesWithEvidence,
    missing_engines: missingEngines,
    expected_combinations: expectedCombinations,
    successful_combinations: successfulCombinations,
    failed_or_skipped_combinations: failedOrSkippedCombinations,
    complete: gate ? gate.passed : missingEngines.length === 0 && failedOrSkippedCombinations === 0,
    per_engine: perEngine, failed_rows: failedRows, gate, observed_at: observedAt, evidence_age_days: age,
  }
}
