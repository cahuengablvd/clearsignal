import { stripe } from './stripe'

export async function isPaidCheckoutSession(sessionId: string | undefined): Promise<boolean> {
  if (!sessionId) return false

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    return session.payment_status === 'paid'
  } catch {
    return false
  }
}
