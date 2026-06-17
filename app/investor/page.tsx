import Link from 'next/link'
import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  ArrowRight,
  BarChart3,
  BellRing,
  CheckCircle,
  CircleAlert,
  FileSearch,
  LineChart,
  Radar,
  Repeat,
  Search,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'ClearSignal Investor Demo - AI Visibility Monitoring',
  description:
    'Investor walkthrough for ClearSignal: AI visibility audits, cited-source evidence, and weekly monitoring.',
}

const demoLinks = [
  { label: 'Live landing', href: '/', desc: 'Positioning and conversion path' },
  { label: 'Sample audit', href: '/sample', desc: 'Paid deliverable with evidence' },
  { label: 'Monitoring demo', href: '/monitoring/sample', desc: 'Recurring SaaS loop' },
  { label: 'Try free score', href: '/score', desc: 'Lead capture and aha moment' },
]

const workflow = [
  {
    icon: Search,
    title: 'Ask buyer questions',
    desc: 'Generate the category, comparison, and alternative queries prospects ask answer engines.',
  },
  {
    icon: Radar,
    title: 'Capture real AI answers',
    desc: 'Run those questions across answer engines and store raw evidence, citations, and competitors named.',
  },
  {
    icon: BarChart3,
    title: 'Score visibility',
    desc: 'Calculate mention rate, citation rate, share of voice, and a deterministic AI Visibility Score.',
  },
  {
    icon: Target,
    title: 'Turn gaps into action',
    desc: 'Explain why cited sources win and produce fixes for content, proof, structure, and messaging.',
  },
]

const roadmap = [
  ['Now', '\u20ac399 AI Visibility Audit', 'One-time audit with evidence, citation gaps, and fixes.'],
  ['Next', '\u20ac99/mo Weekly Monitoring', 'Weekly rescans, deltas, alerts, and competitor tracking.'],
  ['Later', 'Agency and team plans', 'Multi-client dashboards, exports, seats, and reporting workflows.'],
  ['Enterprise', 'AI discovery intelligence', 'Category-level tracking, source maps, and custom answer-engine coverage.'],
]

const proofPoints = [
  'Deterministic mention and citation detection',
  'Raw AI answer evidence stored per query',
  'Transparent score formula',
  'Weekly monitoring MVP deployed',
  'Paid report and PDF flow protected by signed links',
]

export default function InvestorPage() {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <nav className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold tracking-tight">ClearSignal</Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <a href="#product" className="hover:text-slate-950">Product</a>
            <a href="#business" className="hover:text-slate-950">Business model</a>
            <a href="#demo" className="hover:text-slate-950">Demo links</a>
          </div>
          <Link href="/monitoring/sample">
            <Button size="sm" className="gap-2">
              View monitoring demo <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </nav>

      <main>
        <section className="border-b bg-[linear-gradient(#f8fafc_0,#ffffff_48%)]">
          <div className="max-w-6xl mx-auto px-6 py-16">
            <div className="grid lg:grid-cols-[1fr_0.85fr] gap-10 items-center">
              <div>
                <Badge variant="secondary" className="mb-5 bg-white border-slate-200">
                  Investor demo brief
                </Badge>
                <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-tight">
                  ClearSignal measures whether AI recommends you or your competitors.
                </h1>
                <p className="mt-6 text-lg text-slate-600 leading-relaxed max-w-2xl">
                  SEO tools show rankings. ClearSignal shows answer-engine visibility: who gets
                  named, who gets cited, why cited sources win, and how a brand can improve.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Link href="/sample">
                    <Button size="lg" className="gap-2">
                      See sample audit <FileSearch className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/monitoring/sample">
                    <Button size="lg" variant="outline" className="gap-2">
                      See monitoring demo <LineChart className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>

              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-slate-500">Core wedge</div>
                      <div className="text-3xl font-bold mt-1">AI Visibility Audit</div>
                    </div>
                    <Radar className="h-9 w-9" />
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <Metric value={'\u20ac399'} label="one-time audit" />
                    <Metric value={'\u20ac99/mo'} label="weekly monitoring" />
                    <Metric value="18+" label="engine results per audit" />
                    <Metric value="10" label="prioritized fixes" />
                  </div>
                  <div className="mt-6 border rounded-lg bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <CircleAlert className="h-4 w-4 text-amber-600" />
                      Investor takeaway
                    </div>
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                      The one-time audit is the wedge. Weekly monitoring is the recurring SaaS product.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="border-b">
          <div className="max-w-6xl mx-auto px-6 py-14 grid lg:grid-cols-3 gap-6">
            <ThesisCard
              icon={TrendingUp}
              title="Why now"
              desc="Buyer discovery is shifting from search result pages to answer engines. Brands need to know if they appear in those answers."
            />
            <ThesisCard
              icon={CircleAlert}
              title="Problem"
              desc="Teams cannot see which competitors AI recommends, which sources AI cites, or what content gaps block citations."
            />
            <ThesisCard
              icon={Sparkles}
              title="Product"
              desc="ClearSignal turns live AI answers into scores, evidence, cited-source gaps, and a prioritized action plan."
            />
          </div>
        </section>

        <section id="product" className="border-b bg-slate-50">
          <div className="max-w-6xl mx-auto px-6 py-14">
            <div className="max-w-2xl">
              <Badge variant="secondary" className="mb-4 bg-white">How it works</Badge>
              <h2 className="text-3xl font-bold tracking-tight">From raw AI answers to a trusted score.</h2>
              <p className="mt-3 text-slate-600">
                The product is built around evidence, not vibes: store the AI answer, detect mentions
                deterministically, then use AI only to explain gaps and recommendations.
              </p>
            </div>
            <div className="mt-8 grid md:grid-cols-4 gap-4">
              {workflow.map((item) => (
                <Card key={item.title}>
                  <CardContent className="p-5">
                    <item.icon className="h-5 w-5" />
                    <h3 className="font-semibold mt-4">{item.title}</h3>
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">{item.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="business" className="border-b">
          <div className="max-w-6xl mx-auto px-6 py-14">
            <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-10">
              <div>
                <Badge variant="secondary" className="mb-4">Business model</Badge>
                <h2 className="text-3xl font-bold tracking-tight">A services wedge into recurring visibility monitoring.</h2>
                <p className="mt-4 text-slate-600 leading-relaxed">
                  The audit creates the first paid conversion and proves value. Monitoring turns
                  the same scan engine into weekly alerts, trend tracking, and retention.
                </p>
              </div>
              <div className="space-y-3">
                {roadmap.map(([stage, title, desc]) => (
                  <Card key={stage}>
                    <CardContent className="p-5 grid sm:grid-cols-[7rem_1fr] gap-4">
                      <Badge variant="outline" className="justify-center h-fit">{stage}</Badge>
                      <div>
                        <h3 className="font-semibold">{title}</h3>
                        <p className="text-sm text-slate-600 mt-1">{desc}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b bg-slate-950 text-white">
          <div className="max-w-6xl mx-auto px-6 py-12 grid md:grid-cols-3 gap-6">
            <div>
              <Repeat className="h-6 w-6 mb-4" />
              <div className="text-3xl font-bold">Weekly</div>
              <p className="text-sm text-slate-300 mt-2">Recurring rescans create the subscription loop.</p>
            </div>
            <div>
              <BellRing className="h-6 w-6 mb-4" />
              <div className="text-3xl font-bold">Alerts</div>
              <p className="text-sm text-slate-300 mt-2">Visibility drops, new competitors, and new cited sources become actionable events.</p>
            </div>
            <div>
              <BarChart3 className="h-6 w-6 mb-4" />
              <div className="text-3xl font-bold">Trends</div>
              <p className="text-sm text-slate-300 mt-2">Customers can see whether fixes improve AI discovery over time.</p>
            </div>
          </div>
        </section>

        <section id="demo" className="border-b bg-slate-50">
          <div className="max-w-6xl mx-auto px-6 py-14">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
              <div>
                <Badge variant="secondary" className="mb-4 bg-white">Demo path</Badge>
                <h2 className="text-3xl font-bold tracking-tight">Use these links in the investor walkthrough.</h2>
              </div>
              <Link href="/score">
                <Button className="gap-2">
                  Run a live free score <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="grid md:grid-cols-4 gap-4">
              {demoLinks.map((link) => (
                <Link href={link.href} key={link.href} className="block">
                  <Card className="h-full hover:border-slate-400 transition-colors">
                    <CardContent className="p-5">
                      <div className="font-semibold">{link.label}</div>
                      <p className="text-sm text-slate-600 mt-2">{link.desc}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="max-w-6xl mx-auto px-6 py-14 grid lg:grid-cols-[1fr_1fr] gap-8 items-start">
            <div>
              <Badge variant="secondary" className="mb-4">What is already strong</Badge>
              <h2 className="text-3xl font-bold tracking-tight">Current proof points for the pitch.</h2>
            </div>
            <div className="space-y-3">
              {proofPoints.map((point) => (
                <div key={point} className="flex gap-3 border rounded-lg bg-white p-4">
                  <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span className="text-sm text-slate-700">{point}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="border rounded-lg bg-white p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  )
}

function ThesisCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof TrendingUp
  title: string
  desc: string
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <Icon className="h-6 w-6" />
        <h2 className="text-xl font-bold mt-5">{title}</h2>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">{desc}</p>
      </CardContent>
    </Card>
  )
}
