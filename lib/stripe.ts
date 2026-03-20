import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-02-25.clover',
    })
  }
  return _stripe
}

// Convenience export for backwards compat
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const instance = getStripe()
    const value = (instance as unknown as Record<string, unknown>)[prop as string]
    if (typeof value === 'function') {
      return value.bind(instance)
    }
    return value
  },
})
