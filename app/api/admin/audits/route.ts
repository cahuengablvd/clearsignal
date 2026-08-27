import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isValidAdminCookie, ADMIN_COOKIE } from '@/lib/auth'
import { trySignToken } from '@/lib/tokens'
// Shared with the admin screen so the order and the band headers cannot drift.
import { statusPriority } from '@/lib/audit-bands'
import { buildAdminEngineCoverage } from '@/lib/admin-engine-coverage'
import { ADMIN_AUDIT_SELECT } from '@/lib/admin-audit-schema'
import { latestObservedEngineVersion } from '@/lib/engine-version'
import { isDeterministicAuditFailure } from '@/lib/audit-recovery'
import { getDailyAiSpendStatus } from '@/lib/daily-ai-spend'
import { BusinessContextSchema } from '@/lib/schemas'
import { z } from 'zod'

const updateContextSchema = z.object({
  audit_id: z.string().uuid(),
  brand_aliases: z.string().max(1000),
})

function lastActivityAt(audit: {
  created_at: string
  last_generated_at?: string | null
  last_rerendered_at?: string | null
  last_delivered_at?: string | null
}): string {
  const dates = [
    audit.last_generated_at,
    audit.last_rerendered_at,
    audit.last_delivered_at,
    audit.created_at,
  ].filter(Boolean) as string[]
  return dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || audit.created_at
}

function qualitySummary(quality: unknown) {
  const q = quality as any
  const issues = Array.isArray(q?.critic?.issues) ? q.critic.issues : []
  const counts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  }
  for (const issue of issues) {
    if (issue?.severity && issue.severity in counts) {
      counts[issue.severity as keyof typeof counts] += 1
    }
  }
  return {
    stage: typeof q?.stage === 'string' ? q.stage : null,
    shadow_mode: true,
    critic: q?.critic
      ? {
          model: q.critic.model || null,
          ranAt: q.critic.ranAt || null,
          attempt: q.critic.attempt ?? null,
          droppedIssues: q.critic.droppedIssues ?? 0,
          issue_count: issues.length,
          counts,
          issues: issues.slice(0, 25).map((issue: any) => ({
            id: issue.id,
            severity: issue.severity,
            category: issue.category,
            path: issue.path,
            explanation: issue.explanation,
            currentText: issue.currentText,
            suggestedReplacement: issue.suggestedReplacement,
            canAutoFix: issue.canAutoFix,
          })),
        }
      : null,
    criticError: q?.criticError || null,
  }
}

export async function GET(req: NextRequest) {
  // Check admin session
  if (!isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dailyAiSpend = await getDailyAiSpendStatus()

  const { data: audits, error } = await supabaseAdmin
    .from('audits')
    .select(ADMIN_AUDIT_SELECT)
    .order('created_at', { ascending: false })
    // Fetch a wider window before in-memory priority sorting so regenerated
    // older audits can still float to the top during review batches.
    .limit(500)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch audits' }, { status: 500 })
  }

  // The worker deploys independently of Vercel, so no env var here can be
  // trusted as "the current engine" - and TRIGGER_VERSION must never be set
  // (it pins runs to a version). The newest engine version we have actually
  // observed generating a report is the honest reference: once a run happens
  // on a newer worker, every older report is visibly older.
  const expectedEngineVersion = latestObservedEngineVersion(audits || [])
  const appCommit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null

  const auditIds = (audits || []).map((audit) => audit.id)
  const [{ data: aiLogs }, { data: stageExecutions }] = auditIds.length
    ? await Promise.all([
        supabaseAdmin
          .from('audit_ai_call_logs')
          .select('audit_id, stage, purpose, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, estimated_cost_usd, recovery_attempt, trigger, status')
          .in('audit_id', auditIds),
        supabaseAdmin
          .from('audit_stage_executions')
          .select('audit_id, stage, attempt, status, trigger')
          .in('audit_id', auditIds),
      ])
    : [{ data: [] }, { data: [] }]

  const costByAudit = new Map<string, {
    ai_call_count: number
    stages_executed: string[]
    input_tokens: number
    output_tokens: number
    cache_read_tokens: number
    cache_creation_tokens: number
    estimated_cost_usd: number
    recovery_attempts: number
    duplicate_stage_warning: boolean
    triggers: string[]
  }>()

  for (const id of auditIds) {
    costByAudit.set(id, {
      ai_call_count: 0,
      stages_executed: [],
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
      estimated_cost_usd: 0,
      recovery_attempts: 0,
      duplicate_stage_warning: false,
      triggers: [],
    })
  }

  for (const log of aiLogs || []) {
    if (!log.audit_id) continue
    const summary = costByAudit.get(log.audit_id)
    if (!summary) continue
    summary.ai_call_count += 1
    summary.input_tokens += Number(log.input_tokens ?? 0)
    summary.output_tokens += Number(log.output_tokens ?? 0)
    summary.cache_read_tokens += Number(log.cache_read_tokens ?? 0)
    summary.cache_creation_tokens += Number(log.cache_creation_tokens ?? 0)
    summary.estimated_cost_usd += Number(log.estimated_cost_usd ?? 0)
    if (typeof log.recovery_attempt === 'number' && log.recovery_attempt > 0) {
      summary.recovery_attempts = Math.max(summary.recovery_attempts, log.recovery_attempt)
    }
    if (log.trigger && !summary.triggers.includes(log.trigger)) summary.triggers.push(log.trigger)
  }

  const executionCounts = new Map<string, number>()
  for (const execution of stageExecutions || []) {
    const summary = costByAudit.get(execution.audit_id)
    if (!summary) continue
    if (!summary.stages_executed.includes(execution.stage)) summary.stages_executed.push(execution.stage)
    if (execution.trigger === 'recovery') summary.recovery_attempts = Math.max(summary.recovery_attempts, execution.attempt ?? 0)
    if (execution.status === 'completed') {
      const stageKey = `${execution.audit_id}:${execution.stage}`
      executionCounts.set(stageKey, (executionCounts.get(stageKey) ?? 0) + 1)
    }
  }

  for (const [key, count] of executionCounts.entries()) {
    if (count <= 1) continue
    const auditId = key.split(':')[0]
    const summary = costByAudit.get(auditId)
    if (summary) summary.duplicate_stage_warning = true
  }

  // Attach a shareable, signed report link for finished audits (so the admin
  // can copy a URL to send a friend without an admin session).
  const withLinks = (audits || []).map((a) => {
    const report = a.report as { validation_warnings?: unknown[] } | null
    const validation_repair_count = Array.isArray(report?.validation_warnings)
      ? report.validation_warnings.length
      : 0
    const has_report = Boolean(a.report)
    const generationMeta = (a.report as { meta?: { engine_version?: string; engine_commit?: string } } | null)?.meta
    const engine_version = generationMeta?.engine_version || null
    const engine_commit = generationMeta?.engine_commit || null
    const engine_coverage_summary = buildAdminEngineCoverage(a.report)
    const entity_diagnostics = (a.report as { geo?: { entity_resolution?: { entities?: unknown[] } } } | null)?.geo?.entity_resolution?.entities || []
    const { report: _report, quality: _quality, ...audit } = a
    const last_activity_at = lastActivityAt(a)
    if (['done', 'awaiting_review', 'delivery_failed', 'delivered'].includes(a.audit_status)) {
      const token = trySignToken('audit', a.id)
      return {
        ...audit,
        has_report,
        app_commit: appCommit,
        expected_engine_version: expectedEngineVersion,
        engine_version,
        engine_commit,
        engine_version_drift: Boolean(expectedEngineVersion && engine_version && engine_version !== expectedEngineVersion),
        last_activity_at,
        validation_repair_count,
        quality_summary: qualitySummary(a.quality),
        engine_coverage_summary,
        entity_diagnostics,
        ai_cost_summary: costByAudit.get(a.id) ?? null,
        deterministic_failure: isDeterministicAuditFailure(a.admin_notes),
        report_url: token ? `/audit/${a.id}?token=${token}` : `/audit/${a.id}`,
      }
    }
    return {
      ...audit,
      has_report,
      app_commit: appCommit,
      expected_engine_version: expectedEngineVersion,
      engine_version,
      engine_commit,
      engine_version_drift: Boolean(expectedEngineVersion && engine_version && engine_version !== expectedEngineVersion),
      last_activity_at,
      validation_repair_count,
      quality_summary: qualitySummary(a.quality),
      engine_coverage_summary,
      entity_diagnostics,
      ai_cost_summary: costByAudit.get(a.id) ?? null,
      deterministic_failure: isDeterministicAuditFailure(a.admin_notes),
      report_url: null as string | null,
    }
  }).sort((a, b) => {
    const priorityDelta = statusPriority(a.audit_status) - statusPriority(b.audit_status)
    if (priorityDelta !== 0) return priorityDelta
    return new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime()
  })

  return NextResponse.json({ audits: withLinks, daily_ai_spend: dailyAiSpend })
}

/** Update only the operator-confirmed aliases; do not let an inline edit erase context. */
export async function PATCH(req: NextRequest) {
  if (!isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const parsed = updateContextSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.errors }, { status: 400 })

  const aliases = BusinessContextSchema.shape.brand_aliases.safeParse(parsed.data.brand_aliases)
  if (!aliases.success) return NextResponse.json({ error: aliases.error.errors[0]?.message || 'Invalid brand aliases' }, { status: 400 })
  const { data: audit, error: readError } = await supabaseAdmin
    .from('audits')
    .select('business_context')
    .eq('id', parsed.data.audit_id)
    .single()
  if (readError || !audit) return NextResponse.json({ error: 'Audit not found' }, { status: 404 })

  const business_context = BusinessContextSchema.parse({ ...(audit.business_context || {}), brand_aliases: aliases.data })
  const { error: updateError } = await supabaseAdmin.from('audits').update({ business_context }).eq('id', parsed.data.audit_id)
  if (updateError) return NextResponse.json({ error: 'Failed to save brand aliases' }, { status: 500 })
  return NextResponse.json({ success: true, business_context })
}
