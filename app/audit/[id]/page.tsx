import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import type { ClearSignalReport } from '@/lib/schemas'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, ArrowLeft } from 'lucide-react'

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

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { pdf?: string }
}) {
  const { data: audit, error } = await supabaseAdmin
    .from('audits')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !audit || !audit.report) {
    notFound()
  }

  const report = audit.report as ClearSignalReport
  const isPdf = searchParams.pdf === 'true'

  return (
    <div className={`min-h-screen ${isPdf ? 'p-8' : ''}`}>
      {!isPdf && (
        <nav className="border-b print:hidden">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <span className="text-xl font-bold tracking-tight">ClearSignal</span>
            </div>
            <a href={`/api/audit/${params.id}/pdf`}>
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
          <Badge variant="secondary" className="mb-3">{report.meta.tier} audit</Badge>
          <h1 className="text-3xl font-bold mb-2">ClearSignal Audit Report</h1>
          <p className="text-muted-foreground">{report.meta.url}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Generated {new Date(report.meta.generated_at).toLocaleDateString()}
            {report.meta.icp_description && ` | ICP: ${report.meta.icp_description}`}
          </p>
        </div>

        {/* Executive Summary */}
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Executive Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="leading-relaxed">{report.action.executive_summary}</p>
          </CardContent>
        </Card>

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

        {/* AI Search */}
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

        {/* ========== ACTION BLOCK ========== */}
        <h2 className="text-2xl font-bold mb-4 mt-10">Action Plan</h2>

        {/* Top Fixes */}
        <div className="space-y-3 mb-8">
          {report.action.top_fixes.map((fix) => (
            <Card key={fix.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-muted-foreground w-6">#{fix.id}</span>
                    <h3 className="font-semibold">{fix.title}</h3>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ImpactBadge impact={fix.impact} />
                    <EffortBadge effort={fix.effort} />
                    <Badge variant="outline">{fix.category}</Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground ml-8">{fix.description}</p>
              </CardContent>
            </Card>
          ))}
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

        {/* Outreach Messages */}
        <h3 className="text-lg font-semibold mb-3">Rewritten Outreach Messages</h3>
        <div className="grid gap-4 mb-10">
          {report.action.outreach_messages.map((msg, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Badge variant="outline" className="mb-2">{msg.channel}</Badge>
                <div className="bg-muted rounded p-3 text-sm mb-2 whitespace-pre-wrap">{msg.message}</div>
                <p className="text-xs text-muted-foreground italic">{msg.note}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
