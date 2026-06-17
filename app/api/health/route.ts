import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { availableEngines } from '@/lib/geo'
import { isValidAdminCookie, ADMIN_COOKIE } from '@/lib/auth'

// No caching - this is a live diagnostic.
export const dynamic = 'force-dynamic'

/**
 * Liveness + (gated) diagnostics.
 *
 * Public response is intentionally minimal - just that the app is up. It does
 * NOT probe Supabase/Anthropic/Firecrawl, so it makes no claim about them.
 *
 * Detailed diagnostics (live Supabase ping + env presence for the other
 * services) require an admin session or a HEALTH_TOKEN, so we don't leak which
 * integrations are configured to the public.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const healthToken = process.env.HEALTH_TOKEN
  const authorized =
    isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value) ||
    (!!healthToken && token === healthToken)

  // Public: simple liveness only.
  if (!authorized) {
    return NextResponse.json({ status: 'ok' }, { status: 200 })
  }

  // --- Authorized detailed diagnostics ---
  const checks: Record<string, { ok: boolean; type: 'live' | 'env-presence'; detail?: string }> = {}

  // Live Supabase connectivity - the dependency that actually broke the demo.
  try {
    const { error } = await supabaseAdmin.from('scores').select('id').limit(1)
    checks.supabase = error
      ? { ok: false, type: 'live', detail: error.message }
      : { ok: true, type: 'live' }
  } catch (err) {
    checks.supabase = {
      ok: false,
      type: 'live',
      detail: err instanceof Error ? err.message : String(err),
    }
  }

  // Env presence only (no live billable calls to Anthropic/Firecrawl/etc.).
  const envVars = [
    'ANTHROPIC_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'FIRECRAWL_API_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_PRICE_ID_399',
    'STRIPE_WEBHOOK_SECRET',
    'RESEND_API_KEY',
    'ACCESS_TOKEN_SECRET',
    'ADMIN_PASSWORD',
  ]
  for (const v of envVars) {
    checks[`env:${v}`] = { ok: !!process.env[v], type: 'env-presence' }
  }

  checks.aeo_engines = { ok: true, type: 'env-presence', detail: availableEngines().join(', ') }

  // Live audit fulfillment counts - surfaces stuck/failed paid audits.
  const audits = await auditCounts()

  // "Healthy" = the things that must be live/present for the core pipeline.
  const required = ['supabase', 'env:ANTHROPIC_API_KEY', 'env:SUPABASE_SERVICE_ROLE_KEY', 'env:FIRECRAWL_API_KEY', 'env:ACCESS_TOKEN_SECRET']
  const healthy = required.every((k) => checks[k]?.ok)

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      note: 'supabase is checked live; other services are env-presence only (no billable probes).',
      checks,
      audits,
      ts: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  )
}

const STALE_PROCESSING_MS = 20 * 60 * 1000

/** Live audit-status counts for fulfillment monitoring. */
async function auditCounts(): Promise<Record<string, number | string>> {
  const statuses = ['queued', 'processing', 'failed', 'done', 'delivered'] as const
  const out: Record<string, number | string> = {}
  try {
    const cutoff = new Date(Date.now() - STALE_PROCESSING_MS).toISOString()
    const results = await Promise.all([
      ...statuses.map((s) =>
        supabaseAdmin.from('audits').select('id', { count: 'exact', head: true }).eq('audit_status', s)
      ),
      supabaseAdmin
        .from('audits')
        .select('id', { count: 'exact', head: true })
        .eq('audit_status', 'processing')
        .lt('created_at', cutoff),
    ])
    statuses.forEach((s, i) => {
      out[s] = results[i].count ?? 0
    })
    out.stale_processing = results[statuses.length].count ?? 0
  } catch (err) {
    out.error = err instanceof Error ? err.message : String(err)
  }
  return out
}
