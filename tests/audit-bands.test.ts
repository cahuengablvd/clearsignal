import { describe, expect, it } from 'vitest'
import { BAND_LABEL, STATUS_PRIORITY, bandFor, statusPriority } from '../lib/audit-bands'

/**
 * The admin screen prints a band header whenever the band changes between two
 * adjacent rows, so bands MUST be contiguous under the sort. The first version
 * of this file asserted that an unrecognized status "needs attention" - which
 * sounds right and was exactly the bug: such a status sorts last (99) but banded
 * as `attention`, printing a second "Needs attention" header below the finished
 * work. Contiguity is the property that matters; test that, not plausibility.
 */
describe('admin queue bands', () => {
  it('never repeats a band once the list is sorted', () => {
    const bands = [...Object.keys(STATUS_PRIORITY), 'some_status_we_never_shipped']
      .sort((a, b) => statusPriority(a) - statusPriority(b))
      .map(bandFor)

    const opened = new Set<string>()
    let previous: string | null = null
    for (const band of bands) {
      if (band === previous) continue
      expect(opened.has(band)).toBe(false)
      opened.add(band)
      previous = band
    }
  })

  it('puts finished work below anything needing a human', () => {
    const attention = ['processing', 'queued', 'failed-validation', 'failed', 'delivery_failed', 'awaiting_review']
    for (const status of attention) {
      expect(bandFor(status)).toBe('attention')
      expect(statusPriority(status)).toBeLessThan(statusPriority('done'))
    }
    expect(bandFor('done')).toBe('finished')
    expect(bandFor('delivered')).toBe('finished')
  })

  it('keeps an abandoned checkout below finished work', () => {
    // /api/stripe/checkout persists intake BEFORE Stripe, so an unpaid order
    // leaves a row behind. There is nothing an operator can act on there.
    expect(statusPriority('awaiting_payment')).toBeGreaterThan(statusPriority('delivered'))
    expect(bandFor('awaiting_payment')).toBe('inactive')
  })

  it('ranks a report ready to send above stale failures and in-flight work', () => {
    // The complaint that produced this test: a freshly generated audit sat at
    // the BOTTOM of the queue, under old failed test rows, because
    // awaiting_review used to be the last status in the band.
    for (const below of ['failed', 'failed-validation', 'processing', 'queued']) {
      expect(statusPriority('awaiting_review')).toBeLessThan(statusPriority(below))
    }
    // Except a paid customer whose delivery broke - that outranks everything.
    expect(statusPriority('delivery_failed')).toBeLessThan(statusPriority('awaiting_review'))
  })

  it('maps every audit_status the pipeline writes', () => {
    const written = [
      'awaiting_payment',
      'awaiting_review',
      'delivered',
      'delivery_failed',
      'failed',
      'failed-validation',
      'processing',
      'queued',
    ]
    for (const status of written) {
      expect(STATUS_PRIORITY[status]).toBeTypeOf('number')
    }
  })

  it('labels every band', () => {
    expect(BAND_LABEL.attention).toBe('Needs attention')
    expect(BAND_LABEL.finished).toBe('Finished')
    expect(BAND_LABEL.inactive).toBe('Unpaid or unknown')
  })
})
