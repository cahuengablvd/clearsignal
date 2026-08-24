import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabaseAdmin: {} }))
vi.mock('../lib/anthropic', () => ({ callClaudeJSON: vi.fn() }))

import { recomputeReusedGeoEvidence } from '../lib/audit-runner'
import type { GeoResult } from '../lib/schemas'

const load = (path: string) => JSON.parse(readFileSync(join(process.cwd(), path), 'utf8'))

describe('A1 legacy/reuse coverage synthesis', () => {
  it('keeps real per-engine evidence for the legacy Rozie fixture (no fake zeros)', () => {
    const report = load('tests/fixtures/golden-report-rozie.json')
    const geo = recomputeReusedGeoEvidence(report.geo as GeoResult)

    expect(geo.ledger?.length).toBe(geo.evidence.length)
    expect(geo.engine_coverage?.length).toBe(3)
    for (const row of geo.engine_coverage ?? []) {
      // Legacy rows have no observed_at; they must still count as evidence.
      expect(row.successful_samples).toBeGreaterThan(0)
      expect(row.queries_with_evidence).toBeGreaterThan(0)
      // Expected samples come from the configured query count, not from row survival.
      expect(row.expected_samples).toBe(geo.test_counts?.configured_queries)
    }
    const reasons = geo.coverage_gate?.reasons.join(' ') ?? ''
    expect(reasons).not.toMatch(/answered 0 of/)
    // A1 sample counts are synthesized consistently for the validator.
    expect(geo.test_counts?.successful_samples).toBe(geo.evidence.length)
    expect((geo.test_counts?.grounded_samples ?? 0) + (geo.test_counts?.no_citation_samples ?? 0)).toBe(geo.evidence.length)
  })

  it('reports the honest Vertex profile: Claude 2/6, Perplexity 1/6, OpenAI 6/6, gate FAIL', () => {
    const report = load('evals/golden/vertex.json')
    const geo = recomputeReusedGeoEvidence(report.geo as GeoResult)

    const byEngine = Object.fromEntries((geo.engine_coverage ?? []).map((row) => [row.engine, row]))
    expect(byEngine.claude?.successful_samples).toBe(2)
    expect(byEngine.perplexity?.successful_samples).toBe(1)
    expect(byEngine.openai?.successful_samples).toBe(6)
    expect(byEngine.claude?.expected_samples).toBe(6)
    expect(byEngine.perplexity?.expected_samples).toBe(6)
    expect(byEngine.openai?.expected_samples).toBe(6)

    expect(geo.coverage_gate?.passed).toBe(false)
    const reasons = geo.coverage_gate?.reasons.join(' ') ?? ''
    expect(reasons).toMatch(/Claude answered 2 of 6 questions/)
    expect(reasons).toMatch(/Perplexity answered 1 of 6 questions/)
    expect(reasons).not.toMatch(/OpenAI answered 0 of 6/)
    // Missing observation dates stay a disclosure concern, never a coverage reason.
    expect(reasons).not.toMatch(/observed|date|age/i)
  })

  it('recomputes mentions from full stored answers, not the 700-character excerpt', () => {
    const report = load('tests/fixtures/golden-report-rozie.json')
    const source = report.geo.evidence[0]
    const answerText = `${'Opening detail. '.repeat(60)}Rozie is named after the excerpt boundary.`
    const geo = recomputeReusedGeoEvidence({
      ...report.geo,
      brand: 'Rozie',
      evidence: [{ ...source, answer_excerpt: answerText.slice(0, 700), answer_text: answerText, brand_mentioned: true }],
      competitor_visibility: [],
      engines_tested: ['claude'],
      queries_tested: 1,
      test_counts: { ...report.geo.test_counts, configured_queries: 1, configured_engines: 1, expected_combinations: 1, successful_combinations: 1 },
    } as GeoResult)

    expect(geo.evidence[0].brand_mentioned).toBe(true)
    expect(geo.mention_rate).toBe(100)
  })
})
