import { describe, expect, it } from 'vitest'
import { auditPriceConfigurationError } from '../lib/audit-price'

describe('paid audit Stripe price guard', () => {
  it('accepts an active one-time EUR 149 price', () => {
    expect(
      auditPriceConfigurationError({
        active: true,
        currency: 'eur',
        unit_amount: 14900,
        type: 'one_time',
      })
    ).toBeNull()
  })

  it.each([
    [{ active: true, currency: 'eur', unit_amount: 39900, type: 'one_time' }, 'EUR 149.00'],
    [{ active: true, currency: 'usd', unit_amount: 14900, type: 'one_time' }, 'EUR'],
    [{ active: false, currency: 'eur', unit_amount: 14900, type: 'one_time' }, 'inactive'],
    [{ active: true, currency: 'eur', unit_amount: 14900, type: 'recurring' }, 'one-time'],
  ])('rejects a misconfigured price: %j', (price, message) => {
    expect(auditPriceConfigurationError(price)).toContain(message)
  })
})
