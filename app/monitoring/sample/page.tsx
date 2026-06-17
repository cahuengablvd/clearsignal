import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MonitoringDashboard, type MonitoringView } from '@/components/monitoring-dashboard'
import type { GeoEvidence } from '@/lib/schemas'

const evidence: GeoEvidence[] = [
  {
    engine: 'ChatGPT',
    query: 'best deployment platform for mid-market SaaS teams',
    answer_excerpt:
      'For mid-market SaaS teams the most recommended options are Competitor A and Competitor B, both with strong G2 presence...',
    citations: ['https://g2.com/categories/deployment', 'https://competitor-a.com/alternatives'],
    brand_mentioned: false,
    brand_cited: false,
    brand_position: null,
    competitors_mentioned: ['Competitor A', 'Competitor B'],
    cited_domains: ['g2.com', 'competitor-a.com'],
  },
  {
    engine: 'Perplexity',
    query: 'how to ship product updates without downtime',
    answer_excerpt:
      'Several tools handle zero-downtime releases; Competitor A is the most cited, with Example SaaS mentioned as an alternative...',
    citations: ['https://reddit.com/r/devops', 'https://competitor-a.com'],
    brand_mentioned: true,
    brand_cited: false,
    brand_position: 2,
    competitors_mentioned: ['Competitor A'],
    cited_domains: ['reddit.com', 'competitor-a.com'],
  },
]

const view: MonitoringView = {
  url: 'https://example-saas.com',
  brand: 'Example SaaS',
  status: 'active',
  cadence: 'weekly',
  lastRunAt: '2026-06-15T08:00:00Z',
  current: { ai_visibility_score: 31, mention_rate: 22, share_of_voice: 14, citation_rate: 8 },
  delta: {
    is_first_run: false,
    ai_visibility_score: -11,
    mention_rate: -8,
    share_of_voice: -5,
    citation_rate: -4,
    new_competitors: ['Competitor D'],
    new_cited_domains: ['g2.com'],
    brand_citation_change: 'lost',
  },
  alerts: [
    { level: 'down', message: 'AI visibility dropped from 42 to 31.' },
    { level: 'down', message: 'Competitor A is now mentioned in 67% of answers (up from 51%).' },
    { level: 'down', message: 'Your brand lost its citations in AI answers.' },
    { level: 'info', message: 'New cited source appeared: g2.com.' },
  ],
  history: [
    { date: '5/18', score: 44 },
    { date: '5/25', score: 43 },
    { date: '6/1', score: 42 },
    { date: '6/8', score: 38 },
    { date: '6/15', score: 31 },
  ],
  competitorVisibility: [
    { name: 'Competitor A', mention_rate: 67 },
    { name: 'Competitor B', mention_rate: 54 },
    { name: 'Competitor D', mention_rate: 33 },
  ],
  citedDomains: [
    { domain: 'g2.com', count: 6 },
    { domain: 'reddit.com', count: 4 },
    { domain: 'competitor-a.com', count: 3 },
  ],
  evidence,
}

export default function SampleMonitoringPage() {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <nav className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-500 hover:text-slate-950">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link href="/" className="text-xl font-bold tracking-tight">ClearSignal</Link>
          </div>
          <Link href="/score">
            <Button size="sm" className="gap-2">
              Start free <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 pt-6">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
          <p className="text-sm text-amber-800 font-medium">
            Sample weekly monitoring dashboard. Data shown is illustrative.
          </p>
        </div>
      </div>

      <MonitoringDashboard view={view} />
    </div>
  )
}
