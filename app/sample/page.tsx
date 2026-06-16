import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  Zap,
} from 'lucide-react'

const scoreCards = [
  { label: 'AI Visibility / 100', value: '31', tone: 'risk' },
  { label: 'Mention rate', value: '22%', tone: 'warn' },
  { label: 'Share of voice', value: '14%', tone: 'warn' },
  { label: 'Engine results', value: '18', tone: 'default' },
]

const queryRows = [
  {
    question: 'best deployment platform for mid-market SaaS teams',
    engine: 'ChatGPT',
    named: ['Competitor A', 'Competitor B'],
    cited: ['g2.com', 'competitor-a.com'],
    status: 'Not named',
    tone: 'risk',
  },
  {
    question: 'how to ship product updates without downtime',
    engine: 'Perplexity',
    named: ['Competitor A', 'Example SaaS'],
    cited: ['reddit.com', 'competitor-a.com'],
    status: 'Mentioned',
    tone: 'warn',
  },
  {
    question: 'best alternatives to Competitor A for SaaS engineering teams',
    engine: 'Claude',
    named: ['Competitor A', 'Competitor C'],
    cited: ['g2.com', 'capterra.com'],
    status: 'Not named',
    tone: 'risk',
  },
  {
    question: 'AI-ready deployment tools for B2B SaaS',
    engine: 'Google AI',
    named: ['Example SaaS'],
    cited: ['example-saas.com'],
    status: 'Cited',
    tone: 'ok',
  },
]

const competitors = [
  ['Competitor A', '67%'],
  ['Competitor B', '54%'],
  ['Competitor C', '38%'],
]

const citedDomains = [
  ['g2.com', '5x'],
  ['reddit.com', '4x'],
  ['competitor-a.com', '3x'],
  ['capterra.com', '2x'],
]

const citationGaps = [
  'No comparison or alternatives pages for high-intent buyer questions',
  'Weak third-party proof: no G2/Capterra profile and few review signals',
  'Homepage does not answer category questions in citation-ready sections',
  'No structured FAQ content for answer engines to quote cleanly',
]

const clarityScores = [
  ['ICP clarity', 35, 'critical'],
  ['Headline strength', 28, 'critical'],
  ['CTA effectiveness', 45, 'medium'],
  ['Trust & proof', 22, 'critical'],
  ['AI-search readiness', 31, 'critical'],
]

const fixes = [
  {
    title: 'Publish a competitor alternatives page',
    desc: 'Create a neutral “Competitor A alternatives” page answering use cases, tradeoffs, pricing signals, and who each tool is best for.',
    impact: 'high',
    effort: 'medium',
    category: 'ai_search',
  },
  {
    title: 'Rewrite the hero around outcome + ICP',
    desc: 'Replace generic platform language with a concrete promise for mid-market SaaS product and engineering teams.',
    impact: 'high',
    effort: 'easy',
    category: 'copy',
  },
  {
    title: 'Add third-party proof above the fold',
    desc: 'Add named logos, review badges, and one proof metric so answer engines can associate the brand with credible entities.',
    impact: 'high',
    effort: 'easy',
    category: 'proof',
  },
  {
    title: 'Create a citation-ready FAQ block',
    desc: 'Answer the exact buyer questions tested in this audit with concise, quotable sections and FAQ schema.',
    impact: 'medium',
    effort: 'medium',
    category: 'structure',
  },
  {
    title: 'Replace vague CTA copy',
    desc: 'Change “Get Started” to “Book a 15-min deployment demo” so the next step matches buyer intent.',
    impact: 'medium',
    effort: 'easy',
    category: 'cta',
  },
]

function statusClass(tone: string) {
  if (tone === 'risk') return 'border-red-200 bg-red-50 text-red-700'
  if (tone === 'warn') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (tone === 'ok') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function statusIcon(tone: string) {
  if (tone === 'ok') return CheckCircle
  if (tone === 'warn') return CircleAlert
  return ShieldAlert
}

function impactClass(impact: string) {
  if (impact === 'high') return 'bg-red-50 text-red-700 border-red-200'
  return 'bg-amber-50 text-amber-700 border-amber-200'
}

export default function SampleReportPage() {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <nav className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-500 hover:text-slate-950">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link href="/" className="text-xl font-bold tracking-tight">ClearSignal</Link>
          </div>
          <Link href="/score">
            <Button size="sm" className="gap-2">
              Get your free score <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 mb-8">
          <p className="text-sm text-amber-800 font-medium">
            Sample report for demo purposes. Data is fictional, but mirrors the structure of a paid ClearSignal audit.
          </p>
        </div>

        <section className="grid lg:grid-cols-[0.95fr_1.05fr] gap-8 items-start">
          <div>
            <Badge variant="secondary" className="mb-4">Automated AI Visibility Audit</Badge>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
              Example SaaS is visible, but competitors own the recommendations.
            </h1>
            <p className="mt-4 text-slate-600">https://example-saas.com</p>
            <p className="mt-4 text-lg text-slate-600 leading-relaxed">
              Across 18 answer-engine results, Example SaaS appeared in only 22% of answers
              and was cited once. Competitors with comparison pages, review profiles, and clearer
              proof signals dominate the buyer discovery moment.
            </p>
          </div>

          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-slate-600">AI Visibility Score</div>
                  <div className="text-7xl font-bold tracking-tight text-red-600 mt-2">31</div>
                  <div className="text-sm text-slate-600 mt-1">out of 100</div>
                </div>
                <Badge className="bg-white/70 text-slate-700 border-slate-200">ChatGPT, Claude, Perplexity</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3 mt-6">
                {scoreCards.map((card) => (
                  <div key={card.label} className="border rounded-lg bg-white/80 p-3">
                    <div className={card.tone === 'risk' ? 'text-2xl font-bold text-red-600' : card.tone === 'warn' ? 'text-2xl font-bold text-amber-600' : 'text-2xl font-bold'}>
                      {card.value}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{card.label}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <Card className="mt-8 border-slate-200 bg-slate-50">
          <CardContent className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              Executive summary
            </div>
            <p className="leading-relaxed text-slate-700">
              Example SaaS has a credible product, but its homepage and surrounding content do not
              give answer engines enough specific, citable signals. The fastest path to better AI
              visibility is to publish comparison content, add third-party proof, and rewrite the
              hero around a concrete outcome for mid-market SaaS teams.
            </p>
          </CardContent>
        </Card>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <h2 className="text-2xl font-bold">Answer-engine evidence</h2>
              <p className="text-sm text-slate-600 mt-1">
                The paid report shows the actual buyer questions tested and who appeared in the answers.
              </p>
            </div>
            <Badge variant="outline">18 engine results</Badge>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="hidden md:grid grid-cols-[1fr_8rem_1fr_9rem] gap-4 bg-slate-50 border-b px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <div>Buyer question</div>
              <div>Engine</div>
              <div>Who AI named / cited</div>
              <div className="text-right">Your status</div>
            </div>
            <div className="divide-y">
              {queryRows.map((row) => (
                <QueryRow key={`${row.engine}-${row.question}`} row={row} />
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 grid lg:grid-cols-3 gap-4">
          <InsightCard icon={BarChart3} title="Competitors AI recommends">
            {competitors.map(([name, rate]) => (
              <MetricLine key={name} label={name} value={rate} />
            ))}
          </InsightCard>
          <InsightCard icon={ExternalLink} title="Sources AI cites most">
            {citedDomains.map(([domain, count]) => (
              <MetricLine key={domain} label={domain} value={count} />
            ))}
          </InsightCard>
          <InsightCard icon={CircleAlert} title="Citation gaps" tone="risk">
            <ul className="space-y-2 text-sm text-slate-700">
              {citationGaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          </InsightCard>
        </section>

        <section className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-5 w-5" />
            <h2 className="text-xl font-bold">Messaging clarity</h2>
          </div>
          <div className="grid md:grid-cols-5 gap-3">
            {clarityScores.map(([label, score, severity]) => (
              <Card key={label} className={severity === 'critical' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}>
                <CardContent className="p-4">
                  <div className="text-sm font-medium">{label}</div>
                  <div className={severity === 'critical' ? 'text-3xl font-bold mt-3 text-red-600' : 'text-3xl font-bold mt-3 text-amber-600'}>
                    {score}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">out of 100</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5" />
            <h2 className="text-xl font-bold">Prioritized action plan</h2>
          </div>
          <div className="space-y-3">
            {fixes.map((fix, index) => (
              <Card key={fix.title}>
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-2">Fix #{index + 1}</div>
                      <h3 className="font-semibold">{fix.title}</h3>
                      <p className="text-sm text-slate-600 mt-2 leading-relaxed">{fix.desc}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Badge className={impactClass(fix.impact)}>{fix.impact} impact</Badge>
                      <Badge variant="outline">{fix.effort}</Badge>
                      <Badge variant="outline">{fix.category}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-10 border rounded-lg bg-slate-950 text-white p-6 grid lg:grid-cols-[1fr_auto] gap-6 items-center">
          <div>
            <Badge className="bg-white/10 text-white border-white/20 mb-4">ClearSignal audit</Badge>
            <h2 className="text-2xl font-bold">Get this report for your own homepage.</h2>
            <p className="text-slate-300 mt-3 max-w-2xl">
              Start with a free AI visibility score, then unlock the full audit with competitor
              share-of-voice, cited-domain analysis, messaging gaps, and 10 prioritized fixes.
            </p>
          </div>
          <Link href="/score">
            <Button size="lg" variant="secondary" className="gap-2 w-full lg:w-auto">
              Start with a free score <Sparkles className="h-4 w-4" />
            </Button>
          </Link>
        </section>
      </main>
    </div>
  )
}

function QueryRow({
  row,
}: {
  row: {
    question: string
    engine: string
    named: string[]
    cited: string[]
    status: string
    tone: string
  }
}) {
  const StatusIcon = statusIcon(row.tone)
  const named = [...new Set([...row.named, ...row.cited])]

  return (
    <div className="grid md:grid-cols-[1fr_8rem_1fr_9rem] gap-3 md:gap-4 px-5 py-4 text-sm">
      <div>
        <div className="md:hidden text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Buyer question</div>
        <div className="font-medium leading-relaxed">{row.question}</div>
      </div>
      <div>
        <div className="md:hidden text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Engine</div>
        <Badge variant="outline">{row.engine}</Badge>
      </div>
      <div>
        <div className="md:hidden text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Who AI named / cited</div>
        <div className="flex flex-wrap gap-2">
          {named.map((item) => (
            <span key={item} className="border rounded-full px-2 py-1 text-xs bg-slate-50 text-slate-600">
              {item}
            </span>
          ))}
        </div>
      </div>
      <div className="md:text-right">
        <div className="md:hidden text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Your status</div>
        <span className={`inline-flex items-center gap-1 border rounded-full px-3 py-1 text-xs font-medium ${statusClass(row.tone)}`}>
          <StatusIcon className="h-3 w-3" />
          {row.status}
        </span>
      </div>
    </div>
  )
}

function InsightCard({
  icon: Icon,
  title,
  children,
  tone = 'default',
}: {
  icon: typeof BarChart3
  title: string
  children: React.ReactNode
  tone?: 'default' | 'risk'
}) {
  return (
    <Card className={tone === 'risk' ? 'border-amber-200 bg-amber-50/50' : ''}>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="h-5 w-5" />
          <h3 className="font-semibold">{title}</h3>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-700">{label}</span>
      <span className="font-mono text-slate-500">{value}</span>
    </div>
  )
}
