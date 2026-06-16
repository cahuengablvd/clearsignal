import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowRight,
  BarChart3,
  CheckCircle,
  CircleAlert,
  FileSearch,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react'

const engines = ['ChatGPT', 'Claude', 'Perplexity', 'Google AI']

const scanRows = [
  {
    query: 'best homepage audit tool for B2B SaaS',
    engine: 'ChatGPT',
    answer: 'Competitor A, Competitor B',
    status: 'Not named',
    tone: 'risk',
  },
  {
    query: 'how to improve SaaS homepage conversion',
    engine: 'Perplexity',
    answer: 'Cites g2.com, reddit.com, competitor-a.com',
    status: 'Competitor cited 5x',
    tone: 'warn',
  },
  {
    query: 'AI visibility audit for SaaS teams',
    engine: 'Claude',
    answer: 'ClearSignal mentioned, no source citation',
    status: 'Mentioned',
    tone: 'ok',
  },
]

const auditItems = [
  {
    icon: Search,
    title: 'Live AI visibility measurement',
    desc: 'We ask answer engines the same buying questions your prospects ask, then record who gets named and cited.',
  },
  {
    icon: BarChart3,
    title: 'Share-of-voice vs competitors',
    desc: 'See which competitors dominate AI recommendations and where your brand disappears from the answer set.',
  },
  {
    icon: Target,
    title: 'Citation gap analysis',
    desc: 'Find the missing comparison pages, proof points, entity signals, reviews, and structured answers that cost citations.',
  },
  {
    icon: Zap,
    title: 'Prioritized citation fixes',
    desc: 'Get a ranked action plan that turns the audit into concrete content, proof, and messaging improvements.',
  },
]

const deliverables = [
  'AI visibility across ChatGPT, Claude, Perplexity and Google AI',
  'Share-of-voice vs up to 3 competitors',
  'Citation gap analysis: why AI skips you',
  'Full messaging clarity analysis',
  '10 prioritized fixes to get cited',
  'PDF report + web dashboard',
]

function statusClass(tone: string) {
  if (tone === 'risk') return 'border-red-200 bg-red-50 text-red-700'
  if (tone === 'warn') return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <nav className="border-b bg-white/95">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold tracking-tight">
            ClearSignal
          </Link>
          <div className="hidden sm:flex items-center gap-6 text-sm text-slate-600">
            <a href="#workflow" className="hover:text-slate-950">Workflow</a>
            <a href="#audit" className="hover:text-slate-950">What you get</a>
            <a href="#pricing" className="hover:text-slate-950">Pricing</a>
          </div>
          <Link href="/score">
            <Button variant="outline" size="sm">Free AI visibility check</Button>
          </Link>
        </div>
      </nav>

      <main>
        <section className="border-b bg-[linear-gradient(#f8fafc_0,#ffffff_44%)]">
          <div className="max-w-6xl mx-auto px-6 pt-16 pb-14">
            <div className="text-center max-w-3xl mx-auto">
              <Badge variant="secondary" className="mb-5 border-slate-200 bg-white">
                GEO / Answer Engine Optimization
              </Badge>
              <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-tight">
                Find out if AI recommends you or your competitor.
              </h1>
              <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
                ClearSignal asks ChatGPT, Claude, Perplexity and Google AI the questions your buyers
                ask, then shows who gets named, who gets cited, and what you need to fix.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/score">
                  <Button size="lg" className="gap-2">
                    Get your free AI Visibility Score <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/sample">
                  <Button variant="outline" size="lg">
                    See a sample report
                  </Button>
                </Link>
              </div>
            </div>

            <div className="mt-12 border rounded-lg bg-white shadow-sm overflow-hidden">
              <div className="border-b px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-slate-950 text-white flex items-center justify-center">
                    <Radar className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold">AI Visibility Scan</div>
                    <div className="text-sm text-slate-500">Example output from buyer-intent questions</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {engines.map((engine) => (
                    <span key={engine} className="text-xs border rounded-full px-3 py-1 bg-slate-50 text-slate-600">
                      {engine}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
                <div className="divide-y">
                  {scanRows.map((row) => (
                    <div key={`${row.engine}-${row.query}`} className="p-5 grid gap-3 sm:grid-cols-[1fr_8rem] sm:items-center">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{row.engine}</div>
                        <div className="font-medium">{row.query}</div>
                        <div className="text-sm text-slate-600 mt-1">{row.answer}</div>
                      </div>
                      <div className={`text-xs font-medium border rounded-full px-3 py-1 justify-self-start sm:justify-self-end ${statusClass(row.tone)}`}>
                        {row.status}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t lg:border-t-0 lg:border-l bg-slate-50 p-5">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="border rounded-lg bg-white p-4">
                      <div className="text-3xl font-bold text-red-600">18</div>
                      <div className="text-xs text-slate-500 mt-1">AI visibility / 100</div>
                    </div>
                    <div className="border rounded-lg bg-white p-4">
                      <div className="text-3xl font-bold">22%</div>
                      <div className="text-xs text-slate-500 mt-1">Mention rate</div>
                    </div>
                    <div className="border rounded-lg bg-white p-4">
                      <div className="text-3xl font-bold text-amber-600">5x</div>
                      <div className="text-xs text-slate-500 mt-1">Competitor cited</div>
                    </div>
                  </div>

                  <div className="mt-5 border rounded-lg bg-white p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <CircleAlert className="h-4 w-4 text-amber-600" />
                      Why AI skips you
                    </div>
                    <ul className="mt-3 space-y-2 text-sm text-slate-600">
                      <li>No comparison pages for buyer queries</li>
                      <li>Thin third-party proof and review signals</li>
                      <li>FAQ content does not answer citation-ready questions</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="border-b bg-slate-50">
          <div className="max-w-6xl mx-auto px-6 py-14">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold">How the scan works</h2>
              <p className="mt-2 text-slate-600">
                Not an SEO checklist. A direct test of how answer engines talk about your category.
              </p>
            </div>
            <div className="mt-8 grid md:grid-cols-3 gap-4">
              {[
                ['1', 'Generate buyer questions', 'We create the comparison, problem-first, and alternatives queries your market actually asks.'],
                ['2', 'Ask the AI engines', 'We run those questions across answer engines and capture recommendations, rankings, and citations.'],
                ['3', 'Turn gaps into fixes', 'You get the missing proof, entity, content, and messaging work ranked by impact.'],
              ].map(([step, title, desc]) => (
                <div key={step} className="border rounded-lg bg-white p-5">
                  <div className="h-8 w-8 rounded-full bg-slate-950 text-white flex items-center justify-center text-sm font-bold">
                    {step}
                  </div>
                  <h3 className="font-semibold mt-4">{title}</h3>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="audit" className="border-b">
          <div className="max-w-6xl mx-auto px-6 py-14">
            <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-10">
              <div>
                <Badge variant="secondary" className="mb-4 bg-slate-100">What you get</Badge>
                <h2 className="text-3xl font-bold tracking-tight">A report built around visibility, not vanity.</h2>
                <p className="mt-4 text-slate-600 leading-relaxed">
                  ClearSignal combines live answer-engine checks with conversion messaging analysis,
                  so the recommendations improve both AI citations and human buyer clarity.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {auditItems.map((item) => (
                  <div key={item.title} className="border rounded-lg p-5">
                    <item.icon className="h-5 w-5 text-slate-900" />
                    <h3 className="font-semibold mt-4">{item.title}</h3>
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b bg-slate-950 text-white">
          <div className="max-w-6xl mx-auto px-6 py-12 grid md:grid-cols-3 gap-6">
            {[
              ['31/100', 'Average AI visibility uncovered in sample audits'],
              ['3 engines', 'Compare recommendations across multiple answer engines'],
              ['10 fixes', 'Prioritized actions for content, proof, and citation readiness'],
            ].map(([value, label]) => (
              <div key={value}>
                <div className="text-4xl font-bold">{value}</div>
                <div className="text-sm text-slate-300 mt-2 max-w-xs">{label}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="bg-slate-50">
          <div className="max-w-6xl mx-auto px-6 py-16">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold">Simple pricing</h2>
              <p className="text-slate-600 mt-3">
                Agencies charge $3K-$6K and take weeks. ClearSignal gives you a focused AI
                visibility audit for EUR 399.
              </p>
            </div>

            <div className="mt-10 border rounded-lg bg-white p-6 max-w-lg mx-auto shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-slate-500">Automated AI Visibility Audit</div>
                  <div className="text-5xl font-bold mt-2">EUR 399</div>
                </div>
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  Paid once
                </Badge>
              </div>

              <div className="mt-6 border rounded-lg bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <FileSearch className="h-4 w-4" />
                  Delivered as PDF + web dashboard
                </div>
              </div>

              <ul className="text-sm space-y-3 mt-6">
                {deliverables.map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <Link href="/score" className="block mt-7">
                <Button className="w-full gap-2" size="lg">
                  Start with a free score <Sparkles className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between text-sm text-slate-500">
          <span>ClearSignal -- B2B SaaS AI visibility audits</span>
          <span>GEO / AEO measurement for answer engines</span>
        </div>
      </footer>
    </div>
  )
}
