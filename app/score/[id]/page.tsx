import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, ArrowRight } from 'lucide-react'

function scoreColor(score: number): string {
  if (score >= 7) return 'text-green-600'
  if (score >= 4) return 'text-yellow-600'
  return 'text-red-600'
}

function scoreBg(score: number): string {
  if (score >= 7) return 'bg-green-50 border-green-200'
  if (score >= 4) return 'bg-yellow-50 border-yellow-200'
  return 'bg-red-50 border-red-200'
}

const dimensionLabels: Record<string, string> = {
  icp: 'ICP Clarity',
  headline: 'Headline Strength',
  cta: 'CTA Effectiveness',
  trust: 'Trust & Proof',
  ai_search: 'AI-Search Readiness',
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

  const scores = score.scores as Record<string, number | string>
  const dimensions = ['icp', 'headline', 'cta', 'trust', 'ai_search'] as const
  const avg = Math.round(
    dimensions.reduce((sum, d) => sum + (Number(scores[d]) || 0), 0) / dimensions.length
  )

  return (
    <div className="min-h-screen">
      <nav className="border-b">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/score" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-xl font-bold tracking-tight">ClearSignal</span>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-4">Free Score</Badge>
          <h1 className="text-3xl font-bold mb-2">Your ClearSignal Score</h1>
          <p className="text-muted-foreground text-sm truncate max-w-md mx-auto">{score.url}</p>
        </div>

        {/* Overall score */}
        <div className="text-center mb-10">
          <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full text-4xl font-bold border-2 ${scoreBg(avg)} ${scoreColor(avg)}`}>
            {avg}
          </div>
          <p className="text-sm text-muted-foreground mt-2">Overall Score (out of 10)</p>
        </div>

        {/* Individual scores */}
        <div className="grid gap-3 mb-8">
          {dimensions.map((dim) => {
            const val = Number(scores[dim]) || 0
            return (
              <Card key={dim} className={scoreBg(val)}>
                <CardContent className="p-4 flex items-center justify-between">
                  <span className="font-medium">{dimensionLabels[dim]}</span>
                  <span className={`text-2xl font-bold ${scoreColor(val)}`}>{val}</span>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Top insight */}
        {scores.top_insight && (
          <Card className="mb-10 border-primary/20 bg-primary/5">
            <CardContent className="p-5">
              <div className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">Top Insight</div>
              <p className="text-sm leading-relaxed">{String(scores.top_insight)}</p>
            </CardContent>
          </Card>
        )}

        {/* CTA */}
        <div className="text-center space-y-4">
          <h2 className="text-xl font-bold">Want the full picture?</h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Get a complete audit with competitor analysis, AI-search visibility assessment,
            and a prioritized fix list — all for €399.
          </p>
          <Link href={`/checkout?score_id=${score.id}`}>
            <Button size="lg" className="gap-2">
              Get the full audit <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
