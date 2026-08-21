import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { availableEngines } from '@/lib/geo'
import { isValidAdminCookie, ADMIN_COOKIE } from '@/lib/auth'
import { STALE_PROCESSING_MS } from '@/lib/audit-recovery'
import { ADMIN_AUDIT_COLUMNS } from '@/lib/admin-audit-schema'
import { getDailyAiSpendStatus } from '@/lib/daily-ai-spend'

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
    return NextResponse.json({
      status: 'ok',
      deployment: publicDeploymentInfo(),
    }, { status: 200 })
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

  // Test every field selected by the admin audit query separately so an
  // unapplied migration names every missing column instead of failing as an
  // opaque admin-page 500.
  const adminAuditSchema = await auditColumnCheck('audits', ADMIN_AUDIT_COLUMNS)
  checks.admin_audits_schema = adminAuditSchema.missing.length
    ? {
        ok: false,
        type: 'live',
        detail: `Missing audits columns: ${adminAuditSchema.missing.join(', ')}`,
      }
    : adminAuditSchema.errors.length
      ? { ok: false, type: 'live', detail: `Could not verify audits columns: ${adminAuditSchema.errors.join('; ')}` }
    : { ok: true, type: 'live' }

  // Env presence only (no live billable calls to Anthropic/Firecrawl/etc.).
  const envVars = [
    'ANTHROPIC_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'FIRECRAWL_API_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_PRICE_ID_AUDIT',
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
  const [audits, dailyAiSpend] = await Promise.all([
    auditCounts(),
    getDailyAiSpendStatus(),
  ])

  // "Healthy" = the things that must be live/present for the core pipeline.
  const required = ['supabase', 'admin_audits_schema', 'env:ANTHROPIC_API_KEY', 'env:SUPABASE_SERVICE_ROLE_KEY', 'env:FIRECRAWL_API_KEY', 'env:ACCESS_TOKEN_SECRET']
  const healthy = required.every((k) => checks[k]?.ok) && !dailyAiSpend.queue_blocked

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      note: 'supabase is checked live; other services are env-presence only (no billable probes).',
      deployment: await deploymentInfo(),
      checks,
      audits,
      daily_ai_spend: dailyAiSpend,
      ts: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  )
}

async function auditColumnCheck(table: string, columns: readonly string[]): Promise<{ missing: string[]; errors: string[] }> {
  const results = await Promise.all(columns.map(async (column) => {
    try {
      const { error } = await supabaseAdmin.from(table).select(column).limit(1)
      if (!error) return null
      const message = error.message || String(error)
      return error.code === '42703' || /column .* does not exist/i.test(message)
        ? { missing: column }
        : { error: `${column}: ${message}` }
    } catch (err) {
      return { error: `${column}: ${err instanceof Error ? err.message : String(err)}` }
    }
  }))
  const checked = { missing: [] as string[], errors: [] as string[] }
  for (const result of results) {
    if (!result) continue
    if (typeof result.missing === 'string') checked.missing.push(result.missing)
    else checked.errors.push(result.error ?? 'Unknown schema-check error')
  }
  return checked
}

async function deploymentInfo(): Promise<Record<string, string | null>> {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA || null
  const latestGeneration = await latestGenerationIdentity()
  return {
    commit_sha: commit,
    commit_short: commit ? commit.slice(0, 7) : null,
    vercel_env: process.env.VERCEL_ENV || null,
    vercel_url: process.env.VERCEL_URL || null,
    latest_generation_engine_version: latestGeneration.version,
    latest_generation_engine_commit: latestGeneration.commit,
  }
}

async function latestGenerationIdentity(): Promise<{ version: string | null; commit: string | null }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('audits')
      .select('report, last_generated_at')
      .not('report', 'is', null)
      .order('last_generated_at', { ascending: false })
      .limit(1)
    if (error || !data?.[0]) return { version: null, commit: null }
    const meta = (data[0].report as { meta?: { engine_version?: unknown; engine_commit?: unknown } } | null)?.meta
    return {
      version: typeof meta?.engine_version === 'string' ? meta.engine_version : null,
      commit: typeof meta?.engine_commit === 'string' ? meta.engine_commit : null,
    }
  } catch {
    return { version: null, commit: null }
  }
}

function publicDeploymentInfo(): Record<string, string | null> {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA || null
  return {
    commit_short: commit ? commit.slice(0, 7) : null,
    vercel_env: process.env.VERCEL_ENV || null,
  }
}

/** Live audit-status counts for fulfillment monitoring. */
async function auditCounts(): Promise<Record<string, number | string>> {
  const statuses = ['queued', 'processing', 'failed', 'done', 'awaiting_review', 'delivery_failed', 'delivered'] as const
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
        .lt('processing_started_at', cutoff),
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
