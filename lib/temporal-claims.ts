import { splitSentences } from './trust/sentences'

export type CalendarDate = {
  year: number
  month: number
  day: number
  source: string
}

export type TemporalClaimContext = {
  referenceIso: string
  timeZone: string
  hasSupportedFutureDateClaim: boolean
}

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
}

const MONTH_PATTERN = Object.keys(MONTHS).join('|')

export const FUTURE_DATE_CLAIM_PATTERN =
  /\b(?:future[- ]dated|future dates?|dates?\s+(?:appearing|shown|rendered)\s+(?:as\s+)?future|dates?\s+(?:appearing|shown|rendered)\s+in\s+the\s+future|timestamps?\s+render(?:ed)?\s+as\s+future|date\s+in\s+the\s+future)\b/i

function validDate(year: number, month: number, day: number, source: string): CalendarDate | null {
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const candidate = new Date(Date.UTC(year, month - 1, day))
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() + 1 !== month ||
    candidate.getUTCDate() !== day
  ) {
    return null
  }
  return { year, month, day, source }
}

export function parseCalendarDates(text: string): CalendarDate[] {
  const found: CalendarDate[] = []
  const seen = new Set<string>()
  const add = (date: CalendarDate | null) => {
    if (!date) return
    const key = `${date.year}-${date.month}-${date.day}-${date.source}`
    if (seen.has(key)) return
    seen.add(key)
    found.push(date)
  }

  for (const match of text.matchAll(/\b(19\d{2}|20\d{2}|21\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) {
    add(validDate(Number(match[1]), Number(match[2]), Number(match[3]), match[0]))
  }

  for (const match of text.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](19\d{2}|20\d{2}|21\d{2})\b/g)) {
    add(validDate(Number(match[3]), Number(match[2]), Number(match[1]), match[0]))
  }

  const dayFirst = new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_PATTERN})\\s+(19\\d{2}|20\\d{2}|21\\d{2})\\b`, 'gi')
  for (const match of text.matchAll(dayFirst)) {
    add(validDate(Number(match[3]), MONTHS[match[2].toLowerCase()], Number(match[1]), match[0]))
  }

  const monthFirst = new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?[,]?\\s+(19\\d{2}|20\\d{2}|21\\d{2})\\b`, 'gi')
  for (const match of text.matchAll(monthFirst)) {
    add(validDate(Number(match[3]), MONTHS[match[1].toLowerCase()], Number(match[2]), match[0]))
  }

  return found
}

function zonedReferenceDate(referenceIso: string, timeZone: string): CalendarDate | null {
  const reference = new Date(referenceIso)
  if (Number.isNaN(reference.getTime())) return null
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(reference)
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value)
    return validDate(value('year'), value('month'), value('day'), referenceIso)
  } catch {
    return validDate(
      reference.getUTCFullYear(),
      reference.getUTCMonth() + 1,
      reference.getUTCDate(),
      referenceIso
    )
  }
}

function dateKey(date: CalendarDate): number {
  return date.year * 10_000 + date.month * 100 + date.day
}

export function isFutureCalendarDate(
  date: CalendarDate,
  referenceIso: string,
  timeZone = 'UTC'
): boolean {
  const reference = zonedReferenceDate(referenceIso, timeZone)
  return reference ? dateKey(date) > dateKey(reference) : false
}

function collectStrings(value: unknown, output: string[]): void {
  if (typeof value === 'string') {
    output.push(value)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, output))
    return
  }
  if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((item) => collectStrings(item, output))
  }
}

export function temporalClaimContext(
  report: unknown,
  referenceIso: string,
  timeZone = 'UTC'
): TemporalClaimContext {
  const strings: string[] = []
  collectStrings(report, strings)
  const claimDates = strings.flatMap((text) =>
    splitSentences(text)
      .filter((sentence) => FUTURE_DATE_CLAIM_PATTERN.test(sentence))
      .flatMap(parseCalendarDates)
  )
  return {
    referenceIso,
    timeZone,
    hasSupportedFutureDateClaim: claimDates.some((date) =>
      isFutureCalendarDate(date, referenceIso, timeZone)
    ),
  }
}

export function removeUnsupportedFutureDateClaims(
  text: string,
  context: TemporalClaimContext
): string {
  if (!text || context.hasSupportedFutureDateClaim || !FUTURE_DATE_CLAIM_PATTERN.test(text)) {
    return text
  }
  return splitSentences(text)
    .filter((sentence) => !FUTURE_DATE_CLAIM_PATTERN.test(sentence))
    .join('')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function temporalPrompt(referenceIso: string, timeZone = 'UTC'): string {
  const reference = zonedReferenceDate(referenceIso, timeZone)
  const date = reference
    ? `${reference.year}-${String(reference.month).padStart(2, '0')}-${String(reference.day).padStart(2, '0')}`
    : referenceIso
  return `AUDIT REFERENCE DATE: ${date} (${timeZone}). Never call a date future-dated unless it is strictly later than this calendar date. Dates on the reference date or earlier are not future dates.`
}
