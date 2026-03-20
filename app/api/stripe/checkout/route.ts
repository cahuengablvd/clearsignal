import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { stripe } from '@/lib/stripe'

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

const requestSchema = z.object({
  email: z.string().email(),
  url: z.string().url(),
  competitor_1: z.string().optional().default(''),
  competitor_2: z.string().optional().default(''),
  competitor_3: z.string().optional().default(''),
  icp_description: z.string().optional().default(''),
  score_id: z.string().optional().default(''),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const input = requestSchema.parse(body)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: input.email,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID_399!,
          quantity: 1,
        },
      ],
      metadata: {
        email: input.email,
        url: input.url,
        competitor_1: input.competitor_1,
        competitor_2: input.competitor_2,
        competitor_3: input.competitor_3,
        icp_description: input.icp_description,
        score_id: input.score_id,
        tier: 'automated',
      },
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    console.error('Stripe checkout error:', err)
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
