import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'
import { enqueueAudit } from '@/lib/audit-queue'
import { notify } from '@/lib/notify'
import Stripe from 'stripe'

// Allow up to 5 minutes on Vercel Pro; on Hobby it's capped at 60s.
export const maxDuration = 300

export async function POST(req: Request) {
  console.log('[webhook] POST /api/stripe/webhook received')

  const body = await req.text()
  const signature = headers().get('stripe-signature')

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

  console.log('[webhook] checkout.session.completed -- session:', stripeSessionId)
  console.log('[webhook] metadata email:', meta.email, 'url:', meta.url)

  try {
    const { data: existing } = await supabaseAdmin
      .from('audits')
      .select('id, payment_status, audit_status, processing_started_at')
      .eq('stripe_session', stripeSessionId)
      .single()

    let auditId: string

    if (existing) {
      console.log(
        '[webhook] Existing audit found:',
        existing.id,
        '| payment_status:',
        existing.payment_status,
        '| audit_status:',
        existing.audit_status
      )

      if (['done', 'delivered'].includes(existing.audit_status)) {
        return new Response(JSON.stringify({ received: true, message: 'Audit already in progress or done' }), { status: 200 })
      }

      if (existing.payment_status === 'paid' && existing.audit_status === 'processing' && existing.processing_started_at) {
        return new Response(JSON.stringify({ received: true, message: 'Audit already in progress' }), { status: 200 })
      }

      await supabaseAdmin
        .from('audits')
        .update({ payment_status: 'paid', audit_status: 'queued', processing_started_at: null })
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
          audit_status: 'queued',
          tier: meta.tier || 'automated',
        })
        .select('id')
        .single()

      if (insertError || !audit) {
        if (insertError?.code === '23505') {
          const { data: duplicate } = await supabaseAdmin
            .from('audits')
            .select('id, payment_status, audit_status, processing_started_at')
            .eq('stripe_session', stripeSessionId)
            .single()

          if (duplicate) {
            if (['done', 'delivered'].includes(duplicate.audit_status)) {
              return new Response(JSON.stringify({ received: true, message: 'Already processed' }), { status: 200 })
            }
            if (duplicate.payment_status === 'paid' && duplicate.audit_status === 'processing' && duplicate.processing_started_at) {
              return new Response(JSON.stringify({ received: true, message: 'Audit already in progress' }), { status: 200 })
            }
            await supabaseAdmin
              .from('audits')
              .update({ payment_status: 'paid', audit_status: 'queued', processing_started_at: null })
              .eq('id', duplicate.id)

            auditId = duplicate.id
            console.log('[webhook] Recovered duplicate Stripe session as audit:', auditId)
          } else {
            console.error('[webhook] Failed to resolve duplicate Stripe session:', insertError)
            return new Response(JSON.stringify({ error: 'DB insert failed' }), { status: 500 })
          }
        } else {
          console.error('[webhook] Failed to insert audit record:', insertError)
          return new Response(JSON.stringify({ error: 'DB insert failed' }), { status: 500 })
        }
      } else {
        auditId = audit.id
        console.log('[webhook] Audit record created:', auditId)
      }
    }

    console.log('[webhook] Enqueuing audit for:', auditId)
    try {
      await enqueueAudit(auditId, { trigger: 'paid_webhook', endpoint: '/api/stripe/webhook' })
    } catch (enqueueErr) {
      // Paid, but couldn't enqueue. Alert, and return 500 so Stripe retries.
      // enqueueAudit leaves the audit in `queued` for the recovery endpoint.
      await notify('audit_enqueue_failed', {
        audit_id: auditId,
        stripe_session: stripeSessionId,
        email: meta.email,
        error: enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr),
      })
      return new Response(JSON.stringify({ error: 'Audit enqueue failed' }), { status: 500 })
    }

    return new Response(JSON.stringify({ received: true, audit_id: auditId }), { status: 200 })
  } catch (err) {
    console.error('[webhook] Unexpected error:', err)
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), { status: 500 })
  }
}
