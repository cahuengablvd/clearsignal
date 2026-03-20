import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight } from 'lucide-react'

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-green-100 text-green-800 border-green-200',
  }
  return <Badge className={colors[severity] || ''}>{severity}</Badge>
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, score)
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

export default function SampleReportPage() {
  return (
    <div className="min-h-screen">
      <nav className="border-b">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="text-xl font-bold tracking-tight">ClearSignal</span>
          </div>
          <Link href="/score">
            <Button size="sm" className="gap-2">
              Get your free score <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8 text-center">
          <p className="text-sm text-yellow-800 font-medium">
            This is a sample report for demonstration purposes. Data shown is fictional.
          </p>
        </div>

        <div className="mb-10">
          <Badge variant="secondary" className="mb-3">automated audit</Badge>
          <h1 className="text-3xl font-bold mb-2">ClearSignal Audit Report</h1>
          <p className="text-muted-foreground">https://example-saas.com</p>
          <p className="text-xs text-muted-foreground mt-1">Generated March 15, 2026 | ICP: Mid-market B2B SaaS product teams</p>
        </div>

        {/* Executive Summary */}
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardHeader><CardTitle className="text-lg">Executive Summary</CardTitle></CardHeader>
          <CardContent>
            <p className="leading-relaxed">
              Example SaaS has strong product capabilities but the homepage fails to communicate them to the right buyer.
              The headline is generic, trust proof is thin, and the CTA language doesn&apos;t match buyer intent. Competitors
              are outmessaging you on specificity and social proof. Fixing the headline and adding 2-3 proof points could
              lift demo requests by 15-25% based on comparable audits.
            </p>
          </CardContent>
        </Card>

        {/* Clarity Block */}
        <h2 className="text-2xl font-bold mb-4">Messaging Clarity</h2>
        <div className="mb-4">
          <div className="text-sm text-muted-foreground mb-1">Overall Clarity Score</div>
          <ScoreBar score={42} />
        </div>

        <div className="grid gap-4 mb-8">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">ICP Visibility</h3>
                <div className="flex items-center gap-2">
                  <SeverityBadge severity="critical" />
                  <span className="text-sm font-mono">35/100</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                The homepage never explicitly names the target buyer. &ldquo;Teams of all sizes&rdquo; appears twice
                but says nothing about who benefits most. A Series B product team and a solo founder would read
                this identically — which means neither feels it&apos;s for them.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Headline</h3>
                <div className="flex items-center gap-2">
                  <SeverityBadge severity="critical" />
                  <span className="text-sm font-mono">28/100</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                &ldquo;The All-in-One Platform for Your Business&rdquo; could describe any SaaS product. Zero specificity
                about what the product does or what pain it solves.
              </p>
              <div className="bg-muted rounded p-3 space-y-2 text-sm">
                <div><span className="font-medium">Current:</span> The All-in-One Platform for Your Business</div>
                <div><span className="font-medium text-green-700">Suggested:</span> Ship product updates 3x faster — the deployment platform built for mid-market SaaS teams</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">CTA</h3>
                <div className="flex items-center gap-2">
                  <SeverityBadge severity="medium" />
                  <span className="text-sm font-mono">45/100</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                &ldquo;Get Started&rdquo; is low-commitment but also low-information. Buyer doesn&apos;t know what happens next.
              </p>
              <div className="bg-muted rounded p-3 text-sm">
                <span className="font-medium text-green-700">Suggested:</span> See it in action — book a 15-min demo
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Trust & Proof</h3>
                <div className="flex items-center gap-2">
                  <SeverityBadge severity="critical" />
                  <span className="text-sm font-mono">22/100</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                No customer logos, no testimonials, no case studies. The only proof is a &ldquo;1000+ users&rdquo; badge
                which feels generic and unverifiable.
              </p>
              <div className="text-sm">
                <span className="font-medium">Missing:</span>
                <ul className="list-disc list-inside mt-1 text-muted-foreground">
                  <li>Named customer logos</li>
                  <li>Specific outcome metrics</li>
                  <li>Testimonial with name + title</li>
                  <li>Case study link</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gap Block */}
        <h2 className="text-2xl font-bold mb-4 mt-10">Competitive Gap Analysis</h2>

        <Card className="mb-4">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">https://competitor-a.com</h3>
              <span className="text-sm font-mono">72/100</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3 italic">
              &ldquo;Deploy 10x faster with zero downtime — trusted by 200+ engineering teams&rdquo;
            </p>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-green-700">Strengths</span>
                <ul className="list-disc list-inside mt-1 text-muted-foreground">
                  <li>Specific metric in headline (10x)</li>
                  <li>Named customer count (200+)</li>
                  <li>Clear ICP (engineering teams)</li>
                </ul>
              </div>
              <div>
                <span className="font-medium text-red-700">Weaknesses</span>
                <ul className="list-disc list-inside mt-1 text-muted-foreground">
                  <li>No named logos visible</li>
                  <li>CTA is still generic &ldquo;Try Free&rdquo;</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="p-5">
              <h3 className="font-semibold text-red-800 mb-2">Where you lose</h3>
              <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                <li>Competitor headlines are 3x more specific</li>
                <li>Competitors show named logos and metrics</li>
                <li>Competitors name their ICP in the first fold</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="p-5">
              <h3 className="font-semibold text-green-800 mb-2">Where you win</h3>
              <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                <li>Broader feature set</li>
                <li>Cleaner visual design</li>
                <li>More transparent pricing page</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Action Plan */}
        <h2 className="text-2xl font-bold mb-4 mt-10">Action Plan</h2>

        <div className="space-y-3 mb-8">
          {[
            { id: 1, title: 'Rewrite headline with specific outcome + ICP', impact: 'high', effort: 'easy', category: 'copy' },
            { id: 2, title: 'Add 3 named customer logos above the fold', impact: 'high', effort: 'easy', category: 'proof' },
            { id: 3, title: 'Replace "Get Started" with outcome-oriented CTA', impact: 'high', effort: 'easy', category: 'cta' },
            { id: 4, title: 'Add one testimonial with name, title, and metric', impact: 'high', effort: 'medium', category: 'proof' },
            { id: 5, title: 'Add structured data for AI search citation', impact: 'medium', effort: 'medium', category: 'ai_search' },
          ].map((fix) => (
            <Card key={fix.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-muted-foreground w-6">#{fix.id}</span>
                    <h3 className="font-semibold">{fix.title}</h3>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={fix.impact === 'high' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                      {fix.impact} impact
                    </Badge>
                    <Badge className={fix.effort === 'easy' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                      {fix.effort}
                    </Badge>
                    <Badge variant="outline">{fix.category}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <p className="text-sm text-muted-foreground text-center">... and 5 more fixes in the full report</p>
        </div>

        {/* CTA */}
        <div className="text-center py-10 border-t">
          <h2 className="text-2xl font-bold mb-3">Get your own ClearSignal audit</h2>
          <p className="text-muted-foreground mb-6">
            Start with a free score, then get the full analysis for €399.
          </p>
          <Link href="/score">
            <Button size="lg" className="gap-2">
              Get your free score <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
