import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowDownRight, ArrowUpRight, Minus, Bell, FileSearch } from 'lucide-react'
import type { MonitoringAlert, MonitoringDelta, GeoEvidence } from '@/lib/schemas'

export interface MonitoringView {
  url: string
  brand: string
  status: string
  cadence: string
  lastRunAt: string | null
  current: {
    ai_visibility_score: number
    mention_rate: number
    share_of_voice: number
    citation_rate: number
  } | null
  delta: MonitoringDelta | null
  alerts: MonitoringAlert[]
  history: { date: string; score: number }[]
  competitorVisibility: { name: string; mention_rate: number }[]
  citedDomains: { domain: string; count: number }[]
  evidence: GeoEvidence[]
}

function visColor(score: number): string {
  if (score >= 60) return 'text-emerald-600'
  if (score >= 30) return 'text-amber-600'
  return 'text-red-600'
}

function DeltaPill({ value, suffix = '' }: { value: number; suffix?: string }) {
  const rounded = Math.round(value * 10) / 10
  if (rounded === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
        <Minus className="h-3 w-3" /> no change
      </span>
    )
  }
  const up = rounded > 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${up ? 'text-emerald-600' : 'text-red-600'}`}>
      <Icon className="h-3 w-3" />
      {up ? '+' : ''}
      {rounded}
      {suffix}
    </span>
  )
}

function alertStyle(level: string): string {
  if (level === 'down') return 'border-red-200 bg-red-50 text-red-800'
  if (level === 'up') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

export function MonitoringDashboard({ view }: { view: MonitoringView }) {
  const maxScore = Math.max(10, ...view.history.map((h) => h.score))

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <Badge variant="secondary" className="mb-3">Weekly AI Visibility Monitoring</Badge>
          <h1 className="text-3xl font-bold tracking-tight">{view.brand}</h1>
          <p className="text-slate-600 break-all mt-1">{view.url}</p>
        </div>
        <div className="text-right text-sm text-slate-500">
          <div className="capitalize">{view.cadence} - {view.status}</div>
          <div>Last checked: {view.lastRunAt ? new Date(view.lastRunAt).toLocaleDateString() : 'pending first run'}</div>
        </div>
      </div>

      {!view.current ? (
        <Card>
          <CardContent className="p-8 text-center text-slate-600">
            The first check is queued. Your AI visibility trend will appear here after the next run.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Score + deltas */}
          <div className="grid sm:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-5">
                <div className="text-xs text-slate-500 mb-1">AI Visibility Score</div>
                <div className={`text-5xl font-bold ${visColor(view.current.ai_visibility_score)}`}>
                  {view.current.ai_visibility_score}
                </div>
                {view.delta && !view.delta.is_first_run && (
                  <div className="mt-2"><DeltaPill value={view.delta.ai_visibility_score} /> vs last week</div>
                )}
              </CardContent>
            </Card>
            <Stat label="Mention rate" value={`${Math.round(view.current.mention_rate)}%`} delta={view.delta?.mention_rate} suffix="%" first={view.delta?.is_first_run} />
            <Stat label="Share of voice" value={`${Math.round(view.current.share_of_voice)}%`} delta={view.delta?.share_of_voice} suffix="%" first={view.delta?.is_first_run} />
            <Stat label="Citation rate" value={`${Math.round(view.current.citation_rate)}%`} delta={view.delta?.citation_rate} suffix="%" first={view.delta?.is_first_run} />
          </div>

          {/* Alerts */}
          {view.alerts.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="h-4 w-4" />
                <h2 className="font-semibold">This week&apos;s changes</h2>
              </div>
              <div className="space-y-2">
                {view.alerts.map((a, i) => (
                  <div key={i} className={`text-sm border rounded-md px-4 py-3 ${alertStyle(a.level)}`}>
                    {a.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trend */}
          {view.history.length > 1 && (
            <Card className="mb-8">
              <CardContent className="p-5">
                <div className="text-sm font-semibold mb-4">AI visibility trend</div>
                <div className="flex items-end gap-2 h-32">
                  {view.history.map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                      <div className="text-xs text-slate-500">{h.score}</div>
                      <div
                        className="w-full rounded-t bg-slate-900"
                        style={{ height: `${Math.max(4, (h.score / maxScore) * 100)}%` }}
                      />
                      <div className="text-[10px] text-slate-400">{h.date}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Competitor + cited changes */}
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold mb-3">Who AI recommends</h3>
                {view.competitorVisibility.length > 0 ? (
                  <div className="space-y-2">
                    {view.competitorVisibility.slice(0, 6).map((c, i) => {
                      const isNew = view.delta?.new_competitors.includes(c.name)
                      return (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span>{c.name}{isNew && <Badge className="ml-2 bg-amber-100 text-amber-800 border-amber-200">new</Badge>}</span>
                          <span className="font-mono text-slate-500">{Math.round(c.mention_rate)}%</span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No competitors detected.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold mb-3">Sources AI cites</h3>
                {view.citedDomains.length > 0 ? (
                  <div className="space-y-2">
                    {view.citedDomains.slice(0, 6).map((d, i) => {
                      const isNew = view.delta?.new_cited_domains.includes(d.domain)
                      return (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span>{d.domain}{isNew && <Badge className="ml-2 bg-amber-100 text-amber-800 border-amber-200">new</Badge>}</span>
                          <span className="font-mono text-slate-500">{d.count}x</span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No cited sources captured.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Latest evidence */}
          {view.evidence.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileSearch className="h-4 w-4" />
                <h2 className="font-semibold">Latest evidence</h2>
              </div>
              <div className="grid gap-3">
                {view.evidence.slice(0, 3).map((e, i) => {
                  const status = e.brand_cited ? 'Cited' : e.brand_mentioned ? 'Mentioned' : 'Not named'
                  const cls = e.brand_cited
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : e.brand_mentioned
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-red-100 text-red-800 border-red-200'
                  return (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="font-medium text-sm">{e.query}</div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline">{e.engine}</Badge>
                            <Badge className={cls}>{status}</Badge>
                          </div>
                        </div>
                        <blockquote className="border-l-2 border-slate-200 pl-3 text-xs text-slate-600 italic leading-relaxed">
                          {e.answer_excerpt}
                        </blockquote>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  delta,
  suffix,
  first,
}: {
  label: string
  value: string
  delta?: number
  suffix?: string
  first?: boolean
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs text-slate-500 mb-1">{label}</div>
        <div className="text-3xl font-bold">{value}</div>
        {delta != null && !first && (
          <div className="mt-2"><DeltaPill value={delta} suffix={suffix} /></div>
        )}
      </CardContent>
    </Card>
  )
}
