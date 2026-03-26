import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'
import { runFullAudit } from '@/lib/audit-runner'
import Stripe from 'stripe'

// Allow up to 5 minutes on Vercel Pro; on Hobby it's capped at 60s
export const maxDuration = 300

export async function POST(req: Request) {
  console.log('[webhook] POST /api/stripe/webhook received')

  const body = await req.text()
  const headersList = headers()
  const signature = headersList.get('stripe-signature')

  console.log('[webhook] stripe-signature present:', !!signature)

  if (!signature) {
    console.error('[webhook] Missing stripe-signature header')
    return new Response(JSON.stringify({ error: 'Missing signature' }), { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err)
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 })
  }

  console.log('[webhook] Event type:', event.type)

  if (event.type !== 'checkout.session.completed') {
    return new Response(JSON.stringify({ received: true }), { status: 200 })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const meta = session.metadata || {}
  const stripeSessionId = session.id

  console.log('[webhook] checkout.session.completed — session:', stripeSessionId)
  console.log('[webhook] metadata email:', meta.email, 'url:', meta.url)

  try {
    // Idempotency: check if audit already exists for this session
    const { data: existing } = await supabaseAdmin
      .from('audits')
      .select('id, payment_status, audit_status')
      .eq('stripe_session', stripeSessionId)
      .single()

    let auditId: string

    if (existing) {
      console.log('[webhook] Existing audit found:', existing.id, '| payment_status:', existing.payment_status, '| audit_status:', existing.audit_status)

      // Already paid — do not duplicate
      if (existing.payment_status === 'paid') {
        return new Response(JSON.stringify({ received: true, message: 'Already processed' }), { status: 200 })
      }

      // Already processing or done — do not restart
      if (['processing', 'done', 'delivered'].includes(existing.audit_status)) {
        return new Response(JSON.stringify({ received: true, message: 'Audit already in progress or done' }), { status: 200 })
      }

      await supabaseAdmin
        .from('audits')
        .update({ payment_status: 'paid', audit_status: 'processing' })
        .eq('id', existing.id)

      auditId = existing.id
    } else {
      console.log('[webhook] Creating new audit record for session:', stripeSessionId)

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
        console.error('[webhook] Failed to insert audit record:', insertError)
        // Return 200 so Stripe doesn't retry — we'll need manual recovery
        return new Response(JSON.stringify({ received: true, error: 'DB insert failed' }), { status: 200 })
      }

      auditId = audit.id
      console.log('[webhook] Audit record created:', auditId)
    }

    // Respond 200 immediately so Stripe doesn't retry.
    // Fire the audit runner without awaiting — Vercel keeps the function
    // alive until the event loop drains (serverless Node.js runtime).
    console.log('[webhook] Firing audit runner for:', auditId)
    runFullAudit(auditId).catch((err) => {
      console.error('[webhook] runFullAudit failed for', auditId, ':', err)
    })

    return new Response(JSON.stringify({ received: true, audit_id: auditId }), { status: 200 })
  } catch (err) {
    console.error('[webhook] Unexpected error:', err)
    // Return 200 to prevent Stripe from retrying indefinitely
    return new Response(JSON.stringify({ received: true, error: 'Unexpected error' }), { status: 200 })
  }
}
