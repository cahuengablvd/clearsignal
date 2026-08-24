import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ auditRow: null as Record<string, unknown> | null }))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: state.auditRow, error: null }) }) }) }) },
}))
vi.mock('@/lib/auth', () => ({ isAdminAuthenticated: () => true, isValidAdminCookie: () => true, ADMIN_COOKIE: 'admin_session' }))
vi.mock('@/lib/tokens', () => ({ verifyToken: () => true, signToken: () => 't', trySignToken: () => 't' }))
vi.mock('../lib/anthropic', () => ({ callClaudeJSON: vi.fn() }))

import { recomputeReusedGeoEvidence, rebuildReusedGeoNarrative } from '../lib/audit-runner'
import { validateReport } from '../lib/report-validator'
import type { ClearSignalReport, GeoResult } from '../lib/schemas'
import AuditPage from '../app/audit/[id]/page'

const load = (path: string) => JSON.parse(readFileSync(join(process.cwd(), path), 'utf8'))
const rozie = () => load('tests/fixtures/golden-report-rozie.json') as ClearSignalReport

async function render(report: ClearSignalReport, searchParams: { pdf?: string } = {}) {
  state.auditRow = { report, audit_status: 'awaiting_review', reviewer_note: null }
  const element = await AuditPage({ params: { id: 'audit-1' }, searchParams })
  return renderToStaticMarkup(element)
}

describe('A1 gate-failed reports keep the insufficient-coverage semantics everywhere', () => {
  it('reuse narrative rebuild keeps the gate-failed summary', () => {
    const report = rozie()
    const geo = rebuildReusedGeoNarrative(report.geo as GeoResult)

    expect(geo.coverage_gate?.passed).toBe(false)
    expect(geo.summary).toContain('Coverage was insufficient to report an AI visibility index')
    expect(geo.summary).toContain('AI visibility evidence was reused from the previous completed scan')
    expect(geo.summary).not.toMatch(/\/100|mention rate was|citation rate was/)
  })

  it('validator rebuild preserves the gate-failed summary and the gate itself', () => {
    const report = rozie()
    const geo = rebuildReusedGeoNarrative(report.geo as GeoResult)
    const validated = validateReport({ ...report, geo })

    expect(validated.errors.filter((error) => error.startsWith('geo_counts'))).toEqual([])
    expect(validated.report.geo?.coverage_gate?.passed).toBe(false)
    expect(validated.report.geo?.summary).toContain('Coverage was insufficient to report an AI visibility index')
    expect(validated.report.geo?.summary).not.toMatch(/\/100|mention rate was/)
  })

  it('renders no pooled visibility percentages or score surfaces when the gate failed', async () => {
    const report = rozie()
    const geo = rebuildReusedGeoNarrative(report.geo as GeoResult)
    const markup = await render({ ...report, geo })

    expect(markup).toContain('Measurement coverage was insufficient')
    expect(markup).toContain('Coverage was insufficient to report an AI visibility index')
    expect(markup).toContain('Claude: 2/6 answers received')
    expect(markup).not.toContain('AI Visibility / 100')
    expect(markup).not.toContain('Mention rate</div>')
    expect(markup).not.toContain('Share of voice</div>')
    expect(markup).not.toContain('Score = ')
    expect(markup).not.toContain('mention-rate (')
    expect(markup).not.toContain('Visibility by buyer intent')
    expect(markup).not.toContain('Who AI recommends instead')
    expect(markup).not.toMatch(/(?:Mentioned|Cited):\s*\d+%/)
  })

  it('uses report_only as the documented emergency presentation rollback', async () => {
    const previous = process.env.GEO_COVERAGE_GATE_MODE
    process.env.GEO_COVERAGE_GATE_MODE = 'report_only'
    try {
      const geo = rebuildReusedGeoNarrative(rozie().geo as GeoResult)
      const markup = await render({ ...rozie(), geo })
      expect(markup).toContain('AI Visibility / 100')
      expect(markup).toContain('Visibility by buyer intent')
      expect(markup).toContain('Who AI recommends instead')
      expect(markup).not.toContain('Coverage was insufficient to report an AI visibility index')
      expect(markup).not.toContain('Measurement coverage was insufficient')
    } finally {
      if (previous === undefined) delete process.env.GEO_COVERAGE_GATE_MODE
      else process.env.GEO_COVERAGE_GATE_MODE = previous
    }
  })

  it('still renders the index cards, formula and per-engine coverage when the gate passes', async () => {
    const report = rozie()
    const geo = rebuildReusedGeoNarrative(report.geo as GeoResult)
    const passedGeo: GeoResult = { ...geo, coverage_gate: { ...geo.coverage_gate!, passed: true, reasons: [] } }
    const markup = await render({ ...report, geo: passedGeo })

    expect(markup).toContain('AI Visibility / 100')
    expect(markup).toContain('Score = ')
    expect(markup).toContain('Measurement coverage by engine')
    expect(markup).toContain('OpenAI: ')
  })

  it('shows A1 evidence diagnostics on web and keeps the PDF on excerpts only', async () => {
    const report = rozie()
    const geo = rebuildReusedGeoNarrative(report.geo as GeoResult)
    geo.evidence = geo.evidence.map((evidence, index) => index === 0
      ? { ...evidence, status: 'ok_no_citations', excerpt_offset: 12, answer_text: `${'Full stored answer text. '.repeat(40)}` }
      : evidence)

    const web = await render({ ...report, geo })
    expect(web).toContain('Answered without citations (the engine did not ground this answer in web sources).')
    expect(web).toContain('Opening narration was omitted from this excerpt; the full raw answer is stored unchanged.')
    expect(web).toContain('Show the full stored answer')

    const pdf = await render({ ...report, geo }, { pdf: 'true' })
    expect(pdf).not.toContain('Show the full stored answer')
  })
})
