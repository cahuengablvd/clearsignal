import { callClaudeJSON } from '../anthropic'
import type { AuditExecutionContext } from '../audit-execution'
import { runAuditStage } from '../audit-execution'
import type { CostEvent } from '../cost-tracker'
import { allowedSchemaTypes } from '../industry-profiles/schema-allowlist'
import { materialCategoryForContext } from '../materials'
import {
  CLAIM_LEVELS,
  EVIDENCE_BOUNDARY,
  MODEL_QUALITY_CRITIC,
  NO_FABRICATED_NUMBERS,
  UNTRUSTED_GUARD,
} from '../prompts'
import { isRawPath } from '../report-validator'
import {
  AuditIssuesSchema,
  type AuditIssue,
  type BusinessContext,
  type ClearSignalReport,
  type ObservedBusinessContext,
} from '../schemas'
import { ASTROTURFING_PATTERNS } from '../trust-phrases'
import { CLIENT_VISIBLE_REPLACEMENT_SENTENCES } from '../trust/decisions'

export type QualityCriticResult = {
  issues: AuditIssue[]
  model: string
  ranAt: string
  attempt: number
  droppedIssues: number
}

export function qualityCriticEnabled(): boolean {
  return process.env.QUALITY_CRITIC_ENABLED === 'true'
}

function pathSegments(path: string): string[] {
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean)
}

function valueAtPath(root: unknown, path: string): unknown {
  let cursor = root as any
  for (const segment of pathSegments(path)) {
    if (cursor == null) return undefined
    cursor = cursor[segment]
  }
  return cursor
}

function isProtectedPath(path: string): boolean {
  const segments = pathSegments(path)
  const key = segments[segments.length - 1]
  if (isRawPath(segments, key)) return true
  if (segments.some((segment) => segment === 'evidence_ids' || segment === 'evidence_id')) return true
  if (segments[0] === 'geo') {
    const protectedGeo = new Set([
      'evidence',
      'test_counts',
      'mention_rate',
      'citation_rate',
      'ai_visibility_score',
      'share_of_voice',
    ])
    if (segments.some((segment) => protectedGeo.has(segment))) return true
  }
  if (segments[0] === 'meta') {
    const protectedMeta = new Set(['canonical_brand', 'alternative_brand_forms', 'brand_domain', 'domain'])
    if (segments.some((segment) => protectedMeta.has(segment))) return true
  }
  return false
}

export function validateCriticIssues(report: ClearSignalReport, issues: AuditIssue[]): AuditIssue[] {
  return issues.filter((issue) => {
    if (!issue.path || isProtectedPath(issue.path)) {
      console.warn('[quality-critic] dropped issue for protected path:', issue.path)
      return false
    }
    if (typeof valueAtPath(report, issue.path) === 'undefined') {
      console.warn('[quality-critic] dropped issue for unresolved path:', issue.path)
      return false
    }
    return true
  })
}

function compactReport(report: ClearSignalReport): Record<string, unknown> {
  const geo = report.geo
    ? {
        ai_visibility_score: report.geo.ai_visibility_score,
        mention_rate: report.geo.mention_rate,
        citation_rate: report.geo.citation_rate,
        queries_tested: report.geo.queries_tested,
        engines_tested: report.geo.engines_tested,
        test_counts: report.geo.test_counts,
        summary: report.geo.summary,
      }
    : null

  return {
    meta: report.meta,
    clarity: report.clarity,
    gap: report.gap,
    action: report.action,
    ready_materials: report.ready_materials,
    implementation_briefs: report.implementation_briefs,
    data_limitations: report.data_limitations,
    technical_findings: report.technical_findings,
    geo,
  }
}

function criticSystemPrompt(): string {
  const astroturfingLabels = ASTROTURFING_PATTERNS.map(([, label]) => label).join(', ')
  return `You are the ClearSignal audit quality critic running in shadow mode.
Identify issues only. Never rewrite the report and never emit patches.
Use only real ClearSignalReport paths such as action.top_fixes[2].title, ready_materials.faq[1].answer, implementation_briefs[0].steps[2], gap.ai_search.finding, clarity.cta.suggested_rewrite.
Never question GEO numbers, GEO rates, GEO test_counts, technical_findings, evidence_ids, validation_warnings, or metadata identity fields.
Order issues by severity and return at most 25.
Use these categories exactly: wrong_business, foreign_industry, unverified_claim, replacement_leak, broken_sentence, empty_section, question_answer_mismatch, schema_mismatch, evidence_mismatch, internal_contradiction, policy_violation, grammar, duplicate, other.
Flag policy wording families including: ${astroturfingLabels}.
Flag replacement sentence leaks from the provided list when they appear in client-facing fields.
${UNTRUSTED_GUARD}
${NO_FABRICATED_NUMBERS}
${EVIDENCE_BOUNDARY}
${CLAIM_LEVELS}
Return ONLY JSON: { "issues": [ { "id": "Q1", "severity": "critical|high|medium|low", "category": "<category>", "path": "<real path>", "explanation": "<why>", "currentText": "<optional exact current text>", "suggestedReplacement": "<optional concise direction>", "canAutoFix": <boolean> } ] }`
}

function criticUserPrompt(report: ClearSignalReport): string {
  const businessContext = report.meta.business_context as BusinessContext | undefined
  const observed = report.meta.observed_business_context as ObservedBusinessContext | undefined
  const category = materialCategoryForContext(businessContext, observed)
  const allowlist = allowedSchemaTypes(category) || []
  return `Audit category: ${category}
Allowed schema types: ${allowlist.join(', ') || 'unknown category - do not judge schema allowlist'}
Canonical brand: ${report.meta.canonical_brand || '(unknown)'}
Brand aliases: ${(report.meta.alternative_brand_forms || []).join(', ') || '(none)'}
Business context:
${JSON.stringify(businessContext || {}, null, 2)}
Verified facts:
${JSON.stringify(report.meta.verified_facts_layer || [], null, 2)}
Replacement sentences that must not leak into client-facing text:
${JSON.stringify(CLIENT_VISIBLE_REPLACEMENT_SENTENCES)}

Compact report JSON, with geo.evidence intentionally omitted:
${JSON.stringify(compactReport(report))}`
}

export async function runQualityCritic(args: {
  ctx: AuditExecutionContext
  report: ClearSignalReport
  onUsage?: (event: CostEvent) => void
}): Promise<QualityCriticResult> {
  return runAuditStage(
    args.ctx,
    'quality_critic',
    () => runQualityCriticPass({
      report: args.report,
      attempt: args.ctx.attempt,
      onUsage: args.onUsage,
      meta: {
        auditId: args.ctx.auditId,
        stage: 'quality_critic',
        trigger: args.ctx.trigger,
        recoveryAttempt: args.ctx.attempt,
        workerId: args.ctx.workerId,
        endpoint: args.ctx.endpoint,
      },
    }),
    (stored) => {
      const result = stored as QualityCriticResult
      return {
        ...result,
        issues: AuditIssuesSchema.parse({ issues: result.issues || [] }).issues,
      }
    }
  )
}

export async function runQualityCriticPass(args: {
  report: ClearSignalReport
  attempt?: number
  onUsage?: (event: CostEvent) => void
  meta?: {
    auditId?: string | null
    stage: string
    trigger?: string
    recoveryAttempt?: number | null
    workerId?: string
    endpoint?: string
  }
}): Promise<QualityCriticResult> {
  const output = await callClaudeJSON({
    model: MODEL_QUALITY_CRITIC,
    system: criticSystemPrompt(),
    user: criticUserPrompt(args.report),
    validate: (data) => AuditIssuesSchema.parse(data),
    maxTokens: 2048,
    purpose: 'quality:critic',
    onUsage: args.onUsage,
    meta: args.meta,
  })
  const issues = validateCriticIssues(args.report, output.issues)
  return {
    issues,
    model: MODEL_QUALITY_CRITIC,
    ranAt: new Date().toISOString(),
    attempt: args.attempt ?? 0,
    droppedIssues: output.issues.length - issues.length,
  }
}
