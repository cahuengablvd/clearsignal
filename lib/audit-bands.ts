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
}

export function statusPriority(status: string): number {
  return STATUS_PRIORITY[status] ?? 99
}

export type AuditBand = 'attention' | 'finished'

export const BAND_LABEL: Record<AuditBand, string> = {
  attention: 'Needs attention',
  finished: 'Finished',
}

/**
 * `done` and `delivered` are finished work. Everything else - including an
 * unrecognized status - belongs in the band a person is expected to look at.
 */
export function bandFor(status: string): AuditBand {
  const priority = statusPriority(status)
  return priority === STATUS_PRIORITY.done || priority === STATUS_PRIORITY.delivered
    ? 'finished'
    : 'attention'
}
