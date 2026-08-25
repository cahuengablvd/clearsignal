import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { isValidAdminCookie, ADMIN_COOKIE } from '@/lib/auth'
import { enqueueAudit } from '@/lib/audit-queue'
import { notify } from '@/lib/notify'
import { trySignToken } from '@/lib/tokens'
import { BusinessContextSchema, competitorUrlSchema, icpTextSchema, QueryProvenanceSchema } from '@/lib/schemas'
import { normalizeWebsiteUrl } from '@/lib/normalize-url'
import { applyOperatorEdits, validateSavedQueryPlan } from '@/lib/geo'
import { parseMarketsLanguages } from '@/lib/geo/language'

export const maxDuration = 60

const requestSchema = z.object({
  email: z.string().email(),
  url: z
    .string()
    .trim()
    .transform(normalizeWebsiteUrl)
    .refine((value): value is string => value !== null, 'Enter a valid homepage URL'),
  competitor_1: competitorUrlSchema,
  competitor_2: competitorUrlSchema,
  competitor_3: competitorUrlSchema,
  // ICP must be plain text - a URL here is rejected (the URL belongs in `url`).
  icp_description: icpTextSchema,
  tier: z.enum(['automated', 'reviewed', 'sprint']).optional().default('automated'),
  // Operator-confirmed buyer-intent queries from the preview/confirmation step.
  queries: z.array(z.string().min(1)).max(12).optional(),
  query_plan: z.object({ core: z.array(z.unknown()), supplemental: z.array(z.unknown()), provenance: z.array(QueryProvenanceSchema), valid_core_slots: z.number(), review_required: z.boolean(), primary_language: z.string(), markets: z.array(z.string()), warnings: z.array(z.string()).optional() }).optional(),
  override_query_validation: z.boolean().optional().default(false),
  business_context: BusinessContextSchema.optional(),
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
  const queuedAt = new Date().toISOString()
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
    queued_at: queuedAt,
    tier: input.tier,
  }
  let queries = input.queries?.length ? input.queries : null
  let structuredPlan = input.query_plan
  if (structuredPlan) {
    const saved = validateSavedQueryPlan(structuredPlan)
    if (!saved.valid) return NextResponse.json({ error: `Invalid query plan: ${saved.reason}` }, { status: 400 })
    if (queries) {
      const markets = parseMarketsLanguages(input.business_context?.target_markets_languages).markets
      const edited = applyOperatorEdits(saved.plan, queries, { brandAliases: [new URL(input.url).hostname.replace(/^www\./, '')], markets, override: input.override_query_validation })
      if (edited.rejected) return NextResponse.json({ error: 'Edited query did not pass validation; correct it or use an explicit operator override.', query_plan: edited.plan }, { status: 400 })
      structuredPlan = edited.plan
      queries = edited.plan.provenance.filter((item) => item.scope === 'core' && item.state === 'valid').map((item) => item.query)
    } else {
      structuredPlan = saved.plan
    }
    if (structuredPlan.valid_core_slots < 4) {
      return NextResponse.json({ error: 'query_plan_insufficient', query_plan: structuredPlan }, { status: 422 })
    }
  }
  const businessContext = BusinessContextSchema.parse({ ...(input.business_context || {}), ...(structuredPlan ? { query_plan: structuredPlan } : {}) })

  let { data: audit, error: insertError } = await supabaseAdmin
    .from('audits')
    .insert({ ...base, ...(queries ? { geo_queries: queries } : {}), business_context: businessContext })
    .select('id')
    .single()

  // Graceful fallback if migration 003 (geo_queries column) isn't applied yet.
  if (insertError && (queries || input.business_context) && /(geo_queries|business_context)/i.test(insertError.message)) {
    console.warn('[admin/create] optional column missing - run latest migrations. Inserting without optional audit context.')
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
    await enqueueAudit(auditId, { trigger: 'manual_create', endpoint: '/api/admin/audits/create' })
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
