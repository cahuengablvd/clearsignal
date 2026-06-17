import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { signToken } from '@/lib/tokens'
import type { GeoEvidence, GeoResult } from '@/lib/schemas'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle,
  CircleAlert,
  ExternalLink,
  FileSearch,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
} from 'lucide-react'

const dimensions = ['icp', 'headline', 'cta', 'trust', 'ai_search'] as const

const dimensionLabels: Record<(typeof dimensions)[number], string> = {
  icp: 'ICP clarity',
  headline: 'Headline strength',
  cta: 'CTA effectiveness',
  trust: 'Trust & proof',
  ai_search: 'AI-search readiness',
}

function scoreColor(score: number): string {
  if (score >= 7) return 'text-emerald-600'
  if (score >= 4) return 'text-amber-600'
  return 'text-red-600'
}

function scoreBg(score: number): string {
  if (score >= 7) return 'bg-emerald-50 border-emerald-200'
  if (score >= 4) return 'bg-amber-50 border-amber-200'
  return 'bg-red-50 border-red-200'
}

function visColor(score: number): string {
  if (score >= 60) return 'text-emerald-600'
  if (score >= 30) return 'text-amber-600'
  return 'text-red-600'
}

function visBg(score: number): string {
  if (score >= 60) return 'bg-emerald-50 border-emerald-200'
  if (score >= 30) return 'bg-amber-50 border-amber-200'
  return 'bg-red-50 border-red-200'
}

function queryStatus(query: GeoEvidence) {
  if (query.brand_cited) {
    return {
      label: 'Cited',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      icon: CheckCircle,
    }
  }
  if (query.brand_mentioned) {
    return {
      label: 'Mentioned',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
      icon: CircleAlert,
    }
  }
  return {
    label: 'Not named',
    className: 'border-red-200 bg-red-50 text-red-700',
    icon: ShieldAlert,
  }
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

export default async function ScoreResultPage({ params }: { params: { id: string } }) {
  const { data: score, error } = await supabaseAdmin
    .from('scores')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !score) {
    notFound()
  }

  const scores = score.scores as Record<string, number | string | GeoResult | null>
  const geo = scores.geo as GeoResult | null | undefined
  const scoreToken = signToken('score', score.id)
  const checkoutHref = `/checkout?score_id=${score.id}&token=${scoreToken}`
  const avg = Math.round(
    dimensions.reduce((sum, d) => sum + (Number(scores[d]) || 0), 0) / dimensions.length
  )

  const testedQueries = geo?.evidence?.slice(0, 4) ?? []
  const competitors = geo ? geo.competitor_visibility.slice(0, 6) : []
  const citedDomains = geo
    ? geo.cited_domains_ranked.slice(0, 6)
    : []
  const missingSignals = geo?.missing_signals.slice(0, 4) ?? []
  const recommendations = geo?.recommendations.slice(0, 4) ?? []
  const sourceGaps = geo?.source_gap_analysis?.slice(0, 2) ?? []

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <nav className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/score" className="text-slate-500 hover:text-slate-950">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link href="/" className="text-xl font-bold tracking-tight">ClearSignal</Link>
          </div>
          <Link href={checkoutHref}>
            <Button size="sm" className="gap-2">
              Unlock full audit <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-8 items-start">
          <section>
            <Badge variant="secondary" className="mb-4">Free AI Visibility Score</Badge>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
              Your AI visibility mini-report
            </h1>
            <p className="mt-4 text-slate-600 break-all">{score.url}</p>
            <p className="mt-4 text-lg text-slate-600 leading-relaxed">
              This free scan checks whether answer engines name your brand when buyers ask
              category-level questions. The full audit expands the query set, competitor analysis,
              and fix list.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <Link href={checkoutHref}>
                <Button size="lg" className="gap-2">
                  Unlock the full audit <Sparkles className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/sample">
                <Button variant="outline" size="lg">
                  View sample report
                </Button>
              </Link>
            </div>
          </section>

          <section className={`border rounded-lg p-6 ${geo ? visBg(geo.ai_visibility_score) : scoreBg(avg)}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-600">
                  {geo ? 'AI Visibility Score' : 'Overall messaging score'}
                </div>
                <div className={`text-7xl font-bold tracking-tight mt-2 ${geo ? visColor(geo.ai_visibility_score) : scoreColor(avg)}`}>
                  {geo ? geo.ai_visibility_score : avg}
                </div>
                <div className="text-sm text-slate-600 mt-1">
                  {geo ? 'out of 100' : 'out of 10'}
                </div>
              </div>
              <div className="text-right">
                <Badge className="bg-white/70 text-slate-700 border-slate-200">
                  {geo ? `${geo.engines_tested.join(', ')}` : 'Heuristic scan'}
                </Badge>
              </div>
            </div>

            {geo ? (
              <div className="grid grid-cols-3 gap-3 mt-6">
                <Metric label="Mention rate" value={`${Math.round(geo.mention_rate)}%`} />
                <Metric label="Share of voice" value={`${Math.round(geo.share_of_voice)}%`} />
                <Metric label="Queries tested" value={String(geo.queries_tested)} />
              </div>
            ) : (
              <p className="mt-6 text-sm text-slate-600">
                Live GEO data was unavailable for this run, so this result uses the messaging clarity scan.
              </p>
            )}
          </section>
        </div>

        {geo && (
          <>
            {geo.summary && (
              <Card className="mt-8 border-slate-200 bg-slate-50">
                <CardContent className="p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                    What answer engines saw
                  </div>
                  <p className="leading-relaxed text-slate-700">{geo.summary}</p>
                </CardContent>
              </Card>
            )}

            <section className="mt-8">
              <div className="flex items-end justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-2xl font-bold">Buyer questions tested</h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Each row shows one answer-engine probe and whether your brand appeared.
                  </p>
                </div>
                <Badge variant="outline">{geo.evidence.length} engine results</Badge>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="hidden md:grid grid-cols-[1fr_8rem_1fr_9rem] gap-4 bg-slate-50 border-b px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <div>Buyer question</div>
                  <div>Engine</div>
                  <div>Who AI named / cited</div>
                  <div className="text-right">Your status</div>
                </div>
                <div className="divide-y">
                  {testedQueries.map((query) => (
                    <QueryRow key={`${query.engine}-${query.query}`} query={query} />
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-8 grid lg:grid-cols-3 gap-4">
              <InsightCard
                icon={BarChart3}
                title="Competitors AI mentioned"
                empty="No competitors were detected in the sampled answers."
                items={competitors.map((c) => ({ label: c.name, value: `${Math.round(c.mention_rate)}%` }))}
              />
              <InsightCard
                icon={ExternalLink}
                title="Sources AI cited"
                empty="No cited domains were captured in this free scan."
                items={citedDomains.map((d) => ({ label: d.domain, value: `${d.count}x` }))}
              />
              <InsightCard
                icon={CircleAlert}
                title="Likely citation gaps"
                empty="No missing signals were detected."
                items={missingSignals.map((label) => ({ label }))}
                tone="risk"
              />
            </section>

            {recommendations.length > 0 && (
              <section className="mt-8 border rounded-lg p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="h-5 w-5" />
                  <h2 className="text-xl font-bold">What to fix first</h2>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {recommendations.map((rec, index) => (
                    <div key={rec} className="border rounded-lg p-4 bg-slate-50">
                      <div className="text-xs font-semibold text-slate-500 mb-2">Fix #{index + 1}</div>
                      <p className="text-sm text-slate-700 leading-relaxed">{rec}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {sourceGaps.length > 0 && (
              <section className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                  <FileSearch className="h-5 w-5" />
                  <h2 className="text-xl font-bold">Why AI cites them, not you</h2>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {sourceGaps.map((s) => (
                    <div key={s.cited_source} className="border rounded-lg p-4">
                      <div className="font-semibold text-sm mb-1">{s.cited_source}</div>
                      <p className="text-xs text-slate-600 mb-2 leading-relaxed">{s.why_this_source_gets_cited}</p>
                      {s.target_missing_signals.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {s.target_missing_signals.map((sig) => (
                            <span key={sig} className="text-xs border border-red-200 rounded-full px-2 py-0.5 bg-red-50 text-red-700">
                              {sig}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <section className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-5 w-5" />
            <h2 className="text-xl font-bold">Messaging clarity scan</h2>
          </div>
          <div className="grid md:grid-cols-5 gap-3">
            {dimensions.map((dim) => {
              const val = Number(scores[dim]) || 0
              return (
                <Card key={dim} className={scoreBg(val)}>
                  <CardContent className="p-4">
                    <div className="text-sm font-medium">{dimensionLabels[dim]}</div>
                    <div className={`text-3xl font-bold mt-3 ${scoreColor(val)}`}>{val}</div>
                    <div className="text-xs text-slate-500 mt-1">out of 10</div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        <section className="mt-10 border rounded-lg bg-slate-950 text-white p-6 grid lg:grid-cols-[1fr_auto] gap-6 items-center">
          <div>
            <Badge className="bg-white/10 text-white border-white/20 mb-4">Full audit</Badge>
            <h2 className="text-2xl font-bold">Turn this scan into a full AI visibility action plan.</h2>
            <p className="text-slate-300 mt-3 max-w-2xl">
              Get more buyer-intent queries, competitor share-of-voice, cited-domain analysis,
              messaging clarity findings, and 10 prioritized fixes in a PDF + dashboard.
            </p>
          </div>
          <Link href={checkoutHref}>
            <Button size="lg" variant="secondary" className="gap-2 w-full lg:w-auto">
              Get the full audit <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </section>
      </main>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-lg bg-white/70 p-3">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  )
}

function QueryRow({ query }: { query: GeoEvidence }) {
  const status = queryStatus(query)
  const StatusIcon = status.icon
  const named = unique([...query.competitors_mentioned, ...query.cited_domains]).slice(0, 4)

  return (
    <div className="px-5 py-4 text-sm">
      <div className="grid md:grid-cols-[1fr_8rem_1fr_9rem] gap-3 md:gap-4">
        <div>
          <div className="md:hidden text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Buyer question</div>
          <div className="font-medium leading-relaxed">{query.query}</div>
        </div>
        <div>
          <div className="md:hidden text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Engine</div>
          <Badge variant="outline">{query.engine}</Badge>
        </div>
        <div>
          <div className="md:hidden text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Who AI named / cited</div>
          {named.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {named.map((item) => (
                <span key={item} className="border rounded-full px-2 py-1 text-xs bg-slate-50 text-slate-600">
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-slate-500">No competitor/source captured</span>
          )}
        </div>
        <div className="md:text-right">
          <div className="md:hidden text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Your status</div>
          <span className={`inline-flex items-center gap-1 border rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </span>
        </div>
      </div>
      {query.answer_excerpt && (
        <details className="mt-3 group">
          <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
            <FileSearch className="h-3 w-3" /> Show the actual AI answer
          </summary>
          <blockquote className="mt-2 border-l-2 border-slate-200 pl-3 text-xs text-slate-600 leading-relaxed italic">
            {query.answer_excerpt}
          </blockquote>
        </details>
      )}
    </div>
  )
}

function InsightCard({
  icon: Icon,
  title,
  empty,
  items,
  tone = 'default',
}: {
  icon: typeof BarChart3
  title: string
  empty: string
  items: { label: string; value?: string }[]
  tone?: 'default' | 'risk'
}) {
  return (
    <Card className={tone === 'risk' ? 'border-amber-200 bg-amber-50/50' : ''}>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="h-5 w-5" />
          <h3 className="font-semibold">{title}</h3>
        </div>
        {items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={`${item.label}-${item.value ?? ''}`} className="flex items-start justify-between gap-3 text-sm">
                <span className="text-slate-700">{item.label}</span>
                {item.value && <span className="font-mono text-slate-500 shrink-0">{item.value}</span>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">{empty}</p>
        )}
      </CardContent>
    </Card>
  )
}
