/**
 * One source of truth for how the admin queue is ordered and grouped.
 *
 * The list is deliberately NOT sorted by recency: it is sorted by what needs a
 * human. A delivered audit sinks below `done` on purpose, because nothing is
 * left to do with it. Without a visible label that reads as a sorting fault, so
 * the admin screen renders these bands as headers.
 */
export const STATUS_PRIORITY: Record<string, number> = {
  processing: 0,
  queued: 1,
  'failed-validation': 2,
  failed: 3,
  delivery_failed: 4,
  awaiting_review: 5,
  done: 6,
  delivered: 7,
  // An abandoned checkout: the row exists because /api/stripe/checkout persists
  // intake before Stripe, but nobody paid. Nothing an operator can act on, so it
  // sits below finished work rather than at the top.
  awaiting_payment: 8,
}

/** Unrecognized statuses sort last and land in the trailing band. */
const UNKNOWN_PRIORITY = 99

export function statusPriority(status: string): number {
  return STATUS_PRIORITY[status] ?? UNKNOWN_PRIORITY
}

export type AuditBand = 'attention' | 'finished' | 'inactive'

export const BAND_LABEL: Record<AuditBand, string> = {
  attention: 'Needs attention',
  finished: 'Finished',
  inactive: 'Unpaid or inactive',
}

/**
 * Bands are contiguous ranges of the sort key, so a band header can never
 * appear twice in one list. That invariant is what broke when `awaiting_payment`
 * was missing from the table: it sorted last but banded as `attention`, printing
 * a second "Needs attention" header below the finished work.
 */
export function bandFor(status: string): AuditBand {
  const priority = statusPriority(status)
  if (priority <= STATUS_PRIORITY.awaiting_review) return 'attention'
  if (priority <= STATUS_PRIORITY.delivered) return 'finished'
  return 'inactive'
}
