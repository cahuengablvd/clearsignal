import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { callClaudeJSON, queryEngine } = vi.hoisted(() => ({ callClaudeJSON: vi.fn(), queryEngine: vi.fn() }))
vi.mock('../lib/anthropic', () => ({ callClaudeJSON }))
vi.mock('../lib/geo/engines', () => ({ availableEngines: () => ['openai'], queryEngine }))

import { recomputeReusedGeoEvidence } from '../lib/audit-runner'
import { buildAdminEntityDiagnostics, buildClientEntityPresentation, ENTITY_DISCLOSURE } from '../lib/entity-presentation'
import { runGeoScan, type QueryPlan } from '../lib/geo'
import { buildGeoActionEvidenceCatalog } from '../lib/geo/action-evidence'
import { intentForSlot, QUERY_SLOTS } from '../lib/geo/query-taxonomy'
import { validateReport } from '../lib/report-validator'
import type { ClearSignalReport, GeoResult } from '../lib/schemas'

const load = () => JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/golden-report-rozie.json'), 'utf8')) as ClearSignalReport
const a3Errors = (report: ClearSignalReport) => validateReport(report).errors.filter((error) => error.startsWith('a3:'))

function freshReport(): ClearSignalReport {
  const report = load()
  const geo = recomputeReusedGeoEvidence(report.geo as GeoResult)
  const firstByQuery = [...new Map(geo.evidence.map((item) => [item.query, item])).values()]
  const provenance = QUERY_SLOTS.map((slot, index) => ({
    query_id: `Q${index + 1}`, query: firstByQuery[index]?.query || `buyer query ${index + 1}`, slot,
    intent: firstByQuery[index]?.query_intent || intentForSlot(slot), language: 'en', language_source: 'intake' as const,
    geo_scope: 'explicit' as const, scope: 'core' as const, source: 'generator' as const, rationale: 'Tests a buyer situation.',
    validation: { passed: true, errors: [], warnings: [], regenerated: false }, state: 'valid' as const,
  }))
  const rebuilt = {
    ...geo,
    evidence: geo.evidence.map((item) => {
      const p = provenance.find((candidate) => candidate.query === item.query) || provenance[0]
      return { ...item, query_id: p.query_id, query_intent: p.intent, scope: 'core' as const }
    }),
    query_provenance: provenance,
    query_plan: { valid_core_slots: 6, review_required: false, primary_language: 'en', markets: ['Malta'] },
  }
  return { ...report, geo: rebuilt }
}

function plan(core: string[], supplemental: string[] = []): QueryPlan {
  const generated = (query: string, index: number, scope: 'core' | 'supplemental') => ({
    query, slot: QUERY_SLOTS[Math.min(index, 5)], language: 'en', geo_scope: 'none' as const, rationale: 'Test query.',
    ...(index === 2 ? { intent_choice: 'comparison' as const } : {}),
  })
  const provenance = [...core.map((query, index) => ({ query_id: `Q${index + 1}`, ...generated(query, index, 'core'), intent: intentForSlot(QUERY_SLOTS[Math.min(index, 5)]), language_source: 'intake' as const, scope: 'core' as const, source: 'generator' as const, validation: { passed: true, errors: [], warnings: [], regenerated: false }, state: 'valid' as const })), ...supplemental.map((query, index) => ({ query_id: `S${index + 1}`, ...generated(query, index, 'supplemental'), intent: 'other' as const, language_source: 'intake' as const, scope: 'supplemental' as const, source: 'generator' as const, validation: { passed: true, errors: [], warnings: [], regenerated: false }, state: 'valid' as const }))]
  return { core: core.map((query, index) => generated(query, index, 'core')), supplemental: supplemental.map((query, index) => generated(query, index, 'supplemental')), provenance, valid_core_slots: core.length, review_required: false, primary_language: 'en', markets: [] }
}

beforeEach(() => {
  callClaudeJSON.mockReset()
  queryEngine.mockReset()
  queryEngine.mockResolvedValue({ ok: true, answer: 'Target and Real Rival are listed. '.repeat(8), citations: [], attempts: 1 })
})
afterEach(() => { delete process.env.GEO_ENTITY_PIPELINE })

describe('A3 completion verification', () => {
  it('keeps multi-paragraph acquired answers byte-identical through validation and preserves their spans', async () => {
    const answer = `${'Opening paragraph about the buyer situation. '.repeat(6)}\n\nParagraph Rival is a competitor named after this paragraph boundary.\n\n${'Closing paragraph with useful buyer context. '.repeat(6)}`
    const testPlan = plan(['buyer one', 'buyer two', 'buyer three', 'buyer four', 'buyer five', 'buyer six'])
    queryEngine.mockResolvedValue({ ok: true, answer, citations: [], attempts: 1 })
    callClaudeJSON.mockResolvedValue({ candidates: [{ name: 'Paragraph Rival', role_guess: 'competitor', quote: 'Paragraph Rival', answer_index: 0 }] })

    const geo = await runGeoScan({ brand: 'Target', url: 'https://target.example', engines: ['openai'], queryPlan: testPlan, analyzeSources: false, narrative: false })
    const before = geo.evidence[0].answer_text
    const entity = geo.entity_resolution!.entities.find((item) => item.display_name === 'Paragraph Rival')!
    const observation = geo.evidence[0].entity_observations!.find((item) => item.entity_id === entity.entity_id)!
    const validated = validateReport({ ...freshReport(), geo } as ClearSignalReport)

    expect(validated.errors.filter((error) => error.startsWith('a3: invalid entity span'))).toEqual([])
    expect(validated.report.geo!.evidence[0].answer_text).toBe(before)
    expect(before).toBe(answer)
    expect(before!.slice(observation.span_start, observation.span_end)).toBe('Paragraph Rival')
  })

  it('keeps duplicate A4 query identities and supplemental entities outside core A3 metrics', async () => {
    queryEngine.mockImplementation(async (_engine: string, query: string) => ({ ok: true, answer: (query.startsWith('supplemental') ? 'Target and Supplemental Only are listed. ' : 'Target and Real Rival are listed. ').repeat(8), citations: [], attempts: 1 }))
    callClaudeJSON.mockResolvedValue({ candidates: [{ name: 'Real Rival', role_guess: 'competitor', quote: 'Real Rival', answer_index: 0 }, { name: 'Supplemental Only', role_guess: 'competitor', quote: 'Supplemental Only', answer_index: 2 }] })
    const result = await runGeoScan({ brand: 'Target', url: 'https://target.example', engines: ['openai'], queryPlan: plan(['same buyer question', 'same buyer question'], ['supplemental one', 'supplemental two']), analyzeSources: false, narrative: false })
    const real = result.entity_resolution!.entities.find((entity) => entity.display_name === 'Real Rival')!
    expect(real.distinct_queries).toBe(2)
    expect(result.evidence.filter((item) => item.query_id === 'Q1' || item.query_id === 'Q2')).toHaveLength(2)
    expect(result.evidence.filter((item) => item.scope === 'supplemental')).toHaveLength(2)
    expect(result.evidence.filter((item) => item.scope === 'supplemental').every((item) => item.query_id?.startsWith('S'))).toBe(true)
    expect(result.competitor_visibility).toEqual([{ name: 'Real Rival', mention_rate: 100 }])
    expect(result.share_of_voice).toBe(50)
    expect(buildGeoActionEvidenceCatalog(result).top_competitors.map((item) => item.name)).toEqual(['Real Rival'])
  })

  it('rejects every malformed fresh A3 entity relationship without falling back to legacy', () => {
    const base = freshReport(); const geo = base.geo!; const entity = geo.entity_resolution!.entities.find((item) => item.role === 'competitor' && item.state === 'accepted')!; const evidence = geo.evidence.find((item) => (item.entity_observations || []).some((o) => o.entity_id === entity.entity_id))!; const observation = evidence.entity_observations!.find((item) => item.entity_id === entity.entity_id)!; const source = observation.text_source === 'answer_text' ? evidence.answer_text! : evidence.answer_excerpt
    const replaceObservation = (change: Record<string, unknown>, evidenceChange: Record<string, unknown> = {}) => ({ ...base, geo: { ...geo, evidence: geo.evidence.map((item) => item === evidence ? { ...item, ...evidenceChange, entity_observations: item.entity_observations!.map((o) => o === observation ? { ...o, ...change } : o) } : item) } }) as ClearSignalReport
    const cases: Array<[string, ClearSignalReport, RegExp]> = [
      ['missing visibility entity', { ...base, geo: { ...geo, competitor_visibility: [...geo.competitor_visibility, { name: 'Missing', mention_rate: 1 }] } }, /non-accepted entity Missing/],
      ['unaccepted visibility entity', { ...base, geo: { ...geo, entity_resolution: { ...geo.entity_resolution!, entities: geo.entity_resolution!.entities.map((item) => item.entity_id === entity.entity_id ? { ...item, state: 'unconfirmed' as const } : item) } } }, /non-accepted entity/],
      ['channel visibility entity', { ...base, geo: { ...geo, entity_resolution: { ...geo.entity_resolution!, entities: geo.entity_resolution!.entities.map((item) => item.entity_id === entity.entity_id ? { ...item, role: 'channel_or_directory' as const, state: 'channel' as const } : item) } } }, /non-accepted entity/],
      ['rejected visibility entity', { ...base, geo: { ...geo, entity_resolution: { ...geo.entity_resolution!, entities: geo.entity_resolution!.entities.map((item) => item.entity_id === entity.entity_id ? { ...item, state: 'rejected' as const } : item) } } }, /non-accepted entity/],
      ['unknown observation entity', replaceObservation({ entity_id: 'missing-entity' }), /unknown entity/],
      ['negative span', replaceObservation({ span_start: -1 }), /invalid entity span/],
      ['span beyond text', replaceObservation({ span_end: source.length + 1 }), /invalid entity span/],
      ['empty span', replaceObservation({ span_end: observation.span_start }), /invalid entity span/],
      ['alias differs from literal', replaceObservation({ matched_alias: 'not the literal' }), /invalid entity span/],
      ['name differs from literal', replaceObservation({ name_as_written: 'not the literal' }), /invalid entity span/],
      ['answer text absent', replaceObservation({ text_source: 'answer_text' }, { answer_text: undefined }), /answer_text observation without answer_text/],
      ['answer excerpt absent', replaceObservation({ text_source: 'answer_excerpt' }, { answer_excerpt: '' }), /answer_excerpt observation without answer_excerpt/],
      ['answer text claims excerpt-only match', replaceObservation({ text_source: 'answer_text' }, { answer_text: 'different stored answer'.repeat(20) }), /invalid entity span/],
      ['accepted competitor has no observation', { ...base, geo: { ...geo, evidence: geo.evidence.map((item) => ({ ...item, entity_observations: (item.entity_observations || []).filter((o) => o.entity_id !== entity.entity_id) })) } }, /accepted competitor has no valid observation/],
    ]
    for (const [name, report, expected] of cases) expect(a3Errors(report).join('\n'), name).toMatch(expected)
    const legacy = load(); expect(a3Errors(legacy)).toEqual([])
    const malformed = cases[0][1]; expect(malformed.geo!.entity_resolution!.version).toBe('v1'); expect(a3Errors(malformed).length).toBeGreaterThan(0)
  })

  it('excludes channels, generic labels, and unconfirmed candidates from action evidence', async () => {
    queryEngine.mockImplementation(async (_engine: string, query: string) => ({ ok: true, answer: (query.startsWith('first') ? 'Real Rival, Facebook, Crunchbase, Moving Co., and Lone Candidate are listed. ' : 'Real Rival, Facebook, Crunchbase, and Moving Co. are listed. ').repeat(8), citations: [], attempts: 1 }))
    callClaudeJSON.mockResolvedValue({ candidates: ['Real Rival', 'Facebook', 'Crunchbase', 'Moving Co.', 'Lone Candidate'].map((name) => ({ name, role_guess: 'competitor', quote: name, answer_index: 0 })) })
    const result = await runGeoScan({ brand: 'Target', url: 'https://target.example', engines: ['openai'], providedQueries: ['first buyer situation', 'second buyer situation'], analyzeSources: false, narrative: false })
    expect(buildGeoActionEvidenceCatalog(result).top_competitors.map((item) => item.name)).toEqual(['Real Rival'])
    expect(result.entity_resolution!.entities.find((item) => item.display_name === 'Facebook')).toMatchObject({ role: 'channel_or_directory', state: 'channel' })
    expect(result.entity_resolution!.entities.find((item) => item.display_name === 'Crunchbase')).toMatchObject({ role: 'channel_or_directory', state: 'channel' })
    expect(result.entity_resolution!.entities.find((item) => item.display_name === 'Moving Co.')).toMatchObject({ role: 'generic', state: 'rejected' })
    expect(result.entity_resolution!.entities.find((item) => item.display_name === 'Lone Candidate')).toMatchObject({ state: 'unconfirmed' })
    expect(result.channels_observed!.map((item) => item.name)).toEqual(expect.arrayContaining(['Facebook', 'Crunchbase']))
  })

  it('projects client-safe entity evidence and complete admin diagnostics from production helpers', async () => {
    callClaudeJSON.mockResolvedValue({ candidates: [{ name: 'Real Rival', role_guess: 'competitor', quote: 'Real Rival', answer_index: 0 }, { name: 'Facebook', role_guess: 'competitor', quote: 'Facebook', answer_index: 0 }] })
    queryEngine.mockResolvedValue({ ok: true, answer: 'Target and Real Rival appear on Facebook. '.repeat(8), citations: [], attempts: 1 })
    const result = await runGeoScan({ brand: 'Target', url: 'https://target.example', engines: ['openai'], providedQueries: ['first buyer situation', 'second buyer situation'], analyzeSources: false, narrative: false })
    const client = buildClientEntityPresentation(result)
    expect(ENTITY_DISCLOSURE).toBe('Named in the tested answers; being named is not a recommendation.')
    expect(client.competitors).toHaveLength(1); expect(client.competitors[0]).toMatchObject({ name: 'Real Rival' }); expect(client.competitors[0].quote).toContain('Real Rival')
    expect(client.channels.map((item) => item.name)).toContain('Facebook')
    expect(JSON.stringify(client)).not.toMatch(/span_start|span_end|entity_id|state_reason/)
    const renderer = readFileSync(join(process.cwd(), 'app/audit/[id]/page.tsx'), 'utf8')
    const entitySection = renderer.slice(renderer.indexOf('Competitors AI mentioned'), renderer.indexOf('Sources AI cites most'))
    expect(entitySection).toContain('Competitors AI mentioned')
    expect(entitySection).toContain('Channels and directories AI mentioned')
    expect(entitySection).toContain('{ENTITY_DISCLOSURE}')
    expect(entitySection).not.toContain('Who AI recommends instead')
    expect(entitySection).not.toMatch(/recommend(?:s|ed|ation)/i)
    const admin = buildAdminEntityDiagnostics(result.entity_resolution!.entities)
    expect(admin.find((item) => item.display_name === 'Real Rival')).toMatchObject({ display_name: 'Real Rival', kind: 'competitor', role: 'competitor', state: 'accepted', role_source: 'extractor', occurrences: 2, distinct_queries: 2, distinct_engines: 1, domain_corroborated: false, operator_provided: false })
    expect(admin.find((item) => item.display_name === 'Facebook')).toMatchObject({ kind: 'channel_or_directory' })
  })

  it('executes the legacy runner path, preserves A1/A4 semantics, and returns to A3', async () => {
    const previous = process.env.GEO_ENTITY_PIPELINE
    const testPlan = plan(['buyer question one', 'buyer question two', 'buyer question three', 'buyer question four', 'buyer question five', 'buyer question six'], ['supplemental one', 'supplemental two'])
    queryEngine.mockResolvedValue({ ok: true, answer: 'Target and Real Rival are listed. '.repeat(8), citations: [], attempts: 1 })
    process.env.GEO_ENTITY_PIPELINE = 'legacy'
    const legacy = await runGeoScan({ brand: 'Target', url: 'https://target.example', competitors: ['Real Rival'], engines: ['openai'], queryPlan: testPlan, discoverCompetitors: false, analyzeSources: false, narrative: false })
    expect(legacy.entity_resolution!.version).toBe('legacy'); expect(legacy.ledger).toHaveLength(8); expect(legacy.query_provenance!.map((item) => item.query_id)).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'S1', 'S2'])
    expect(legacy.evidence.filter((item) => item.scope === 'supplemental')).toHaveLength(2); expect(legacy.test_counts!.successful_combinations).toBe(6); expect(callClaudeJSON).not.toHaveBeenCalled(); expect(queryEngine).toHaveBeenCalledTimes(8)
    expect(a3Errors({ ...freshReport(), geo: legacy } as ClearSignalReport)).toEqual([])
    if (previous === undefined) delete process.env.GEO_ENTITY_PIPELINE; else process.env.GEO_ENTITY_PIPELINE = previous
    const current = await runGeoScan({ brand: 'Target', url: 'https://target.example', competitors: ['Real Rival'], engines: ['openai'], queryPlan: testPlan, discoverCompetitors: false, analyzeSources: false, narrative: false })
    expect(current.entity_resolution!.version).toBe('v1')
  })
})
