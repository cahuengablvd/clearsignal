/**
 * One source of truth for how the admin queue is ordered and grouped.
 *
 * The list is sorted by what a human can act on RIGHT NOW, not by recency. The
 * bands below are declared in display order, and both the sort key and the band
 * headers derive from this one structure - so a band can never appear twice, and
 * a status can never sort into a band it isn't listed in.
 */
export type AuditBand = 'running' | 'attention' | 'finished' | 'inactive'

const BANDS: ReadonlyArray<{ band: AuditBand; label: string; statuses: readonly string[] }> = [
  {
    band: 'running',
    label: 'Running now',
    // Nothing to DO with these, but they are what the operator just started and
    // is waiting on, so they lead. They also clear themselves within minutes,
    // unlike the stuck states below, which can sit for weeks.
    statuses: ['processing', 'queued'],
  },
  {
    band: 'attention',
    label: 'Needs attention',
    statuses: [
      // A customer paid and delivery broke - nothing outranks that.
      'delivery_failed',
      // Reviewed-and-send is the step that completes a sale, so it sits above
      // failures: a stale failed test audit must never bury a report that is
      // ready to go out.
      'awaiting_review',
      'failed-validation',
      'failed',
    ],
  },
  { band: 'finished', label: 'Finished', statuses: ['done', 'delivered'] },
  {
    band: 'inactive',
    label: 'Unpaid or unknown',
    // /api/stripe/checkout persists intake BEFORE Stripe, so an order nobody
    // paid for leaves a row behind. Unrecognized statuses land here too.
    statuses: ['awaiting_payment'],
  },
]

export const STATUS_PRIORITY: Record<string, number> = Object.fromEntries(
  BANDS.flatMap((group) => group.statuses).map((status, index) => [status, index])
)

/** Unrecognized statuses sort last, into the trailing band. */
const UNKNOWN_PRIORITY = 99

export const BAND_LABEL = Object.fromEntries(
  BANDS.map((group) => [group.band, group.label])
) as Record<AuditBand, string>

export function statusPriority(status: string): number {
  return STATUS_PRIORITY[status] ?? UNKNOWN_PRIORITY
}

export function bandFor(status: string): AuditBand {
  const group = BANDS.find((candidate) => candidate.statuses.includes(status))
  return group ? group.band : BANDS[BANDS.length - 1].band
}
