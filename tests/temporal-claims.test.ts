import { describe, expect, it } from 'vitest'
import {
  isFutureCalendarDate,
  parseCalendarDates,
  removeUnsupportedFutureDateClaims,
  temporalClaimContext,
  temporalPrompt,
} from '../lib/temporal-claims'

describe('temporal claim validation', () => {
  const reference = '2026-07-22T12:00:00.000Z'

  it('classifies yesterday, today, and tomorrow by calendar day', () => {
    const dates = parseCalendarDates('21 July 2026; 22 July 2026; 23 July 2026')

    expect(isFutureCalendarDate(dates[0], reference)).toBe(false)
    expect(isFutureCalendarDate(dates[1], reference)).toBe(false)
    expect(isFutureCalendarDate(dates[2], reference)).toBe(true)
  })

  it('does not classify 14 July as future for a 22 July report', () => {
    const [date] = parseCalendarDates('14 July 2026')
    expect(isFutureCalendarDate(date, reference)).toBe(false)
  })

  it.each([
    '14 July 2026',
    'July 14, 2026',
    '2026-07-14',
    '14.07.2026',
    '14/07/2026',
  ])('parses supported date format: %s', (value) => {
    expect(parseCalendarDates(value)).toEqual([
      expect.objectContaining({ year: 2026, month: 7, day: 14 }),
    ])
  })

  it('uses the report timezone at a UTC day boundary', () => {
    const [date] = parseCalendarDates('22 July 2026')
    const nearMidnightUtc = '2026-07-22T00:30:00.000Z'

    expect(isFutureCalendarDate(date, nearMidnightUtc, 'Europe/Riga')).toBe(false)
    expect(isFutureCalendarDate(date, nearMidnightUtc, 'America/Los_Angeles')).toBe(true)
  })

  it('drops propagated future-date wording when the cited date is not future', () => {
    const report = {
      direct: "Reviews dated '14 July 2026' are a future date relative to the time of analysis.",
      propagated: 'Fix or explain the future-dated review timestamps.',
    }
    const context = temporalClaimContext(report, reference)

    expect(context.hasSupportedFutureDateClaim).toBe(false)
    expect(removeUnsupportedFutureDateClaims(report.direct, context)).toBe('')
    expect(removeUnsupportedFutureDateClaims(report.propagated, context)).toBe('')
  })

  it('preserves a supported future-date claim', () => {
    const report = {
      direct: "A review dated '23 July 2026' is future-dated for this audit.",
    }
    const context = temporalClaimContext(report, reference)

    expect(context.hasSupportedFutureDateClaim).toBe(true)
    expect(removeUnsupportedFutureDateClaims(report.direct, context)).toBe(report.direct)
  })

  it('gives the model an explicit audit reference date', () => {
    expect(temporalPrompt(reference)).toContain('2026-07-22 (UTC)')
  })
})
