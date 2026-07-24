import { describe, expect, it } from 'vitest'
import { BAND_LABEL, bandFor, statusPriority } from '../lib/audit-bands'

describe('admin queue bands', () => {
  it('puts finished work below anything needing a human', () => {
    const attention = ['processing', 'queued', 'failed-validation', 'failed', 'delivery_failed', 'awaiting_review']
    for (const status of attention) {
      expect(bandFor(status)).toBe('attention')
      expect(statusPriority(status)).toBeLessThan(statusPriority('done'))
    }
    expect(bandFor('done')).toBe('finished')
    expect(bandFor('delivered')).toBe('finished')
  })

  it('treats an unrecognized status as needing attention', () => {
    // A status nobody mapped is exactly the kind of row an operator should see.
    expect(bandFor('some_new_status')).toBe('attention')
  })

  it('labels both bands', () => {
    expect(BAND_LABEL.attention).toBe('Needs attention')
    expect(BAND_LABEL.finished).toBe('Finished')
  })
})
