import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'
import { enforceRateLimits, clientIp, emailDomain } from '@/lib/rate-limit'
import { verifyToken } from '@/lib/tokens'
import { BusinessContextSchema, CheckoutIntakeSchema } from '@/lib/schemas'
import { auditPriceConfigurationError } from '@/lib/audit-price'

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

export async function POST(req: NextRequest) {
  try {
    const priceId = process.env.STRIPE_PRICE_ID_AUDIT

    if (!priceId) {
      console.error('[checkout] STRIPE_PRICE_ID_AUDIT is not set')
      return NextResponse.json({ error: 'Stripe price not configured' }, { status: 500 })
    }
    if (!priceId.startsWith('price_')) {
      console.error('[checkout] STRIPE_PRICE_ID_AUDIT does not start with price_ - got:', priceId.slice(0, 8))
      return NextResponse.json(
        { error: `Invalid Stripe price ID format. Expected price_... but got ${priceId.slice(0, 8)}...` },
        { status: 500 }
      )
    }

    const configuredPrice = await stripe.prices.retrieve(priceId)
    const priceError = auditPriceConfigurationError(configuredPrice)
    if (priceError) {
      console.error('[checkout] Invalid audit price configuration:', priceError)
      return NextResponse.json(
        { error: 'Audit checkout is temporarily unavailable' },
        { status: 503 }
      )
    }

    const body = await req.json()
    const input = CheckoutIntakeSchema.parse(body)

    if (input.score_id && !verifyToken('score', input.score_id, input.score_token)) {
      return NextResponse.json({ error: 'Invalid score access token' }, { status: 403 })
    }

    let icpDescription = input.icp_description.trim()
    if (!icpDescription && input.score_id) {
      const { data: score } = await supabaseAdmin
        .from('scores')
        .select('status, scores')
        .eq('id', input.score_id)
        .single()
      const persistedScores = score?.scores && typeof score.scores === 'object' && !Array.isArray(score.scores)
        ? score.scores as Record<string, unknown>
        : null
      const scoreDraft = persistedScores?.business_description_draft
      if (score?.status !== 'done' || typeof scoreDraft !== 'string' || !scoreDraft.trim()) {
        return NextResponse.json(
          { error: 'Describe the business before starting the audit' },
          { status: 400 }
        )
      }
      icpDescription = scoreDraft.trim()
    }

    // Rate limit checkout-session creation by email + IP to deter abuse/spam.
    const hour = 60 * 60 * 1000
    const rl = await enforceRateLimits([
      { key: `checkout:email:${input.email.toLowerCase()}`, limit: 5, windowMs: hour },
      { key: `checkout:domain:${emailDomain(input.email)}`, limit: 15, windowMs: hour },
      { key: `checkout:ip:${clientIp(req)}`, limit: 15, windowMs: hour },
    ])
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many checkout attempts. Please try again later.' },
        { status: 429 }
      )
    }

    const businessContext = BusinessContextSchema.parse(input.business_context)
    const { data: audit, error: insertError } = await supabaseAdmin
      .from('audits')
      .insert({
        email: input.email,
        url: input.url,
        competitor_1: input.competitor_1 || null,
        competitor_2: input.competitor_2 || null,
        competitor_3: input.competitor_3 || null,
        icp_description: icpDescription,
        score_id: input.score_id || null,
        stripe_session: null,
        payment_status: 'pending',
        audit_status: 'awaiting_payment',
        tier: 'automated',
        business_context: businessContext,
      })
      .select('id')
      .single()

    if (insertError || !audit) {
      console.error('[checkout] Failed to persist pending order:', insertError)
      return NextResponse.json({ error: 'Could not save your order. Please try again.' }, { status: 500 })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: input.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        audit_id: audit.id,
        tier: 'automated',
      },
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout`,
    })

    const { error: updateError } = await supabaseAdmin
      .from('audits')
      .update({ stripe_session: session.id })
      .eq('id', audit.id)

    if (updateError) {
      console.error('[checkout] Failed to attach Stripe session to pending order:', updateError)
      return NextResponse.json({ error: 'Could not prepare payment. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || 'Invalid input', details: err.errors },
        { status: 400 }
      )
    }
    console.error('Stripe checkout error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
