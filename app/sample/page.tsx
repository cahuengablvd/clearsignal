import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RoleExport } from '@/components/role-export'
import { CopyButton } from '@/components/copy-button'
import { PublicPageHeader } from '@/components/public-page-header'
import { buildJsonLd } from '@/lib/materials'
import { priorityForFix } from '@/lib/prioritization'
import { AUDIT_PRODUCT_LABEL } from '@/lib/audit-label'
import {
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
    excerpt:
      'For mid-market SaaS teams, the most recommended platforms are Competitor A (best for zero-downtime deploys) and Competitor B. Both are widely reviewed on G2 and have clear comparison pages...',
  },
  {
    question: 'how to ship product updates without downtime',
    engine: 'Perplexity',
    named: ['Competitor A', 'Example SaaS'],
    cited: ['reddit.com', 'competitor-a.com'],
    status: 'Mentioned',
    tone: 'warn',
    excerpt:
      'Several tools handle zero-downtime releases. Competitor A is the most cited option; Example SaaS is also mentioned as an alternative, though with less third-party coverage...',
  },
  {
    question: 'best alternatives to Competitor A for SaaS engineering teams',
    engine: 'Claude',
    named: ['Competitor A', 'Competitor C'],
    cited: ['g2.com', 'capterra.com'],
    status: 'Not named',
    tone: 'risk',
    excerpt:
      'Popular alternatives to Competitor A include Competitor C and a few others, based on G2 and Capterra roundups. (Example SaaS is not surfaced for this query.)...',
  },
  {
    question: 'AI-ready deployment tools for B2B SaaS',
    engine: 'Google AI',
    named: ['Example SaaS'],
    cited: ['example-saas.com'],
    status: 'Cited',
    tone: 'ok',
    excerpt:
      'Example SaaS positions itself for AI-ready deployment workflows, citing its own documentation. It appears for this narrower query where competitor content is thinner...',
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

const sampleJsonLd = buildJsonLd('Example SaaS', 'https://example-saas.com', [
  {
    question: 'What is the best deployment platform for mid-market SaaS?',
    answer: 'Example SaaS focuses on zero-downtime deploys for product and engineering teams of 50-500.',
  },
  {
    question: 'How is Example SaaS different from Competitor A?',
    answer: 'It pairs zero-downtime releases with a simpler setup aimed at mid-market teams.',
  },
])

const sourceGaps = [
  {
    cited_source: 'g2.com',
    why: 'A review aggregator with category landing pages, star ratings, and side-by-side comparisons - exactly the structured, citable content answer engines quote.',
    has: ['Comparison / alternatives page', 'Review / proof signals', 'Clear category language', 'Third-party authority'],
    missing: ['Review / proof signals', 'Clear category language'],
    fix: 'Claim and complete a G2/Capterra profile and seed it with named-customer reviews.',
  },
  {
    cited_source: 'competitor-a.com',
    why: 'Has a dedicated "alternatives" page and FAQ sections that directly answer buyer questions in quotable language.',
    has: ['Comparison / alternatives page', 'FAQ / Q&A structure', 'Specific ICP language', 'Pricing / use-case content'],
    missing: ['Comparison / alternatives page', 'FAQ / Q&A structure'],
    fix: 'Publish a "[You] vs alternatives" page plus an FAQ block answering the exact tested queries.',
  },
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
    desc: 'Create a neutral "Competitor A alternatives" page answering use cases, tradeoffs, pricing signals, and who each tool is best for.',
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
    desc: 'Change "Get Started" to "Book a 15-min deployment demo" so the next step matches buyer intent.',
    impact: 'medium',
    effort: 'easy',
    category: 'cta',
  },
]

function statusClass(tone: string) {
  if (tone === 'risk') return 'border-[#E6BEB1] bg-[#FFF3EE] text-[#94402D]'
  if (tone === 'warn') return 'border-[#E7D3A8] bg-[#FFF8E9] text-[#8B5E1B]'
  if (tone === 'ok') return 'border-[#BBD8C4] bg-[#F2F8F3] text-[#35654D]'
  return 'border-[#E5D7C5] bg-[#FBF6EE] text-[#5F4D42]'
}

function statusIcon(tone: string) {
  if (tone === 'ok') return CheckCircle
  if (tone === 'warn') return CircleAlert
  return ShieldAlert
}

function impactClass(impact: string) {
  if (impact === 'high') return 'bg-[#FFF3EE] text-[#94402D] border-[#E6BEB1]'
  return 'bg-[#FFF8E9] text-[#8B5E1B] border-[#E7D3A8]'
}

function priorityClass(bucket: string) {
  if (bucket === 'Do now') return 'bg-[#F2F8F3] text-[#35654D] border-[#BBD8C4]'
  if (bucket === 'This month') return 'bg-[#F2F1EA] text-[#5F5946] border-[#D8D3C2]'
  if (bucket === 'Later') return 'bg-[#FFF8E9] text-[#8B5E1B] border-[#E7D3A8]'
  return 'bg-[#FBF6EE] text-[#5F4D42] border-[#E5D7C5]'
}

export default function SampleReportPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FBF6EE] text-[#2E2116] [&_button]:min-h-11">
      <PublicPageHeader actionHref="/score" actionLabel="Get your free score" />

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 rounded-xl border border-[#E7D3A8] bg-[#FFF8E9] p-4">
          <p className="text-sm font-medium text-[#7C571E]">
            Sample report for demo purposes. Data is fictional, but mirrors the structure of a paid ClearSignal audit.
          </p>
        </div>

        <section className="grid items-start gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="min-w-0">
            <Badge className="mb-4 border border-[#D9C3AC] bg-[#FFF9F2] text-[#8C421A] hover:bg-[#FFF9F2]">
              {AUDIT_PRODUCT_LABEL}
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
              Example SaaS is visible, but competitors own the recommendations.
            </h1>
            <p className="mt-4 text-[#8D7B6B]">https://example-saas.com</p>
            <p className="mt-4 text-lg leading-relaxed text-[#6E5A50]">
              Across 18 answer-engine results, Example SaaS appeared in only 22% of answers
              and was cited once. Competitors with comparison pages, review profiles, and clearer
              proof signals dominate the buyer discovery moment.
            </p>
          </div>

          <Card className="min-w-0 border-[#E6BEB1] bg-[#FFF8F4] shadow-[0_22px_70px_rgba(78,49,27,0.10)]">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-[#6E5A50]">AI Visibility Score</div>
                  <div className="mt-2 text-7xl font-bold tracking-tight text-[#A64B35]">31</div>
                  <div className="mt-1 text-sm text-[#6E5A50]">out of 100</div>
                </div>
                <Badge className="max-w-full whitespace-normal border-[#DCCDBA] bg-white/70 text-right text-[#5B493F]">ChatGPT, Claude, Perplexity</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3 mt-6">
                {scoreCards.map((card) => (
                  <div key={card.label} className="rounded-lg border border-[#E5D7C5] bg-white/80 p-3">
                    <div className={card.tone === 'risk' ? 'text-2xl font-bold text-[#A64B35]' : card.tone === 'warn' ? 'text-2xl font-bold text-[#9A6A20]' : 'text-2xl font-bold'}>
                      {card.value}
                    </div>
                    <div className="mt-1 text-xs text-[#756257]">{card.label}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <Card className="mt-8 border-[#E5D7C5] bg-[#FFFDF9] shadow-sm">
          <CardContent className="p-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#A9531F]">
              Executive summary
            </div>
            <p className="leading-relaxed text-[#5F4D42]">
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
              <p className="mt-1 text-sm text-[#756257]">
                The paid report shows the actual buyer questions tested and who appeared in the answers.
              </p>
            </div>
            <Badge variant="outline">18 engine results</Badge>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#E5D7C5] bg-[#FFFDF9]">
            <div className="hidden border-b border-[#E5D7C5] bg-[#F7EFE4] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#756257] md:grid md:grid-cols-[1fr_8rem_1fr_9rem] md:gap-4">
              <div>Buyer question</div>
              <div>Engine</div>
              <div>Who AI named / cited</div>
              <div className="text-right">Your status</div>
            </div>
            <div className="divide-y divide-[#E8DCCB]">
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
            <ul className="space-y-2 text-sm text-[#5F4D42]">
              {citationGaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          </InsightCard>
        </section>

        <section className="mt-8">
          <div className="flex items-center gap-2 mb-1">
            <FileSearch className="h-5 w-5" />
            <h2 className="text-xl font-bold">Why these sources get cited (and you don&apos;t)</h2>
          </div>
          <p className="mb-4 text-sm text-[#756257]">
            We scrape the pages AI actually cites and compare their citation signals to your site.
          </p>
          <div className="grid gap-3">
            {sourceGaps.map((s) => (
              <Card key={s.cited_source} className="border-[#E5D7C5] bg-[#FFFDF9]">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h3 className="font-semibold">{s.cited_source}</h3>
                    <Badge variant="outline">cited source</Badge>
                  </div>
                  <p className="mb-3 text-sm text-[#756257]">{s.why}</p>
                  <div className="mb-3">
                    <div className="text-xs font-medium mb-1">This source has:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {s.has.map((sig) => (
                        <span key={sig} className="rounded-full border border-[#E5D7C5] bg-[#FBF6EE] px-2 py-0.5 text-xs text-[#6E5A50]">
                          {sig}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="mb-1 text-xs font-medium text-[#94402D]">You&apos;re missing:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {s.missing.map((sig) => (
                        <span key={sig} className="rounded-full border border-[#E6BEB1] bg-[#FFF3EE] px-2 py-0.5 text-xs text-[#94402D]">
                          {sig}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded border border-[#BBD8C4] bg-[#F2F8F3] p-3 text-sm">
                    <span className="font-medium text-[#35654D]">Fix:</span>{' '}
                    <span className="text-[#2F5844]">{s.fix}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-center gap-2 mb-1">
            <Search className="h-5 w-5" />
            <h2 className="text-xl font-bold">Verified signals</h2>
          </div>
          <p className="mb-4 text-sm text-[#756257]">
            Detected directly from the page - each with how it was checked and a confidence score.
          </p>
          <div className="grid gap-3">
            {[
              {
                label: 'Primary call-to-action',
                status: 'present',
                conf: 96,
                detail: 'A primary CTA element is present.',
                basis: 'Matched a button element in the rendered HTML',
                evidence: '<button>Get started</button>',
              },
              {
                label: 'Structured data (schema.org JSON-LD)',
                status: 'absent',
                conf: 88,
                detail: 'No JSON-LD structured data found - AI engines have fewer entity signals to cite.',
                basis: 'No application/ld+json script present in the rendered HTML',
                evidence: 'Checked rendered HTML head; no application/ld+json script found.',
              },
              {
                label: 'Social proof signals',
                status: 'unknown',
                conf: 45,
                detail: 'No textual social-proof signals found - verify whether logos/testimonials exist as images.',
                basis: 'No proof-related keywords found; visual logos may not be detectable from text',
                evidence: 'Crawler text did not include testimonial, review, logo, G2 or Capterra signals.',
              },
            ].map((f) => {
              const cls = f.status === 'present'
                ? 'bg-[#F2F8F3] text-[#35654D] border-[#BBD8C4]'
                : f.status === 'absent'
                  ? 'bg-[#FFF3EE] text-[#94402D] border-[#E6BEB1]'
                  : 'bg-[#FFF8E9] text-[#8B5E1B] border-[#E7D3A8]'
              const label = f.status === 'present' ? 'detected present' : f.status === 'absent' ? 'verified absent' : 'manual verification'
              return (
                <Card key={f.label} className="border-[#E5D7C5] bg-[#FFFDF9]">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <h3 className="font-semibold text-sm">{f.label}</h3>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={cls}>{label}</Badge>
                        <span className="font-mono text-xs text-[#8D7B6B]">{f.conf}%</span>
                      </div>
                    </div>
                    <p className="text-sm text-[#6E5A50]">{f.detail}</p>
                    <p className="mt-2 text-xs text-[#8D7B6B]"><span className="font-medium">How checked:</span> {f.basis}</p>
                    <details className="mt-3 text-xs">
                      <summary className="cursor-pointer font-medium text-[#8D7B6B] hover:text-[#4B3424]">Evidence details</summary>
                      <div className="mt-2 rounded border border-[#E5D7C5] bg-[#FBF6EE] p-3 text-[#6E5A50]">
                        <div><span className="font-medium text-[#2E2116]">URL:</span> https://example-saas.com</div>
                        <div><span className="font-medium text-[#2E2116]">Checked:</span> sample timestamp</div>
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-[#FFFDF9] p-2">{f.evidence}</pre>
                      </div>
                    </details>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-5 w-5" />
            <h2 className="text-xl font-bold">Messaging clarity</h2>
          </div>
          <div className="grid md:grid-cols-5 gap-3">
            {clarityScores.map(([label, score, severity]) => (
              <Card key={label} className={severity === 'critical' ? 'border-[#E6BEB1] bg-[#FFF3EE]' : 'border-[#E7D3A8] bg-[#FFF8E9]'}>
                <CardContent className="p-4">
                  <div className="text-sm font-medium">{label}</div>
                  <div className={severity === 'critical' ? 'mt-3 text-3xl font-bold text-[#A64B35]' : 'mt-3 text-3xl font-bold text-[#9A6A20]'}>
                    {score}
                  </div>
                  <div className="mt-1 text-xs text-[#756257]">out of 100</div>
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
            {fixes.map((fix, index) => {
              const priority = priorityForFix(fix)
              return (
                <Card key={fix.title} className="border-[#E5D7C5] bg-[#FFFDF9]">
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div>
                        <div className="mb-2 text-xs font-semibold text-[#A9531F]">Fix #{index + 1}</div>
                        <h3 className="font-semibold">{fix.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-[#6E5A50]">{fix.desc}</p>
                          <p className="mt-2 text-xs text-[#8D7B6B]">
                            Priority score: <span className="font-mono">{priority.score}</span> (Impact x Confidence / Effort; sample confidence 75%).
                          </p>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <Badge className={priorityClass(priority.bucket)}>{priority.bucket}</Badge>
                        <Badge className={impactClass(fix.impact)}>{fix.impact} impact</Badge>
                        <Badge variant="outline">{fix.effort}</Badge>
                        <Badge variant="outline">{fix.category}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-5 w-5" />
            <h2 className="text-xl font-bold">Hand off by role</h2>
          </div>
          <p className="mb-3 text-sm text-[#756257]">
            The same fixes, grouped by who should do them - copy a task list straight to the right person.
          </p>
          <RoleExport
            label="example-saas.com"
            fixes={fixes.map((f) => ({ title: f.title, description: f.desc, category: f.category }))}
          />
        </section>

        <section className="mt-8">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-5 w-5" />
            <h2 className="text-xl font-bold">Implementation briefs</h2>
          </div>
          <p className="mb-4 text-sm text-[#756257]">
            Each top fix as a ticket - concrete steps and acceptance criteria you can check off.
          </p>
          <div className="grid gap-3">
            {[
              {
                title: 'Add Organization + FAQPage schema',
                steps: ['Generate JSON-LD from the FAQ block', 'Paste it into the homepage <head>'],
                criteria: ['Done when Google Rich Results Test parses the JSON-LD with no errors'],
              },
              {
                title: 'Publish a "vs Competitor A" comparison page',
                steps: ['Draft a neutral comparison covering use cases, pricing, and fit', 'Link it from the nav and footer'],
                criteria: ['Done when the page is live and indexable (returns 200, not noindex)'],
              },
            ].map((b) => (
              <Card key={b.title} className="border-[#E5D7C5] bg-[#FFFDF9]">
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-3">{b.title}</h3>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#8D7B6B]">Steps</div>
                  <ol className="mb-3 list-inside list-decimal space-y-1 text-sm text-[#6E5A50]">
                    {b.steps.map((s) => <li key={s}>{s}</li>)}
                  </ol>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#8D7B6B]">Acceptance criteria</div>
                  <ul className="text-sm space-y-1">
                    {b.criteria.map((c) => (
                      <li key={c} className="flex gap-2"><span className="text-[#40735B]">&#9744;</span><span>{c}</span></li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-center gap-2 mb-1">
            <FileSearch className="h-5 w-5" />
            <h2 className="text-xl font-bold">Draft copy for operator review</h2>
          </div>
          <p className="mb-4 text-sm text-[#756257]">
            Review these meta tags, FAQ, JSON-LD and CTA options before publishing.
          </p>
          <div className="grid gap-3">
            <Card className="border-[#E5D7C5] bg-[#FFFDF9]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <h3 className="font-semibold text-sm">Meta title</h3>
                  <CopyButton text="Deployment platform for mid-market SaaS teams | Example SaaS" />
                </div>
                <p className="text-sm text-[#6E5A50]">Deployment platform for mid-market SaaS teams | Example SaaS</p>
              </CardContent>
            </Card>
            <Card className="border-[#E5D7C5] bg-[#FFFDF9]">
              <CardContent className="p-4">
                <h3 className="font-semibold text-sm mb-2">FAQ (sample)</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium">What is the best deployment platform for mid-market SaaS?</p>
                    <p className="text-[#6E5A50]">Example SaaS focuses on zero-downtime deploys for product and engineering teams of 50-500.</p>
                  </div>
                  <div>
                    <p className="font-medium">How is Example SaaS different from Competitor A?</p>
                    <p className="text-[#6E5A50]">It pairs zero-downtime releases with a simpler setup aimed at mid-market teams.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-[#E5D7C5] bg-[#FFFDF9]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h3 className="font-semibold text-sm">Schema.org JSON-LD</h3>
                  <CopyButton text={sampleJsonLd} />
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-[#F7EFE4] p-3 text-xs text-[#5F4D42]">{sampleJsonLd}</pre>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mt-10 grid items-center gap-6 rounded-2xl border border-[#5C4331] bg-[#2E2116] p-6 text-white shadow-[0_24px_70px_rgba(46,33,22,0.18)] lg:grid-cols-[1fr_auto]">
          <div>
            <Badge className="bg-white/10 text-white border-white/20 mb-4">ClearSignal audit</Badge>
            <h2 className="text-2xl font-bold">Get this report for your own homepage.</h2>
            <p className="mt-3 max-w-2xl text-[#D8C8BA]">
              Start with a free AI visibility score, then unlock the full audit with competitor
              share-of-voice, cited-domain analysis, messaging gaps, and 10 prioritized fixes.
            </p>
          </div>
          <Link href="/score">
            <Button size="lg" variant="secondary" className="w-full gap-2 rounded-full bg-[#FFF7ED] text-[#2E2116] hover:bg-white lg:w-auto">
              Get your free AI visibility score <Sparkles className="h-4 w-4" />
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
    excerpt: string
  }
}) {
  const StatusIcon = statusIcon(row.tone)
  const named = [...new Set([...row.named, ...row.cited])]

  return (
    <div className="px-5 py-4 text-sm">
      <div className="grid md:grid-cols-[1fr_8rem_1fr_9rem] gap-3 md:gap-4">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#8D7B6B] md:hidden">Buyer question</div>
          <div className="font-medium leading-relaxed">{row.question}</div>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#8D7B6B] md:hidden">Engine</div>
          <Badge variant="outline">{row.engine}</Badge>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#8D7B6B] md:hidden">Who AI named / cited</div>
          <div className="flex flex-wrap gap-2">
            {named.map((item) => (
              <span key={item} className="rounded-full border border-[#E5D7C5] bg-[#FBF6EE] px-2 py-1 text-xs text-[#6E5A50]">
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="md:text-right">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#8D7B6B] md:hidden">Your status</div>
          <span className={`inline-flex items-center gap-1 border rounded-full px-3 py-1 text-xs font-medium ${statusClass(row.tone)}`}>
            <StatusIcon className="h-3 w-3" />
            {row.status}
          </span>
        </div>
      </div>
      <details className="mt-3">
        <summary className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-[#8D7B6B] hover:text-[#4B3424]">
          <FileSearch className="h-3 w-3" /> Show the actual AI answer
        </summary>
        <blockquote className="mt-2 border-l-2 border-[#D9C3AC] pl-3 text-xs italic leading-relaxed text-[#6E5A50]">
          {row.excerpt}
        </blockquote>
      </details>
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
    <Card className={tone === 'risk' ? 'border-[#E7D3A8] bg-[#FFF8E9]' : 'border-[#E5D7C5] bg-[#FFFDF9]'}>
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
      <span className="text-[#5F4D42]">{label}</span>
      <span className="font-mono text-[#8D7B6B]">{value}</span>
    </div>
  )
}
