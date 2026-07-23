import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PublicPageHeader } from '@/components/public-page-header'
import { isAdminAuthenticated } from '@/lib/auth'
import { trySignToken, verifyToken } from '@/lib/tokens'
import type { GeoEvidence, GeoResult } from '@/lib/schemas'
import { ScorePdfView } from './score-pdf-view'
import {
  ArrowRight,
  BarChart3,
  CheckCircle,
  CircleAlert,
  Download,
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
  if (score >= 7) return 'text-[#40735B]'
  if (score >= 4) return 'text-[#9A6A20]'
  return 'text-[#A64B35]'
}

function scoreBg(score: number): string {
  if (score >= 7) return 'bg-[#F2F8F3] border-[#C9DECF]'
  if (score >= 4) return 'bg-[#FFF8E9] border-[#E7D3A8]'
  return 'bg-[#FFF3EE] border-[#E6BEB1]'
}

function visColor(score: number): string {
  if (score >= 60) return 'text-[#40735B]'
  if (score >= 30) return 'text-[#9A6A20]'
  return 'text-[#A64B35]'
}

function visBg(score: number): string {
  if (score >= 60) return 'bg-[#F2F8F3] border-[#C9DECF]'
  if (score >= 30) return 'bg-[#FFF8E9] border-[#E7D3A8]'
  return 'bg-[#FFF3EE] border-[#E6BEB1]'
}

function queryStatus(query: GeoEvidence) {
  if (query.brand_cited) {
    return {
      label: 'Cited',
      className: 'border-[#BBD8C4] bg-[#F2F8F3] text-[#35654D]',
      icon: CheckCircle,
    }
  }
  if (query.brand_mentioned) {
    return {
      label: 'Mentioned',
      className: 'border-[#E7D3A8] bg-[#FFF8E9] text-[#8B5E1B]',
      icon: CircleAlert,
    }
  }
  return {
    label: 'Not named',
    className: 'border-[#E6BEB1] bg-[#FFF3EE] text-[#94402D]',
    icon: ShieldAlert,
  }
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

// Never cache: avoids serving a stale 404 for a freshly created score id.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ScoreResultPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { pdf?: string; token?: string }
}) {
  const hasAccess =
    verifyToken('score', params.id, searchParams.token) || isAdminAuthenticated()
  if (!hasAccess) {
    notFound()
  }

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
  const scoreToken =
    verifyToken('score', score.id, searchParams.token)
      ? searchParams.token || null
      : trySignToken('score', score.id)
  const checkoutHref = scoreToken ? `/checkout?score_id=${score.id}&token=${scoreToken}` : null
  const downloadHref = scoreToken
    ? `/api/score/${score.id}/pdf?token=${encodeURIComponent(scoreToken)}`
    : null
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

  if (searchParams.pdf === 'true') {
    return (
      <ScorePdfView
        id={score.id}
        createdAt={(score.created_at as string | null | undefined) ?? null}
        url={score.url as string}
        scores={scores}
        geo={geo}
        average={avg}
        checkoutHref={checkoutHref}
      />
    )
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FBF6EE] text-[#2E2116] [&_button]:min-h-11">
      <PublicPageHeader actionHref="/score" actionLabel="Run another check" />

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14">
        <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-8 items-start">
          <section>
            <Badge className="mb-4 border border-[#D9C3AC] bg-[#FFF9F2] text-[#8C421A] hover:bg-[#FFF9F2]">
              Free AI Visibility Score
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
              Your AI visibility mini-report
            </h1>
            <p className="mt-4 break-all text-[#8D7B6B]">{score.url}</p>
            <p className="mt-4 text-lg leading-relaxed text-[#6E5A50]">
              This free scan checks whether answer engines name your brand when buyers ask
              category-level questions. The full audit expands the query set, competitor analysis,
              and fix list.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              {checkoutHref ? (
                <Link href={checkoutHref}>
                  <Button size="lg" className="gap-2 rounded-full bg-[#2E2116] text-white hover:bg-[#4B3424]">
                    Unlock the full audit <Sparkles className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <Button size="lg" className="gap-2 rounded-full" disabled>
                  Full audit checkout offline <Sparkles className="h-4 w-4" />
                </Button>
              )}
              {downloadHref && (
                <a href={downloadHref}>
                  <Button
                    variant="outline"
                    size="lg"
                    className="gap-2 rounded-full border-[#DCCDBA] bg-[#FFFDF9] hover:bg-[#FFF7ED]"
                  >
                    <Download className="h-4 w-4" /> Download PDF
                  </Button>
                </a>
              )}
              <Link href="/sample">
                <Button variant="outline" size="lg" className="rounded-full border-[#DCCDBA] bg-[#FFFDF9] hover:bg-[#FFF7ED]">
                  View sample report
                </Button>
              </Link>
            </div>
          </section>

          <section className={`rounded-2xl border p-6 shadow-[0_22px_70px_rgba(78,49,27,0.10)] ${geo ? visBg(geo.ai_visibility_score) : scoreBg(avg)}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-[#6E5A50]">
                  {geo ? 'AI Visibility Score' : 'Overall messaging score'}
                </div>
                <div className={`text-7xl font-bold tracking-tight mt-2 ${geo ? visColor(geo.ai_visibility_score) : scoreColor(avg)}`}>
                  {geo ? geo.ai_visibility_score : avg}
                </div>
                <div className="mt-1 text-sm text-[#6E5A50]">
                  {geo ? 'out of 100' : 'out of 10'}
                </div>
              </div>
              <div className="text-right">
                <Badge className="border-[#DCCDBA] bg-white/70 text-[#5B493F]">
                  {geo ? `${geo.engines_tested.join(', ')}` : 'Heuristic scan'}
                </Badge>
              </div>
            </div>

            {geo ? (
              <div className="grid grid-cols-3 gap-3 mt-6">
                <Metric label="Mention rate" value={`${Math.round(geo.mention_rate)}%`} />
                <Metric label="Share of voice" value={`${Math.round(geo.share_of_voice)}%`} />
                <Metric
                  label="Successful combinations"
                  value={String(geo.test_counts?.successful_combinations ?? geo.evidence.length)}
                />
              </div>
            ) : (
              <p className="mt-6 text-sm text-[#6E5A50]">
                Live GEO data was unavailable for this run, so this result uses the messaging clarity scan.
              </p>
            )}
          </section>
        </div>

        {geo && (
          <>
            {geo.summary && (
              <Card className="mt-8 border-[#E5D7C5] bg-[#FFFDF9] shadow-sm">
                <CardContent className="p-5">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#A9531F]">
                    What answer engines saw
                  </div>
                  <p className="leading-relaxed text-[#5F4D42]">{geo.summary}</p>
                </CardContent>
              </Card>
            )}

            <section className="mt-8">
              <div className="flex items-end justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-2xl font-bold">Buyer questions tested</h2>
                  <p className="mt-1 text-sm text-[#756257]">
                    Each row shows one answer-engine probe and whether your brand appeared.
                  </p>
                </div>
                <Badge variant="outline">{geo.evidence.length} engine results</Badge>
              </div>

              <div className="overflow-hidden rounded-xl border border-[#E5D7C5] bg-[#FFFDF9]">
                <div className="hidden border-b border-[#E5D7C5] bg-[#F7EFE4] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#756257] md:grid md:grid-cols-[1fr_8rem_1fr_9rem] md:gap-4">
                  <div>Buyer question</div>
                  <div>Engine</div>
                  <div>Who AI named / cited</div>
                  <div className="text-right">Your status</div>
                </div>
                <div className="divide-y divide-[#E8DCCB]">
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
              <section className="mt-8 rounded-xl border border-[#E5D7C5] bg-[#FFFDF9] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="h-5 w-5" />
                  <h2 className="text-xl font-bold">What to fix first</h2>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {recommendations.map((rec, index) => (
                    <div key={rec} className="rounded-lg border border-[#E5D7C5] bg-[#FBF6EE] p-4">
                      <div className="mb-2 text-xs font-semibold text-[#A9531F]">Fix #{index + 1}</div>
                      <p className="text-sm leading-relaxed text-[#5F4D42]">{rec}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {sourceGaps.length > 0 && (
              <section className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                  <FileSearch className="h-5 w-5" />
                  <h2 className="text-xl font-bold">Potential citation factors</h2>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {sourceGaps.map((s) => (
                    <div key={s.cited_source} className="rounded-lg border border-[#E5D7C5] bg-[#FFFDF9] p-4">
                      <div className="font-semibold text-sm mb-1">{s.cited_source}</div>
                      <p className="mb-2 text-xs leading-relaxed text-[#756257]">{s.why_this_source_gets_cited}</p>
                      {s.target_missing_signals.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {s.target_missing_signals.map((sig) => (
                            <span key={sig} className="rounded-full border border-[#E6BEB1] bg-[#FFF3EE] px-2 py-0.5 text-xs text-[#94402D]">
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
                    <div className="mt-1 text-xs text-[#756257]">out of 10</div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        <section className="mt-10 grid items-center gap-6 rounded-2xl border border-[#5C4331] bg-[#2E2116] p-6 text-white shadow-[0_24px_70px_rgba(46,33,22,0.18)] lg:grid-cols-[1fr_auto]">
          <div>
            <Badge className="bg-white/10 text-white border-white/20 mb-4">Full audit</Badge>
            <h2 className="text-2xl font-bold">Turn this scan into a full AI visibility action plan.</h2>
            <p className="mt-3 max-w-2xl text-[#D8C8BA]">
              Get more buyer-intent queries, competitor share-of-voice, cited-domain analysis,
              messaging clarity findings, and 10 prioritized fixes in a PDF + dashboard.
            </p>
          </div>
          {checkoutHref ? (
            <Link href={checkoutHref}>
              <Button size="lg" variant="secondary" className="w-full gap-2 rounded-full bg-[#FFF7ED] text-[#2E2116] hover:bg-white lg:w-auto">
                Get the full audit <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <Button size="lg" variant="secondary" className="w-full gap-2 rounded-full lg:w-auto" disabled>
              Checkout needs configuration
            </Button>
          )}
        </section>
      </main>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E5D7C5] bg-white/75 p-3">
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-[#756257]">{label}</div>
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
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#8D7B6B] md:hidden">Buyer question</div>
          <div className="font-medium leading-relaxed">{query.query}</div>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#8D7B6B] md:hidden">Engine</div>
          <Badge variant="outline">{query.engine}</Badge>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#8D7B6B] md:hidden">Who AI named / cited</div>
          {named.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {named.map((item) => (
                <span key={item} className="rounded-full border border-[#E5D7C5] bg-[#FBF6EE] px-2 py-1 text-xs text-[#6E5A50]">
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[#8D7B6B]">No competitor/source captured</span>
          )}
        </div>
        <div className="md:text-right">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#8D7B6B] md:hidden">Your status</div>
          <span className={`inline-flex items-center gap-1 border rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </span>
        </div>
      </div>
      {query.answer_excerpt && (
        <details className="mt-3 group">
          <summary className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-[#8D7B6B] hover:text-[#4B3424]">
            <FileSearch className="h-3 w-3" /> Show the actual AI answer
          </summary>
          <blockquote className="mt-2 border-l-2 border-[#D9C3AC] pl-3 text-xs italic leading-relaxed text-[#6E5A50]">
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
    <Card className={tone === 'risk' ? 'border-[#E7D3A8] bg-[#FFF8E9]' : 'border-[#E5D7C5] bg-[#FFFDF9]'}>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="h-5 w-5" />
          <h3 className="font-semibold">{title}</h3>
        </div>
        {items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={`${item.label}-${item.value ?? ''}`} className="flex items-start justify-between gap-3 text-sm">
                <span className="text-[#5F4D42]">{item.label}</span>
                {item.value && <span className="shrink-0 font-mono text-[#8D7B6B]">{item.value}</span>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#8D7B6B]">{empty}</p>
        )}
      </CardContent>
    </Card>
  )
}
