import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { isValidAdminCookie, ADMIN_COOKIE } from '@/lib/auth'
import { enqueueAudit } from '@/lib/audit-queue'
import { notify } from '@/lib/notify'
import { trySignToken } from '@/lib/tokens'
import { competitorUrlSchema, icpTextSchema } from '@/lib/schemas'

export const maxDuration = 60

const requestSchema = z.object({
  email: z.string().email(),
  url: z.string().url(),
  competitor_1: competitorUrlSchema,
  competitor_2: competitorUrlSchema,
  competitor_3: competitorUrlSchema,
  // ICP must be plain text - a URL here is rejected (the URL belongs in `url`).
  icp_description: icpTextSchema,
  tier: z.enum(['automated', 'reviewed', 'sprint']).optional().default('automated'),
  // Operator-confirmed buyer-intent queries from the preview/confirmation step.
  queries: z.array(z.string().min(1)).max(12).optional(),
})

/**
 * Admin-only manual / comped audit. Same fulfillment path as a paid audit
 * (insert audit row -> enqueueAudit -> Trigger.dev run), but with no Stripe:
 * payment_status is marked "paid" so the run proceeds, stripe_session is null.
 * Lets us run real audits for friends and collect feedback without payments.
 */
export async function POST(req: NextRequest) {
  if (!isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let input: z.infer<typeof requestSchema>
  try {
    input = requestSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: err.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Create the audit row (comped: marked paid, no Stripe session).
  const base = {
    email: input.email,
    url: input.url,
    competitor_1: input.competitor_1 || null,
    competitor_2: input.competitor_2 || null,
    competitor_3: input.competitor_3 || null,
    icp_description: input.icp_description || null,
    stripe_session: null,
    payment_status: 'paid', // comped: no `comped` value in the current schema
    audit_status: 'queued',
    tier: input.tier,
  }
  const queries = input.queries?.length ? input.queries : null

  let { data: audit, error: insertError } = await supabaseAdmin
    .from('audits')
    .insert(queries ? { ...base, geo_queries: queries } : base)
    .select('id')
    .single()

  // Graceful fallback if migration 003 (geo_queries column) isn't applied yet.
  if (insertError && queries && /geo_queries/i.test(insertError.message)) {
    console.warn('[admin/create] geo_queries column missing - run migration 003. Inserting without it.')
    ;({ data: audit, error: insertError } = await supabaseAdmin
      .from('audits')
      .insert(base)
      .select('id')
      .single())
  }

  if (insertError || !audit) {
    console.error('[admin/create] insert failed:', insertError)
    return NextResponse.json({ error: 'Failed to create audit' }, { status: 500 })
  }

  const auditId = audit.id
  const token = trySignToken('audit', auditId)
  const reportUrl = token ? `/audit/${auditId}?token=${token}` : `/audit/${auditId}`

  // Kick off generation. On failure the audit stays queued for the recovery
  // sweep; alert via the existing safety net and surface a 500.
  try {
    await enqueueAudit(auditId)
  } catch (enqueueErr) {
    await notify('audit_enqueue_failed', {
      audit_id: auditId,
      source: 'manual',
      email: input.email,
      error: enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr),
    })
    return NextResponse.json(
      { error: 'Audit created but enqueue failed; it will be retried by recovery', audit_id: auditId },
      { status: 500 }
    )
  }

  return NextResponse.json({ audit_id: auditId, report_url: reportUrl })
}
