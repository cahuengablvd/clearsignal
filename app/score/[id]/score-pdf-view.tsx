import { ArrowRight, LockKeyhole } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buildHash } from '@/lib/pdf-footer'
import type { GeoResult } from '@/lib/schemas'

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

export function ScorePdfView({
  id,
  createdAt,
  url,
  scores,
  geo,
  average,
  checkoutHref,
}: {
  id: string | number
  createdAt: string | null
  url: string
  scores: Record<string, number | string | GeoResult | null>
  geo: GeoResult | null | undefined
  average: number
  checkoutHref: string | null
}) {
  const generatedDate = createdAt ? new Date(createdAt) : new Date()
  const competitors = geo?.competitor_visibility.slice(0, 5) ?? []
  const scoreUnavailable = Boolean(geo && geo.ai_visibility_score == null)
  const scoreValue = scoreUnavailable ? 'n/a' : (geo ? geo.ai_visibility_score : average)
  const scoreScale = geo ? 100 : 10
  const lockedSections = [
    'Full multi-engine GEO scan with web search',
    'Source gap analysis',
    'Technical findings',
    'Prioritized action plan',
    'Ready-to-use materials',
  ]

  return (
    <div className="score-pdf bg-white text-[#2E2116]">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @page { size: A4; margin: 0; }
            .score-pdf { font-family: Arial, sans-serif; }
            .score-pdf * { box-sizing: border-box; }
            .score-pdf .avoid-break { break-inside: avoid; page-break-inside: avoid; }
          `,
        }}
      />

      <header className="avoid-break flex items-start justify-between border-b border-[#E5D7C5] pb-5">
        <div>
          <div className="text-2xl font-bold tracking-tight">ClearSignal</div>
          <div className="mt-1 text-sm text-[#8D7B6B]">getclearsignal.io</div>
        </div>
        <div className="text-right text-xs leading-5 text-[#756257]">
          <div>Generated {generatedDate.toLocaleDateString('en-GB')}</div>
          <div>Build {buildHash()}</div>
          <div className="font-mono">{String(id).slice(0, 8)}</div>
        </div>
      </header>

      <main className="pt-7">
        <section className="avoid-break">
          <Badge className="border border-[#D9C3AC] bg-[#FFF9F2] text-[#8C421A] hover:bg-[#FFF9F2]">
            Free AI Visibility Score
          </Badge>
          <h1 className="mt-4 text-4xl font-bold tracking-tight">Your AI visibility snapshot</h1>
          <p className="mt-2 break-all text-sm text-[#756257]">{url}</p>

          <div className="mt-6 grid grid-cols-[0.9fr_1.1fr] gap-5">
            <div className={`rounded-2xl border p-6 ${geo ? (scoreUnavailable ? 'bg-[#F7F4EF] border-[#DCCDBA]' : visBg(geo.ai_visibility_score!)) : scoreBg(average)}`}>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#756257]">
                {geo ? 'AI visibility score' : 'Messaging score'}
              </div>
              <div className={`mt-2 text-7xl font-bold ${geo ? (scoreUnavailable ? 'text-[#6E5A50]' : visColor(geo.ai_visibility_score!)) : scoreColor(average)}`}>
                {scoreValue}
                {!scoreUnavailable && <span className="ml-1 text-xl font-semibold text-[#8D7B6B]">/{scoreScale}</span>}
              </div>
              <p className="mt-4 text-xs leading-5 text-[#756257]">
                Source: ClearSignal AI Visibility Score — getclearsignal.io
              </p>
            </div>

            <div className="rounded-2xl border border-[#E5D7C5] bg-[#FFFDF9] p-5">
              <h2 className="text-lg font-bold">Score breakdown</h2>
              {geo && (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <PdfMetric label="Mention rate" value={`${Math.round(geo.mention_rate)}%`} />
                  <PdfMetric label="Share of voice" value={geo.share_of_voice == null ? 'n/a' : `${Math.round(geo.share_of_voice)}%`} />
                  <PdfMetric
                    label="Engine results"
                    value={String(geo.test_counts?.successful_combinations ?? geo.evidence.length)}
                  />
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2">
                {dimensions.map((dimension) => (
                  <div
                    key={dimension}
                    className="flex items-center justify-between border-b border-[#E8DCCB] py-2 text-xs"
                  >
                    <span className="text-[#6E5A50]">{dimensionLabels[dimension]}</span>
                    <strong>{Number(scores[dimension]) || 0}/10</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="avoid-break mt-7 rounded-2xl border border-[#E5D7C5] bg-[#FFFDF9] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#A9531F]">
                AI recommendation landscape
              </p>
              <h2 className="mt-2 text-2xl font-bold">Who AI names instead of you</h2>
            </div>
            {geo && <Badge variant="outline">{geo.engines_tested.join(', ')}</Badge>}
          </div>

          {competitors.length > 0 ? (
            <div className="mt-5 grid grid-cols-2 gap-3">
              {competitors.map((competitor, index) => (
                <div
                  key={`${competitor.name}-${index}`}
                  className="flex items-center justify-between rounded-xl border border-[#E5D7C5] bg-white px-4 py-3"
                >
                  <div>
                    <div className="text-xs font-semibold text-[#A9531F]">#{index + 1}</div>
                    <div className="mt-1 font-semibold">{competitor.name}</div>
                  </div>
                  <div className="text-sm font-semibold text-[#756257]">
                    {Math.round(competitor.mention_rate)}%
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-[#E5D7C5] bg-white p-4 text-sm text-[#6E5A50]">
              No competitor names were captured in this free scan.
            </p>
          )}
        </section>

        <div className="avoid-break mt-7 h-8 border-t border-dashed border-[#D9C3AC] bg-gradient-to-b from-[#FBF6EE] to-white" />

        <section className="avoid-break rounded-2xl border border-[#D9C3AC] bg-[#FBF6EE] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#A9531F]">
            What the full audit adds
          </p>
          <h2 className="mt-2 text-2xl font-bold">Go from a snapshot to an implementation plan</h2>
          <p className="mt-2 text-sm leading-6 text-[#6E5A50]">
            These sections are included in the full expert-reviewed audit.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {lockedSections.map((section) => (
              <div
                key={section}
                className="flex items-center gap-3 rounded-xl border border-[#DCCDBA] bg-white px-4 py-3 text-sm font-semibold"
              >
                <LockKeyhole className="h-4 w-4 shrink-0 text-[#A9531F]" />
                <span>{section}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="avoid-break mt-7 flex items-center justify-between gap-6 rounded-2xl bg-[#2E2116] p-6 text-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#E7A46E]">
              Founding offer
            </p>
            <h2 className="mt-2 text-2xl font-bold">Unlock the full AI Visibility Audit</h2>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-4xl font-bold">€149</span>
              <span className="text-lg text-[#B9A99C] line-through">€399</span>
            </div>
          </div>
          {checkoutHref && (
            <a
              href={checkoutHref}
              className="inline-flex min-h-12 items-center rounded-full bg-[#FFF7ED] px-6 py-3 text-sm font-bold text-[#2E2116] no-underline"
            >
              Get the full audit
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          )}
        </section>
      </main>
    </div>
  )
}

function PdfMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E5D7C5] bg-white p-3">
      <div className="text-xl font-bold">{value}</div>
      <div className="mt-1 text-[10px] leading-4 text-[#756257]">{label}</div>
    </div>
  )
}
