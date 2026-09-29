import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateReport } from '../lib/report-validator'
import type { ClearSignalReport } from '../lib/schemas'

const load = () => JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/golden-report-rozie.json'), 'utf8')) as ClearSignalReport

function entity(entityId: string, name: string, role: 'competitor' | 'channel_or_directory' | 'unknown', state: 'accepted' | 'channel' | 'unconfirmed', occurrences = 0) {
  return {
    entity_id: entityId, display_name: name, aliases: [name], role, role_source: 'dictionary' as const, state,
    occurrences, distinct_queries: occurrences, distinct_engines: occurrences, domain_corroborated: false,
    operator_provided: false,
  }
}

function listingReport(): ClearSignalReport {
  const report = load()
  report.geo!.entity_resolution = {
    version: 'v1',
    entities: [
      entity('entity-rival-dot', 'Rival.Co', 'competitor', 'unconfirmed'),
      entity('entity-rival-plus', 'Rival+Plus', 'competitor', 'unconfirmed'),
      entity('entity-rival-paren', 'Rival (North)', 'unknown', 'unconfirmed'),
      entity('entity-clutch', 'Clutch', 'channel_or_directory', 'channel'),
      entity('entity-g2', 'G2', 'channel_or_directory', 'channel'),
    ],
  }
  report.geo!.competitor_visibility = []
  report.geo!.evidence.forEach((item) => { item.competitors_mentioned = [] })
  report.geo!.recommendations = [
    'Get listed on Rival.Co.',
    'Get a profile on Rival+Plus and Clutch.',
    'Get listed on Clutch, Rival (North), and G2.',
    'Get listed on Clutch and Rival (North).',
    'Strengthen source detail.',
  ]

  const listingFix = { ...report.action!.top_fixes[0]!, title: 'Create a profile on Rival.Co', description: 'Get listed on Rival.Co.' }
  const mixedFix = { ...report.action!.top_fixes[1]!, title: 'Improve directory guidance', description: 'Get listed on Rival.Co and Clutch.' }
  report.action!.top_fixes = [listingFix, mixedFix]
  report.action!.ship_first = [listingFix.title, mixedFix.title]
  const brief = { ...report.implementation_briefs![0]!, fix_title: mixedFix.title, steps: ['Get listed on Clutch, Rival (North), and G2.'], acceptance_criteria: ['Get listed on Rival.Co.'] }
  report.implementation_briefs = [brief]
  return report
}

function summaryReport(otherOccurrences: number, withConfirmedCompetitor: boolean): ClearSignalReport {
  const report = load()
  const evidence = report.geo!.evidence[0]!
  const original = evidence.answer_text || evidence.answer_excerpt
  const added = ' Confirmed Rival and Other Named Business appeared in this answer.'
  evidence.answer_text = `${original}${added}`
  const confirmedStart = evidence.answer_text.indexOf('Confirmed Rival')
  const otherStart = evidence.answer_text.indexOf('Other Named Business')
  const confirmed = entity('entity-confirmed-rival', 'Confirmed Rival', 'competitor', 'accepted', 1)
  const other = entity('entity-other-business', 'Other Named Business', 'competitor', 'unconfirmed', otherOccurrences)
  const observation = (item: typeof confirmed, start: number) => ({
    entity_id: item.entity_id, name_as_written: item.display_name, role: 'competitor' as const,
    span_start: start, span_end: start + item.display_name.length, matched_alias: item.display_name, text_source: 'answer_text' as const,
  })
  evidence.entity_observations = [observation(confirmed, confirmedStart), ...(otherOccurrences ? [observation(other, otherStart)] : [])]
  report.geo!.evidence.forEach((item, index) => { item.competitors_mentioned = index === 0 ? ['Confirmed Rival'] : [] })
  report.geo!.competitor_visibility = withConfirmedCompetitor ? [{ name: 'Confirmed Rival', mention_rate: 10 }] : []
  report.geo!.entity_resolution = { version: 'v1', entities: [confirmed, other] }
  report.action!.executive_summary = 'No other competitors were detected.'
  return report
}

describe('entity taxonomy report validation', () => {
  it('removes non-directory listing advice, cleans mixed lists, and drops resulting blank entries', () => {
    const result = validateReport(listingReport())
    const recommendations = result.report.geo!.recommendations
    expect(recommendations).toEqual([
      'Get a profile on Clutch.',
      'Get listed on Clutch and G2.',
      'Get listed on Clutch.',
      'Strengthen source detail.',
    ])
    expect(result.report.action!.top_fixes.map((fix) => fix.title)).toEqual(['Improve directory guidance'])
    expect(result.report.action!.ship_first).toEqual(['Improve directory guidance'])
    expect(result.report.implementation_briefs).toHaveLength(1)
    expect(result.report.implementation_briefs![0]!.acceptance_criteria).toEqual([])
    const targeted = JSON.stringify({ action: result.report.action, briefs: result.report.implementation_briefs, recommendations })
    expect(targeted).not.toContain('""')
    expect(result.warnings).toContain('entity_taxonomy: withheld listing recommendations for non-directory or unresolved named entities')
    expect(result.warnings).toContain('implementation_briefs.0.acceptance_criteria: missing; rendered without acceptance criteria')
  })

  it('repairs only when an unconfirmed named competitor and a confirmed competitor both have evidence', () => {
    const triggered = validateReport(summaryReport(1, true))
    expect(triggered.report.action!.executive_summary).toContain('Only Confirmed Rival met the audit\'s confirmed-competitor inclusion criteria.')
    expect(triggered.report.action!.executive_summary).toContain('Other named businesses appeared in tested answers')
    expect(triggered.report.action!.executive_summary).not.toMatch(/\b\d+%|\$\s?\d|\b\d+ of \d+\b/)
    expect(triggered.warnings).toContain('entity_taxonomy: clarified summary distinction between named businesses and confirmed competitors')

    const noOccurrences = validateReport(summaryReport(0, true))
    expect(noOccurrences.report.action!.executive_summary).toMatch(/^No other competitors were detected\./)
    expect(noOccurrences.warnings).not.toContain('entity_taxonomy: clarified summary distinction between named businesses and confirmed competitors')

    const noConfirmedCompetitor = validateReport(summaryReport(1, false))
    expect(noConfirmedCompetitor.report.action!.executive_summary).toMatch(/^No other competitors were detected\./)
    expect(noConfirmedCompetitor.warnings).not.toContain('entity_taxonomy: clarified summary distinction between named businesses and confirmed competitors')
  })
})
