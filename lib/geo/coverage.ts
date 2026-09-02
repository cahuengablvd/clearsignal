import type { EngineResponse, EngineId } from './engines'

export type SampleStatus = 'ok_grounded' | 'ok_no_citations' | 'tool_failure' | 'provider_error' | 'timeout' | 'empty' | 'invalid' | 'skipped'
export const SUCCESSFUL_STATUSES: SampleStatus[] = ['ok_grounded', 'ok_no_citations']
export type ToolEvents = { search_requests: number; search_results: number; tool_errors: string[]; protocol: 'claude_web_search' | 'openai_web_search_preview' | 'perplexity_sonar' | 'none' }
// `observed_at` is '' for legacy rows synthesized from stored evidence that predates A1; an
// unknown observation date is a disclosure concern, never a coverage concern.
export type LedgerRow = { query_id: string; query: string; engine: string; sample_index: number; status: SampleStatus; status_reason?: string; tool_events?: ToolEvents; attempts: number; model?: string; http_status?: number; answer_length: number; citations_count: number; latency_ms?: number; observed_at: string; evidence_id?: string; diagnostic_answer_text?: string }
export type EngineCoverage = { engine: string; configured_queries: number; expected_samples: number; successful_samples: number; grounded_samples: number; no_citation_samples: number; tool_failure_samples: number; provider_error_samples: number; timeout_samples: number; empty_or_invalid_samples: number; skipped_samples: number; queries_with_evidence: number; gate_passed: boolean; gate_reasons: string[] }
export type CoverageGate = { passed: boolean; reasons: string[]; thresholds: { min_queries_per_engine_ratio: number; min_overall_success_ratio: number; min_valid_core_slots: number }; evaluated_at: string }
export const COVERAGE_THRESHOLDS = { MIN_QUERIES_PER_ENGINE_RATIO: 2 / 3, MIN_OVERALL_SUCCESS_RATIO: .75, MIN_VALID_CORE_SLOTS: 5 }
export const MIN_ANSWER_CHARS = 200
// Provider configurations can return substantially more than the old excerpt-oriented
// cap. Preserve the measurement text; rendering continues to use answer_excerpt.
export const ANSWER_TEXT_LIMIT = 24_000
export const DIAGNOSTIC_TEXT_LIMIT = 2000
export const TOOL_FAILURE_NARRATION = [/\brate limit/i, /unable to (?:search|browse|access the web|perform (?:a |the )?search)/i, /(?:couldn'?t|could not|can'?t|cannot) (?:perform|run|complete|use) (?:a |the )?(?:web )?search/i, /based on my training (?:data|knowledge)/i, /web search (?:tool )?(?:is |was )?(?:not available|unavailable|failed|failing|hitting)/i, /search (?:tool|results?) (?:returned|came back) (?:empty|nothing|no results)/i]
export const TOOL_NARRATION_PREAMBLE = [/^I (?:now )?(?:already )?have enough (?:information|rich data|from)/i, /^Let me compile/i, /^Based on the search results already retrieved/i, /^It seems the web search tool/i, /^Great question!?/i]

/** Human-readable engine label for client and admin diagnostics. */
export function engineDisplayName(engine: string): string {
  const normalized = (engine || '').toLowerCase()
  if (normalized === 'openai') return 'OpenAI'
  if (normalized === 'perplexity') return 'Perplexity'
  if (normalized === 'claude') return 'Claude'
  return engine ? engine[0].toUpperCase() + engine.slice(1) : engine
}

export function classifyEngineResponse(res: EngineResponse, opts: { engine: EngineId; webSearch: boolean }): { status: SampleStatus; reason?: string } {
  if (!res.ok) return { status: /timed out/i.test(res.error || '') ? 'timeout' : 'provider_error', reason: res.error }
  if (typeof res.answer !== 'string') return { status: 'invalid' }
  if (res.answer.trim().length < MIN_ANSWER_CHARS) return { status: 'empty' }
  if (!opts.webSearch) return { status: 'ok_no_citations' }
  const tools = res.tool_events
  const narration = TOOL_FAILURE_NARRATION.some((r) => r.test(res.answer))
  const searched = (tools?.search_requests || 0) > 0 || (tools?.search_results || 0) > 0
  if (opts.engine === 'perplexity') return res.citations.length ? { status: 'ok_grounded' } : { status: 'ok_no_citations', reason: 'protocol_anomaly_no_citations' }
  if (opts.engine === 'claude') {
    if ((tools?.search_results || 0) > 0) return { status: 'ok_grounded' }
    if ((tools?.tool_errors.length || 0) || narration) return { status: 'tool_failure', reason: tools?.tool_errors[0] || 'narration' }
    return { status: 'ok_no_citations', reason: searched ? 'search_without_results' : undefined }
  }
  if (res.citations.length) return { status: 'ok_grounded' }
  if ((tools?.tool_errors.length || 0) || (narration && !((tools?.search_results || 0) > 0))) return { status: 'tool_failure', reason: tools?.tool_errors[0] || 'narration' }
  return { status: 'ok_no_citations', reason: searched ? 'search_without_citations' : undefined }
}

export function deriveExcerpt(answer: string, limit = 700): { excerpt: string; offset: number } {
  const parts = answer.split(/\n\n|\n---\n/); let offset = 0; let found = false
  for (const part of parts) {
    const at = answer.indexOf(part, offset)
    if (part.trim().length >= 40 && !TOOL_NARRATION_PREAMBLE.some((r) => r.test(part.trim()))) { offset = at; found = true; break }
    offset = at + part.length
  }
  if (!found) offset = 0
  return { excerpt: answer.slice(offset, offset + limit).trimEnd(), offset }
}

/**
 * Per-engine coverage from the ledger. Expected samples per configured engine are
 * `configured_queries * samples_per_combination` (A1: n=1) - never the number of rows
 * that happen to exist, so legacy evidence (successful rows only, no timestamps) reports
 * real evidence counts against the real expectation without inventing failures.
 */
export function buildEngineCoverage(ledger: LedgerRow[], configuredQueries: number, engines: string[], opts: { samplesPerCombination?: number } = {}): EngineCoverage[] {
  const expectedPerEngine = configuredQueries * (opts.samplesPerCombination ?? 1)
  return engines.map((engine) => {
    const rows = ledger.filter((r) => r.engine === engine)
    const good = rows.filter((r) => SUCCESSFUL_STATUSES.includes(r.status))
    const min = Math.ceil(configuredQueries * COVERAGE_THRESHOLDS.MIN_QUERIES_PER_ENGINE_RATIO)
    const q = new Set(good.map((r) => r.query_id)).size
    const reasons = q < min ? [`${engineDisplayName(engine)} answered ${q} of ${configuredQueries} questions (minimum ${min})`] : []
    return {
      engine,
      configured_queries: configuredQueries,
      expected_samples: expectedPerEngine,
      successful_samples: good.length,
      grounded_samples: rows.filter((r) => r.status === 'ok_grounded').length,
      no_citation_samples: rows.filter((r) => r.status === 'ok_no_citations').length,
      tool_failure_samples: rows.filter((r) => r.status === 'tool_failure').length,
      provider_error_samples: rows.filter((r) => r.status === 'provider_error').length,
      timeout_samples: rows.filter((r) => r.status === 'timeout').length,
      empty_or_invalid_samples: rows.filter((r) => r.status === 'empty' || r.status === 'invalid').length,
      skipped_samples: rows.filter((r) => r.status === 'skipped').length,
      queries_with_evidence: q,
      gate_passed: !reasons.length,
      gate_reasons: reasons,
    }
  })
}

/**
 * Deterministic coverage gate. `configuredEngines` lets a reuse/legacy caller flag that a
 * configured engine produced no stored evidence at all (it cannot be named from evidence,
 * so only the count is reported). A4's valid-core-slot rule stays inactive until A4 passes it.
 */
export function evaluateCoverageGate(coverage: EngineCoverage[], opts: { validCoreSlots?: number; coreSlots?: number; configuredEngines?: number } = {}): CoverageGate {
  const expected = coverage.reduce((n, x) => n + x.expected_samples, 0)
  const good = coverage.reduce((n, x) => n + x.successful_samples, 0)
  const reasons = coverage.flatMap((x) => x.gate_reasons)
  if (opts.configuredEngines !== undefined && coverage.length < opts.configuredEngines) {
    const missing = opts.configuredEngines - coverage.length
    reasons.push(`${missing} configured engine${missing === 1 ? '' : 's'} produced no evidence in this scan`)
  }
  if (expected && good / expected < COVERAGE_THRESHOLDS.MIN_OVERALL_SUCCESS_RATIO) reasons.push(`Overall ${good} of ${expected} samples succeeded (minimum 75%)`)
  if (opts.validCoreSlots !== undefined && opts.validCoreSlots < COVERAGE_THRESHOLDS.MIN_VALID_CORE_SLOTS) reasons.push(`Only ${opts.validCoreSlots} of ${opts.coreSlots ?? 6} buyer situations could be tested`)
  return {
    passed: !reasons.length,
    reasons,
    thresholds: { min_queries_per_engine_ratio: COVERAGE_THRESHOLDS.MIN_QUERIES_PER_ENGINE_RATIO, min_overall_success_ratio: COVERAGE_THRESHOLDS.MIN_OVERALL_SUCCESS_RATIO, min_valid_core_slots: COVERAGE_THRESHOLDS.MIN_VALID_CORE_SLOTS },
    evaluated_at: new Date().toISOString(),
  }
}
