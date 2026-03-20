import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'
import { runFullAudit } from '@/lib/audit-runner'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const meta = session.metadata || {}
  const stripeSessionId = session.id

  try {
    // Idempotency: check if audit already exists for this session
    const { data: existing } = await supabaseAdmin
      .from('audits')
      .select('id, payment_status, audit_status')
      .eq('stripe_session', stripeSessionId)
      .single()

    if (existing) {
      // Already paid — do not duplicate
      if (existing.payment_status === 'paid') {
        return NextResponse.json({ received: true, message: 'Already processed' })
      }

      // Already processing or done — do not restart
      if (['processing', 'done', 'delivered'].includes(existing.audit_status)) {
        return NextResponse.json({ received: true, message: 'Audit in progress or done' })
      }

      // Update existing record and run audit
      await supabaseAdmin
        .from('audits')
        .update({ payment_status: 'paid', audit_status: 'processing' })
        .eq('id', existing.id)

      // Run audit synchronously
      await runFullAudit(existing.id)

      return NextResponse.json({ received: true, audit_id: existing.id })
    }

    // Create new audit record
    const { data: audit, error: insertError } = await supabaseAdmin
      .from('audits')
      .insert({
        email: meta.email || session.customer_email || '',
        url: meta.url || '',
        competitor_1: meta.competitor_1 || null,
        competitor_2: meta.competitor_2 || null,
        competitor_3: meta.competitor_3 || null,
        icp_description: meta.icp_description || null,
        score_id: meta.score_id || null,
        stripe_session: stripeSessionId,
        payment_status: 'paid',
        audit_status: 'processing',
        tier: meta.tier || 'automated',
      })
      .select('id')
      .single()

    if (insertError || !audit) {
      console.error('Failed to create audit record:', insertError)
      return NextResponse.json({ error: 'Failed to create audit' }, { status: 500 })
    }

    // Run audit synchronously
    await runFullAudit(audit.id)

    return NextResponse.json({ received: true, audit_id: audit.id })
  } catch (err) {
    console.error('Webhook processing error:', err)
    // Return 200 to prevent Stripe retries on application-level errors
    // The audit status will be 'failed' if runFullAudit threw
    return NextResponse.json({ received: true, error: 'Processing failed' })
  }
}
