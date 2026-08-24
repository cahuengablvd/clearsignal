import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/tokens'
import { isAdminAuthenticated } from '@/lib/auth'
import type { ClearSignalReport } from '@/lib/schemas'
import { priorityForFix } from '@/lib/prioritization'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RoleExport } from '@/components/role-export'
import { CopyButton } from '@/components/copy-button'
import { footerText } from '@/lib/pdf-footer'
import { queryIntentLabel } from '@/lib/geo/query-taxonomy'
import { engineDisplayName } from '@/lib/geo/coverage'
import { buildGeoSummary } from '@/lib/geo'
import { recommendationStageLabel } from '@/lib/geo/recommendation-stages'
import { buildClientReport, validateClientReportProjection } from '@/lib/client-report'
import { AUDIT_PROCESS_LABEL, AUDIT_PRODUCT_LABEL } from '@/lib/audit-label'
import { ReviewerNote } from '@/components/reviewer-note'
import { Download, ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'

// Never cache this route. A report link is often opened while the audit is
// still running; without this, Vercel can cache the in-progress response (or a
// 404) and serve it even after the report is ready.
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const metadata: Metadata = {
  alternates: { canonical: null },
}

function clientSafeAnswerExcerpt(text: string): string {
  return text
    .replace(/^Here is a comprehensive guide[^]*?(?=Look for|When selecting|To find|Finding|For affordable|Storage services|Last-minute|$)/i, '')
    .replace(/#{1,4}\s*\d*\.?\s*Define Your Moving Needs First[\s\S]*?(?=#{1,4}\s*\d+\.|Look for|When selecting|$)/gi, '')
    .replace(/#{1,4}\s*[^\n]*(?:Best Places to Search|Key Steps to Identify Reliable|Key Factors to Evaluate)[\s\S]*?(?=#{1,4}\s*\d+\.|When selecting|Look for|$)/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim() || text
}

function AuditProcessing({ status }: { status?: string }) {
  const failed = status === 'failed'
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>
            {failed ? 'Audit could not be completed' : 'Your audit is being generated'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {failed ? (
            <p>
              Something went wrong while generating this report. Please reply to your
              confirmation email and we will re-run it for you.
            </p>
          ) : (
            <>
              <p>This usually takes 2-4 minutes. This page refreshes automatically.</p>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full w-1/3 bg-primary animate-pulse rounded-full" />
              </div>
            </>
          )}
          {!failed && (
            <script
              dangerouslySetInnerHTML={{
                __html: 'setTimeout(function(){location.reload()},15000)',
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-green-100 text-green-800 border-green-200',
  }
  return <Badge className={colors[severity] || ''}>{severity}</Badge>
}

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.min(100, (score / max) * 100)
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold w-8 text-right">{score}</span>
    </div>
  )
}

function humanizeValue(value?: string | null): string {
  if (!value) return 'Unknown'
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function yesNoUnknown(value?: string | null): string {
  if (!value || value === 'unknown') return 'Unknown'
  if (value === 'not_applicable') return 'Not applicable'
  return humanizeValue(value)
}

function ImpactBadge({ impact }: { impact: string }) {
  const colors: Record<string, string> = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
  }
  return <Badge className={colors[impact] || ''}>{impact} impact</Badge>
}

function EffortBadge({ effort }: { effort: string }) {
  const colors: Record<string, string> = {
    easy: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    hard: 'bg-red-100 text-red-800',
  }
  return <Badge className={colors[effort] || ''}>{effort}</Badge>
}

function FindingBadge({
  classification,
  status,
}: {
  classification: string
  status?: string
}) {
  const label =
    status === 'present'
      ? 'detected present'
      : status === 'absent'
        ? 'verified absent'
        : status === 'unknown'
          ? 'manual verification'
          : classification.replace('_', ' ')
  const colors: Record<string, string> = {
    present: 'bg-green-100 text-green-800 border-green-200',
    absent: 'bg-red-100 text-red-800 border-red-200',
    unknown: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    action: 'bg-slate-100 text-slate-800 border-slate-200',
  }
  if (status && colors[status]) return <Badge className={colors[status]}>{label}</Badge>
  const fallback: Record<string, string> = {
    detected: 'bg-green-100 text-green-800 border-green-200',
    likely: 'bg-blue-100 text-blue-800 border-blue-200',
    manual_verification: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    recommendation: 'bg-slate-100 text-slate-800 border-slate-200',
  }
  return <Badge className={fallback[classification] || ''}>{label}</Badge>
}

function PriorityBadge({ bucket }: { bucket: string }) {
  const colors: Record<string, string> = {
    'Do now': 'bg-green-100 text-green-800 border-green-200',
    'This month': 'bg-blue-100 text-blue-800 border-blue-200',
    Later: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    Optional: 'bg-slate-100 text-slate-800 border-slate-200',
  }
  return <Badge className={colors[bucket] || ''}>{bucket}</Badge>
}

function ConfidenceBadge({ level }: { level?: string }) {
  const label = level ? `${level} evidence` : 'expert hypothesis'
  const colors: Record<string, string> = {
    high: 'bg-green-100 text-green-800 border-green-200',
    medium: 'bg-blue-100 text-blue-800 border-blue-200',
    low: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  }
  return <Badge className={level ? colors[level] : 'bg-slate-100 text-slate-800 border-slate-200'}>{label}</Badge>
}

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { pdf?: string; token?: string }
}) {
  // Access control: the paid report is gated behind a signed token (in the
  // emailed link, and used by the PDF renderer) or an admin session.
  const hasAccess =
    verifyToken('audit', params.id, searchParams.token) || isAdminAuthenticated()
  if (!hasAccess) {
    notFound()
  }

  const { data: audit, error } = await supabaseAdmin
    .from('audits')
    .select('*')
    .eq('id', params.id)
    .single()

  // Genuinely invalid id (or DB error) -> real 404.
  if (error || !audit) {
    notFound()
  }

  // Valid link, but the audit is still running (or failed): show a waiting
  // state with HTTP 200 instead of a 404, so the link never appears broken.
  if (!audit.report) {
    return <AuditProcessing status={audit.audit_status as string} />
  }

  const report = buildClientReport(audit.report as ClearSignalReport)
  if (validateClientReportProjection(report).length > 0) {
    notFound()
  }
  const isPdf = searchParams.pdf === 'true'
  // `report_only` is the documented emergency presentation rollback: preserve
  // the recorded gate for reviewers, but render the pre-gate client surfaces.
  const reportOnly = report.geo?.coverage_gate?.passed === false && process.env.GEO_COVERAGE_GATE_MODE === 'report_only'
  const gatePresentationFailed = report.geo?.coverage_gate?.passed === false && !reportOnly
  // This only reconstructs the displayed narrative from the stored measurements;
  // the failed gate and all recorded data remain intact for reviewer diagnostics.
  const geoSummary = report.geo && reportOnly
    ? buildGeoSummary({
        brand: report.geo.brand,
        test_counts: report.geo.test_counts ?? {
          configured_queries: report.geo.queries_tested,
          configured_engines: report.geo.engines_tested.length,
          expected_combinations: report.geo.queries_tested * report.geo.engines_tested.length,
          successful_combinations: report.geo.evidence.length,
          failed_combinations: 0,
          skipped_combinations: 0,
        },
        mention_rate: report.geo.mention_rate,
        citation_rate: report.geo.citation_rate,
        ai_visibility_score: report.geo.ai_visibility_score,
        mentionedCombinations: report.geo.evidence.filter((e) => e.brand_mentioned).length,
        engines: report.geo.engines_tested,
        evidenceReused: report.geo.summary.includes('AI visibility evidence was reused from the previous completed scan'),
      })
    : report.geo?.summary
  const technicalEligibility = report.technical_eligibility || report.geo?.technical_eligibility

  return (
    <div className={isPdf ? 'audit-report p-8' : 'min-h-screen'}>
      {!isPdf && (
        <nav className="border-b print:hidden">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <span className="text-xl font-bold tracking-tight">ClearSignal</span>
            </div>
            <a
              href={`/api/audit/${params.id}/pdf${searchParams.token ? `?token=${searchParams.token}` : ''}`}
            >
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" /> Download PDF
              </Button>
            </a>
          </div>
        </nav>
      )}

      <div className={`max-w-4xl mx-auto ${isPdf ? '' : 'px-6 py-10'}`}>
        {/* Header */}
        <div className="mb-10">
          <Badge variant="secondary" className="mb-3">{AUDIT_PROCESS_LABEL}</Badge>
          <h1 className="text-3xl font-bold mb-2">{AUDIT_PRODUCT_LABEL}</h1>
          {report.meta.canonical_brand ? (
            <>
              <p className="text-lg font-semibold">{report.meta.canonical_brand}</p>
              <p className="text-muted-foreground">{report.meta.domain || report.meta.url}</p>
              {report.meta.alternative_brand_forms &&
                report.meta.alternative_brand_forms.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Also detected as: {report.meta.alternative_brand_forms.join(', ')}
                  </p>
                )}
            </>
          ) : (
            <p className="text-muted-foreground">{report.meta.url}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Generated {new Date(report.meta.generated_at).toLocaleDateString()}
            {report.meta.icp_description && ` | ICP: ${report.meta.icp_description}`}
          </p>
        </div>

        <ReviewerNote note={audit.reviewer_note as string | null} />

        {/* Executive Summary */}
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Executive Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="leading-relaxed">{report.action.executive_summary}</p>
          </CardContent>
        </Card>

        {(report.meta.business_context || report.meta.observed_business_context) && (
          <Card className="mb-8 border-emerald-200 bg-emerald-50/40">
            <CardHeader>
              <CardTitle className="text-lg">Business context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {report.meta.business_context && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">User-verified business context</h3>
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-muted-foreground">
                    <div><span className="font-medium text-foreground">Business model:</span> {humanizeValue(report.meta.business_context.business_model)}</div>
                    <div><span className="font-medium text-foreground">Conversion goal:</span> {humanizeValue(report.meta.business_context.primary_conversion_goal)}</div>
                    <div><span className="font-medium text-foreground">Purchase / booking availability:</span> {yesNoUnknown(report.meta.business_context.purchase_availability)}</div>
                    <div><span className="font-medium text-foreground">Shipping / service availability:</span> {yesNoUnknown(report.meta.business_context.ships_internationally)}</div>
                    <div><span className="font-medium text-foreground">Certificates / provenance / verification:</span> {yesNoUnknown(report.meta.business_context.provenance_or_authentication)}</div>
                    <div><span className="font-medium text-foreground">Markets/languages:</span> {report.meta.business_context.target_markets_languages || 'Not provided'}</div>
                    <div className="sm:col-span-2">
                      <span className="font-medium text-foreground">Verified facts supplied:</span>{' '}
                      {report.meta.business_context.verified_facts || 'None supplied'}
                    </div>
                  </div>
                </div>
              )}
              {report.meta.observed_business_context && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Observed business context</h3>
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-muted-foreground">
                    <div><span className="font-medium text-foreground">Business type:</span> {report.meta.observed_business_context.inferred_business_type || 'Not observed'}</div>
                    <div><span className="font-medium text-foreground">Primary conversion action:</span> {report.meta.observed_business_context.observed_primary_cta || 'Not observed'}</div>
                    <div><span className="font-medium text-foreground">Service category:</span> {report.meta.observed_business_context.observed_service_category || 'Not observed'}</div>
                    <div><span className="font-medium text-foreground">Observed locations:</span> {(report.meta.observed_business_context.observed_location || []).join(', ') || 'Not observed'}</div>
                    <div className="sm:col-span-2"><span className="font-medium text-foreground">Observed services:</span> {(report.meta.observed_business_context.observed_services || []).join(', ') || 'Not observed'}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {report.data_limitations && report.data_limitations.length > 0 && (
          <Card className="mb-8 border-blue-200 bg-blue-50/40">
            <CardHeader>
              <CardTitle className="text-lg">Data limitations</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                {report.data_limitations.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* ========== VERIFIED STRUCTURAL FINDINGS (deterministic) ========== */}
        {report.technical_findings && report.technical_findings.length > 0 && (
          <>
            <h2 className="text-2xl font-bold mb-1 mt-10">Verified signals</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Detected directly from the page - each with how it was checked and a confidence score.
            </p>
            <div className="grid gap-3 mb-8">
              {report.technical_findings.map((f) => {
                return (
                  <Card key={f.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div className="flex items-center gap-2">
                          {f.evidence_id && (
                            <span className="text-xs font-mono text-muted-foreground">{f.evidence_id}</span>
                          )}
                          <h3 className="font-semibold text-sm">{f.label}</h3>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <FindingBadge classification={f.classification} status={f.status} />
                          <span className="text-xs font-mono text-muted-foreground">{f.confidence}%</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{f.detail}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        <span className="font-medium">How checked:</span> {f.confidence_basis}
                      </p>
                      {f.evidence?.extracted_text && (
                        <blockquote className="mt-2 border-l-2 border-muted pl-3 text-xs italic text-muted-foreground">
                          {f.evidence.extracted_text}
                        </blockquote>
                      )}
                      {f.evidence && (
                        <details className="mt-3 text-xs">
                          <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                            Evidence details
                          </summary>
                          <dl className="mt-2 grid gap-1 rounded border bg-muted/40 p-3 text-muted-foreground">
                            <div className="break-all">
                              <dt className="inline font-medium text-foreground">URL: </dt>
                              <dd className="inline">{f.evidence.url}</dd>
                            </div>
                            <div>
                              <dt className="inline font-medium text-foreground">Checked: </dt>
                              <dd className="inline">{new Date(f.evidence.checked_at).toLocaleString()}</dd>
                            </div>
                            {f.evidence.html_snippet && (
                              <div>
                                <dt className="font-medium text-foreground">HTML snippet:</dt>
                                <dd>
                                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-background p-2">
                                    {f.evidence.html_snippet}
                                  </pre>
                                </dd>
                              </div>
                            )}
                          </dl>
                        </details>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </>
        )}

        {/* ========== TECHNICAL ELIGIBILITY GATE ========== */}
        {technicalEligibility && (
          <>
            <h2 className="text-2xl font-bold mb-1 mt-10">Technical AI eligibility</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Access checks run before downstream visibility recommendations. CDN or WAF behavior remains unconfirmed unless an explicit rule was observed.
            </p>
            <Card className="mb-6">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="font-semibold">Eligibility gate</h3>
                  <Badge variant="outline" className={
                    technicalEligibility.overall_status === 'eligible'
                      ? 'border-green-200 bg-green-50 text-green-800'
                      : technicalEligibility.overall_status === 'blocked'
                        ? 'border-red-200 bg-red-50 text-red-800'
                        : 'border-amber-200 bg-amber-50 text-amber-800'
                  }>
                    {technicalEligibility.overall_status}
                  </Badge>
                </div>
                <div className="grid gap-2">
                  {[...technicalEligibility.checks, ...technicalEligibility.crawler_access.map((item) => ({
                    id: `crawler-${item.crawler}`,
                    label: `${item.engine} crawler access`,
                    status: item.status,
                    detail: item.detail,
                    evidence: item.crawler,
                  }))].map((check) => (
                    <div key={check.id} className="flex items-start justify-between gap-4 border-b last:border-b-0 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium">{check.label}</div>
                        <div className="text-muted-foreground">{check.detail}</div>
                        {check.evidence && <div className="mt-1 break-all font-mono text-xs text-muted-foreground">{check.evidence}</div>}
                      </div>
                      <Badge variant="outline" className="shrink-0">{check.status}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ========== GEO / AI VISIBILITY BLOCK ========== */}
        {report.geo && (
          <>
            <h2 className="text-2xl font-bold mb-4 mt-10">AI Visibility (GEO / AEO)</h2>
            {!gatePresentationFailed ? <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold">{report.geo.ai_visibility_score}</div>
                  <div className="text-xs text-muted-foreground mt-1">AI Visibility / 100</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold">{Math.round(report.geo.mention_rate)}%</div>
                  <div className="text-xs text-muted-foreground mt-1">Mention rate</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold">{Math.round(report.geo.share_of_voice)}%</div>
                  <div className="text-xs text-muted-foreground mt-1">Share of voice</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold">
                    {report.geo.test_counts?.successful_combinations ?? report.geo.evidence.length}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Successful combinations</div>
                </CardContent>
              </Card>
            </div> : <Card className="mb-6 border-amber-300 bg-amber-50"><CardContent className="p-5"><p className="font-medium">Measurement coverage was insufficient</p><p className="text-sm text-muted-foreground mt-1">{report.geo.coverage_gate?.reasons.join('; ')}</p><p className="text-sm text-muted-foreground mt-1">No AI visibility index or pooled percentages are reported for this scan; only the counts below and the individual answers further down.</p><div className="mt-3 text-sm">{report.geo.engine_coverage?.map((e) => <p key={e.engine}>{engineDisplayName(e.engine)}: {e.successful_samples}/{e.expected_samples} answers received.</p>)}</div></CardContent></Card>}

            <Card className="mb-6 border-primary/20 bg-primary/5">
              <CardContent className="p-5">
                <p className="text-sm leading-relaxed">{geoSummary}</p>
                <p className="text-xs text-muted-foreground mt-3">
                  Engines tested: {report.geo.engines_tested.join(', ')}
                </p>
                {!gatePresentationFailed && <p className="text-xs text-muted-foreground mt-1">
                  Visibility is specific to this tested query set; different buyer questions can produce different results.
                </p>}
                {report.geo.test_counts && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Queries configured: {report.geo.test_counts.configured_queries}. Engines configured:{' '}
                    {report.geo.test_counts.configured_engines}. Expected combinations:{' '}
                    {report.geo.test_counts.expected_combinations}. Successfully tested:{' '}
                    {report.geo.test_counts.successful_combinations}. Failed or skipped:{' '}
                    {report.geo.test_counts.failed_combinations + report.geo.test_counts.skipped_combinations}.
                  </p>
                )}
                {!gatePresentationFailed && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Score = {Math.round(report.geo.score_breakdown.weights.mention * 100)}%
                    mention-rate ({Math.round(report.geo.mention_rate)}) +{' '}
                    {Math.round(report.geo.score_breakdown.weights.citation * 100)}% citation-rate (
                    {report.geo.citation_rate == null ? 'n/a' : Math.round(report.geo.citation_rate)}) +{' '}
                    {Math.round(report.geo.score_breakdown.weights.position * 100)}% position +{' '}
                    {Math.round(report.geo.score_breakdown.weights.share_of_voice * 100)}% share-of-voice.
                    Measured deterministically from the answers below
                    {report.geo.avg_position != null
                      ? `; avg. position when named: ${report.geo.avg_position}`
                      : ''}
                    .
                  </p>
                )}
              </CardContent>
            </Card>
            {report.geo.engine_coverage?.length ? <Card className="mb-6"><CardContent className="p-5"><h3 className="font-semibold mb-2">Measurement coverage by engine</h3><div className="space-y-1 text-sm text-muted-foreground">{report.geo.engine_coverage.map((engine) => <p key={engine.engine}>{engineDisplayName(engine.engine)}: {engine.successful_samples}/{engine.expected_samples} answers received; {engine.grounded_samples} grounded; {engine.no_citation_samples} without citations; {engine.tool_failure_samples + engine.provider_error_samples + engine.timeout_samples} failed.</p>)}</div>{report.geo.observed_at && <p className="mt-2 text-xs text-muted-foreground">Evidence observed {report.geo.observed_at.slice(0, 10)}.</p>}</CardContent></Card> : null}

            {!gatePresentationFailed && report.geo.query_analysis && report.geo.query_analysis.coverage.length > 0 && (
              <Card className="mb-6">
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-1">Visibility by buyer intent</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    The same tested queries are grouped deterministically; no additional AI calls are used.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {report.geo.query_analysis.coverage.map((item) => (
                      <div key={item.intent} className="rounded border p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{queryIntentLabel(item.intent)}</span>
                          <span className="text-xs text-muted-foreground">{item.query_count} {item.query_count === 1 ? 'query' : 'queries'}</span>
                        </div>
                        <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                          <span>Mentioned: {Math.round(item.mention_rate)}%</span>
                          <span>Cited: {Math.round(item.citation_rate)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {report.geo.query_provenance?.filter((item) => item.scope === 'core' && item.state === 'valid').length ? (
              <Card className="mb-6"><CardContent className="p-5"><h3 className="font-semibold mb-2">Why these questions were tested</h3><div className="space-y-3 text-sm">{report.geo.query_provenance.filter((item) => item.scope === 'core' && item.state === 'valid').map((item) => <div key={item.query_id} className="border-b pb-2 last:border-0"><p className="font-medium">{item.query}</p><p className="text-xs text-muted-foreground">Buyer situation: {queryIntentLabel(item.intent)} · Language: {item.language}{item.market ? ` · Market: ${item.market}` : ''}{item.rationale ? ` · ${item.rationale}` : ''}</p></div>)}</div>{report.geo.query_plan && report.geo.query_plan.valid_core_slots < 6 ? <p className="mt-3 text-sm text-muted-foreground">{6 - report.geo.query_plan.valid_core_slots} of 6 buyer situations could not be tested validly.</p> : null}</CardContent></Card>
            ) : null}
            {report.geo.supplemental_probes?.length ? <Card className="mb-6"><CardContent className="p-5"><h3 className="font-semibold mb-2">Secondary-language probe — not included in the index</h3><div className="space-y-2 text-sm">{report.geo.supplemental_probes.map((probe) => <div key={probe.query_id}><p className="font-medium">{probe.query}</p><p className="text-xs text-muted-foreground">{probe.per_engine.map((row) => `${engineDisplayName(row.engine)}: ${row.mentioned} named, ${row.cited} cited in ${row.successful} answers`).join(' · ')}</p></div>)}</div></CardContent></Card> : null}

            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              {!gatePresentationFailed && report.geo.competitor_visibility.length > 0 && (
                <Card>
                  <CardContent className="p-5">
                    <h3 className="font-semibold mb-3">Who AI recommends instead</h3>
                    <div className="space-y-2">
                      {report.geo.competitor_visibility.slice(0, 6).map((c, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span>{c.name}</span>
                          <span className="font-mono text-muted-foreground">
                            {Math.round(c.mention_rate)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {report.geo.cited_domains_ranked.length > 0 && (
                <Card>
                  <CardContent className="p-5">
                    <h3 className="font-semibold mb-3">Sources AI cites most</h3>
                    <div className="space-y-2">
                      {report.geo.cited_domains_ranked.slice(0, 6).map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="truncate max-w-[14rem]">{d.domain}</span>
                          <span className="font-mono text-muted-foreground">{d.count}x</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {report.geo.missing_signals.length > 0 && (
              <Card className="mb-6 border-red-200 bg-red-50/50">
                <CardContent className="p-5">
                  <h3 className="font-semibold text-red-800 mb-2">
                    Potential factors limiting AI visibility
                  </h3>
                  <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                    {report.geo.missing_signals.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {(report.geo.staged_recommendations?.length || report.geo.recommendations.length > 0) && (
              <Card className="mb-8 border-green-200 bg-green-50/50">
                <CardContent className="p-5">
                  <h3 className="font-semibold text-green-800 mb-2">
                    Actions that may improve citation potential
                  </h3>
                  <div className="grid gap-2">
                    {(report.geo.staged_recommendations || report.geo.recommendations.map((action) => ({
                      stage: 'RETRIEVAL' as const,
                      action,
                      depends_on_access: false,
                    }))).map((item, i) => (
                      <div key={`${item.stage}-${i}`} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline" className="shrink-0 bg-white">{recommendationStageLabel(item.stage)}</Badge>
                        <div>
                          <p>{item.action}</p>
                          {item.depends_on_access && (
                            <p className="mt-1 text-xs text-amber-800">Depends on resolving or confirming the access gate first.</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {report.geo.source_gap_analysis && report.geo.source_gap_analysis.length > 0 && (
              <>
                <h3 className="text-lg font-semibold mb-1">Observed characteristics of cited sources</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  These pages appeared as citations in the tested answers. The comparison shows observed page characteristics; it does not prove why an engine cited them.
                </p>
                <div className="grid gap-3 mb-8">
                  {report.geo.source_gap_analysis.map((s, i) => (
                    <Card key={i}>
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <h4 className="font-semibold">{s.cited_source}</h4>
                          <Badge variant="outline">cited source</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{s.why_this_source_gets_cited}</p>
                        {s.signals_found.length > 0 && (
                          <div className="mb-3">
                            <div className="text-xs font-medium mb-1">Observed on this cited source:</div>
                            <div className="flex flex-wrap gap-1.5">
                              {s.signals_found.map((sig, j) => (
                                <span key={j} className="text-xs border rounded-full px-2 py-0.5 bg-muted text-muted-foreground">
                                  {sig}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {s.target_missing_signals.length > 0 && (
                          <div className="mb-3">
                            <div className="text-xs font-medium text-red-700 mb-1">Comparable signals not found on your page:</div>
                            <div className="flex flex-wrap gap-1.5">
                              {s.target_missing_signals.map((sig, j) => (
                                <span key={j} className="text-xs border border-red-200 rounded-full px-2 py-0.5 bg-red-50 text-red-700">
                                  {sig}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="text-sm bg-green-50 border border-green-200 rounded p-3">
                          <span className="font-medium text-green-800">Fix:</span>{' '}
                          <span className="text-green-900">{s.recommended_fix}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}

            {report.geo.evidence.length > 0 && (
              <>
                <h3 className="text-lg font-semibold mb-1">Evidence: what the engines actually said</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Every status above is detected directly from these answers - no guesswork.
                </p>
                <div className="grid gap-3 mb-8">
                  {report.geo.evidence.map((e, i) => {
                    const status = e.brand_cited
                      ? { label: 'Cited', cls: 'bg-green-100 text-green-800 border-green-200' }
                      : e.brand_mentioned
                        ? { label: 'Mentioned', cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' }
                        : { label: 'Not named', cls: 'bg-red-100 text-red-800 border-red-200' }
                    return (
                      <Card key={i}>
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="font-medium text-sm">{e.query}</div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="outline">{e.engine}</Badge>
                              <Badge className={status.cls}>{status.label}</Badge>
                            </div>
                          </div>
                          <blockquote className="border-l-2 border-muted pl-3 text-sm text-muted-foreground italic leading-relaxed mb-3">
                            {clientSafeAnswerExcerpt(e.answer_excerpt)}
                          </blockquote>
                          <p className="text-xs text-muted-foreground mb-2">
                            AI-reported answer; not independently verified by ClearSignal.
                          </p>
                          {e.status === 'ok_no_citations' && (
                            <p className="text-xs text-muted-foreground mb-2">
                              Answered without citations (the engine did not ground this answer in web sources).
                            </p>
                          )}
                          {(e.excerpt_offset ?? 0) > 0 && (
                            <p className="text-xs text-muted-foreground mb-2">
                              Opening narration was omitted from this excerpt; the full raw answer is stored unchanged.
                            </p>
                          )}
                          {!isPdf && e.answer_text && (
                            <details className="mb-2 text-xs text-muted-foreground print:hidden">
                              <summary className="cursor-pointer">Show the full stored answer</summary>
                              <pre className="whitespace-pre-wrap font-sans mt-2">{e.answer_text}</pre>
                            </details>
                          )}
                          <div className="text-xs text-muted-foreground space-y-1">
                            {e.competitors_mentioned.length > 0 && (
                              <div>
                                <span className="font-medium">AI named:</span>{' '}
                                {e.competitors_mentioned.join(', ')}
                              </div>
                            )}
                            {e.cited_domains.length > 0 && (
                              <div>
                                <span className="font-medium">Sources cited:</span>{' '}
                                {e.cited_domains.slice(0, 6).join(', ')}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* ========== CLARITY BLOCK ========== */}
        <h2 className="text-2xl font-bold mb-4 mt-10">Messaging Clarity</h2>
        <div className="mb-4">
          <div className="text-sm text-muted-foreground mb-1">Overall Clarity Score</div>
          <ScoreBar score={report.clarity.overall_score} />
        </div>

        <div className="grid gap-4 mb-8">
          {/* ICP Visibility */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">ICP Visibility</h3>
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={report.clarity.icp_visibility.severity} />
                  <span className="text-sm font-mono">{report.clarity.icp_visibility.score}/100</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{report.clarity.icp_visibility.finding}</p>
            </CardContent>
          </Card>

          {/* Headline */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Headline</h3>
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={report.clarity.headline.severity} />
                  <span className="text-sm font-mono">{report.clarity.headline.score}/100</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{report.clarity.headline.finding}</p>
              <div className="bg-muted rounded p-3 space-y-2 text-sm">
                <div><span className="font-medium">Current:</span> {report.clarity.headline.current_headline}</div>
                <div><span className="font-medium text-green-700">Suggested:</span> {report.clarity.headline.suggested_rewrite}</div>
              </div>
            </CardContent>
          </Card>

          {/* CTA */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">CTA</h3>
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={report.clarity.cta.severity} />
                  <span className="text-sm font-mono">{report.clarity.cta.score}/100</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{report.clarity.cta.finding}</p>
              <div className="bg-muted rounded p-3 text-sm">
                <span className="font-medium text-green-700">Suggested:</span> {report.clarity.cta.suggested_rewrite}
              </div>
            </CardContent>
          </Card>

          {/* Trust Proof */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Trust & Proof</h3>
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={report.clarity.trust_proof.severity} />
                  <span className="text-sm font-mono">{report.clarity.trust_proof.score}/100</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{report.clarity.trust_proof.finding}</p>
              {report.clarity.trust_proof.missing_elements.length > 0 && (
                <div className="text-sm">
                  <span className="font-medium">Missing:</span>
                  <ul className="list-disc list-inside mt-1 text-muted-foreground">
                    {report.clarity.trust_proof.missing_elements.map((el, i) => (
                      <li key={i}>{el}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Messaging Fit */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Messaging Fit</h3>
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={report.clarity.messaging_fit.severity} />
                  <span className="text-sm font-mono">{report.clarity.messaging_fit.score}/100</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{report.clarity.messaging_fit.finding}</p>
            </CardContent>
          </Card>
        </div>

        {/* ========== GAP BLOCK ========== */}
        <h2 className="text-2xl font-bold mb-4 mt-10">Competitive Gap Analysis</h2>

        {/* Competitors */}
        {report.gap.competitor_analysis.length > 0 && (
          <div className="grid gap-4 mb-6">
            {report.gap.competitor_analysis.map((comp, i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm truncate max-w-xs">{comp.url}</h3>
                    <span className="text-sm font-mono">{comp.clarity_score}/100</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3 italic">&ldquo;{comp.headline}&rdquo;</p>
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-green-700">Strengths</span>
                      <ul className="list-disc list-inside mt-1 text-muted-foreground">
                        {comp.strengths.map((s, j) => <li key={j}>{s}</li>)}
                      </ul>
                    </div>
                    <div>
                      <span className="font-medium text-red-700">Weaknesses</span>
                      <ul className="list-disc list-inside mt-1 text-muted-foreground">
                        {comp.weaknesses.map((w, j) => <li key={j}>{w}</li>)}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="p-5">
              <h3 className="font-semibold text-red-800 mb-2">Where you lose</h3>
              <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                {report.gap.where_you_lose.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="p-5">
              <h3 className="font-semibold text-green-800 mb-2">Where you win</h3>
              <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                {report.gap.where_you_win.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </CardContent>
          </Card>
        </div>

        {!report.geo && (
          <Card className="mb-8">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">AI-Search Visibility</h3>
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={report.gap.ai_search.severity} />
                  <span className="text-sm font-mono">{report.gap.ai_search.score}/100</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{report.gap.ai_search.finding}</p>
              <p className="text-sm mb-2">
                Likely to be cited: <strong>{report.gap.ai_search.is_likely_cited ? 'Yes' : 'No'}</strong>
              </p>
              {report.gap.ai_search.missing_signals.length > 0 && (
                <div className="text-sm">
                  <span className="font-medium">Missing signals:</span>
                  <ul className="list-disc list-inside mt-1 text-muted-foreground">
                    {report.gap.ai_search.missing_signals.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ========== ACTION BLOCK ========== */}
        <h2 className="text-2xl font-bold mb-4 mt-10">Action Plan</h2>

        {/* Top Fixes */}
        <div className="space-y-3 mb-8">
          {report.action.top_fixes.map((fix) => {
            const priority = priorityForFix(fix)
            return (
              <Card key={fix.id}>
                <CardContent className="p-5">
                  <div className="mb-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="text-sm font-mono text-muted-foreground w-6 shrink-0">#{fix.id}</span>
                      <h3 className="font-semibold leading-snug min-w-0 break-words">{fix.title}</h3>
                    </div>
                    <div className="mt-2 ml-8 flex flex-wrap items-center gap-2">
                      <PriorityBadge bucket={priority.bucket} />
                      <ConfidenceBadge level={fix.confidence_level} />
                      {fix.claim_level && <Badge variant="outline">{fix.claim_level}</Badge>}
                      <ImpactBadge impact={fix.impact} />
                      <EffortBadge effort={fix.effort} />
                      <Badge variant="outline">{fix.category}</Badge>
                      {fix.recommendation_stage && <Badge variant="outline">{recommendationStageLabel(fix.recommendation_stage)}</Badge>}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground ml-8">{fix.description}</p>
                  {fix.depends_on_access && (
                    <p className="mt-2 ml-8 text-xs text-amber-800">
                      Dependency: resolve or confirm the technical access gate before relying on this recommendation.
                    </p>
                  )}
                  {(fix.owner || fix.contributor || fix.implementer) && (
                    <p className="mt-2 ml-8 text-xs text-muted-foreground">
                      {fix.owner && <>Owner: {fix.owner}</>}
                      {fix.owner && (fix.contributor || fix.implementer) && <span className="mx-1">&middot;</span>}
                      {fix.contributor && <>Contributor: {fix.contributor}</>}
                      {fix.contributor && fix.implementer && <span className="mx-1">&middot;</span>}
                      {fix.implementer && <>Implementer: {fix.implementer}</>}
                    </p>
                  )}
                  <p className="mt-2 ml-8 text-xs text-muted-foreground">
                    Priority score: <span className="font-mono">{priority.score}</span> ({priority.formula}
                    {typeof fix.confidence === 'number' ? `; evidence confidence ${fix.confidence}%` : '; expert hypothesis'}).
                    {fix.control && ` Control: ${fix.control}.`}
                    {fix.probability && ` Probability: ${fix.probability}.`}
                  </p>
                  {fix.confidence_basis && (
                    <p className="mt-1 ml-8 text-xs text-muted-foreground">
                      Evidence basis: {fix.confidence_basis}
                    </p>
                  )}
                  {fix.evidence_basis && (
                    <p className="mt-1 ml-8 text-xs font-mono text-muted-foreground">
                      {fix.evidence_basis}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Ship First / Ignore */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="p-5">
              <h3 className="font-semibold text-green-800 mb-2">Ship first</h3>
              <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                {report.action.ship_first.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </CardContent>
          </Card>
          <Card className="border-muted">
            <CardContent className="p-5">
              <h3 className="font-semibold text-muted-foreground mb-2">Ignore for now</h3>
              <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                {report.action.ignore_for_now.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Hand off by role */}
        <h3 className="text-lg font-semibold mb-1">Hand off by role</h3>
        <p className="text-sm text-muted-foreground mb-3">
          The fixes above, grouped by who should do them - copy a task list straight to the right person.
        </p>
        <div className="mb-10">
          <RoleExport
            label={report.meta.url}
            fixes={report.action.top_fixes.map((f) => ({
              title: f.title,
              description: f.description,
              category: f.category,
            }))}
          />
        </div>

        {/* Implementation briefs */}
        {report.implementation_briefs && report.implementation_briefs.length > 0 && (
          <>
            <h2 className="text-2xl font-bold mb-1 mt-10">Implementation briefs</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Each top fix as a ticket - concrete steps and acceptance criteria you can check off.
            </p>
            <div className="grid gap-3 mb-10">
              {report.implementation_briefs.map((b, i) => (
                <Card key={i}>
                  <CardContent className="p-5">
                    <h3 className="font-semibold mb-3">{b.fix_title}</h3>
                    {b.steps.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Steps</div>
                        <ol className="list-decimal list-inside text-sm space-y-1 text-muted-foreground">
                          {b.steps.map((s, j) => <li key={j}>{s}</li>)}
                        </ol>
                      </div>
                    )}
                    {b.acceptance_criteria.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Acceptance criteria</div>
                        <ul className="text-sm space-y-1">
                          {b.acceptance_criteria.map((c, j) => (
                            <li key={j} className="flex gap-2">
                              <span className="text-green-600">&#9744;</span>
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Ready-to-ship materials */}
        {report.ready_materials && (
          <>
            <h2 className="text-2xl font-bold mb-1 mt-10">Draft copy for your review</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Review these meta tags, FAQ, JSON-LD and CTA options before publishing.
            </p>
            <div className="grid gap-3 mb-10">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <h3 className="font-semibold text-sm">Meta title</h3>
                    <CopyButton text={report.ready_materials.meta_title} />
                  </div>
                  <p className="text-sm text-muted-foreground">{report.ready_materials.meta_title}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <h3 className="font-semibold text-sm">Meta description</h3>
                    <CopyButton text={report.ready_materials.meta_description} />
                  </div>
                  <p className="text-sm text-muted-foreground">{report.ready_materials.meta_description}</p>
                </CardContent>
              </Card>

              {report.ready_materials.faq.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h3 className="font-semibold text-sm">FAQ ({report.ready_materials.faq.length})</h3>
                      <CopyButton
                        label="Copy all"
                        text={report.ready_materials.faq.map((f) => `${f.question}\n${f.answer}`).join('\n\n')}
                      />
                    </div>
                    <div className="space-y-3">
                      {report.ready_materials.faq.map((f, i) => (
                        <div key={i}>
                          <p className="text-sm font-medium">{f.question}</p>
                          <p className="text-sm text-muted-foreground">{f.answer}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {report.ready_materials.cta_variants.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-sm mb-2">CTA variants</h3>
                    <div className="space-y-2">
                      {report.ready_materials.cta_variants.map((c, i) => (
                        <div key={i} className="flex items-center justify-between gap-3">
                          <span className="text-sm text-muted-foreground">{c}</span>
                          <CopyButton text={c} />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-sm">Schema.org JSON-LD</h3>
                    <CopyButton text={report.ready_materials.json_ld} />
                  </div>
                  <p className="mb-1 text-xs text-muted-foreground">
                    Ask your developer, or use the structured-data/SEO field in WordPress or Wix, to add this <code>&lt;script type="application/ld+json"&gt;</code> block inside the page&apos;s <code>&lt;head&gt;</code>. Use one block per page.
                  </p>
                  <p className="mb-3 text-xs text-muted-foreground">
                    After publishing, verify the page with the{' '}
                    <a href="https://search.google.com/test/rich-results" target="_blank" rel="noopener noreferrer" className="underline">
                      Google Rich Results Test
                    </a>.
                  </p>
                  <pre className="pdf-code text-xs bg-muted rounded p-3 overflow-x-auto whitespace-pre-wrap">
                    {report.ready_materials.json_ld}
                  </pre>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {!isPdf && (
          <footer className="mt-6 border-t pt-3 text-[10px] leading-relaxed text-muted-foreground">
            {footerText(new Date(report.meta.generated_at), report.meta)}
          </footer>
        )}
      </div>
    </div>
  )
}
