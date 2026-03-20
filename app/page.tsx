import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, Zap, BarChart3, Target, Search, CheckCircle } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="border-b">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight">ClearSignal</span>
          <Link href="/score">
            <Button variant="outline" size="sm">Get free score</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
          Your site is getting traffic.<br />
          It&apos;s not getting enough conversions.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          ClearSignal audits your B2B SaaS homepage — messaging, competitive gaps, and AI-search
          visibility — and tells you exactly what to fix first. In 48 hours.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/score">
            <Button size="lg" className="gap-2">
              Get your free ClearSignal score <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/sample">
            <Button variant="outline" size="lg">
              See a sample report
            </Button>
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t bg-muted/30">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-center mb-12">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-lg font-bold">1</div>
              <h3 className="font-semibold mb-2">Get your free score</h3>
              <p className="text-sm text-muted-foreground">Enter your URL and get a 5-dimension clarity score in seconds.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-lg font-bold">2</div>
              <h3 className="font-semibold mb-2">Order your audit</h3>
              <p className="text-sm text-muted-foreground">Pay once. We analyze your homepage, competitors, and AI-search readiness.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-lg font-bold">3</div>
              <h3 className="font-semibold mb-2">Get your action plan</h3>
              <p className="text-sm text-muted-foreground">Receive a prioritized fix list, competitor intel, and rewritten outreach messages.</p>
            </div>
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="border-t">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-center mb-12">What&apos;s in the audit</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              { icon: Target, title: 'Messaging clarity analysis', desc: 'ICP visibility, headline strength, CTA effectiveness, and trust proof quality — scored and explained.' },
              { icon: BarChart3, title: 'Competitive gap analysis', desc: 'Side-by-side comparison of your homepage against up to 3 competitors. Where you win, where you lose.' },
              { icon: Search, title: 'AI-search visibility', desc: 'Heuristic assessment of how likely AI search tools are to cite your content.' },
              { icon: Zap, title: 'Prioritized action plan', desc: '10 specific fixes ranked by impact and effort. Plus 3 rewritten outreach messages.' },
            ].map((item) => (
              <div key={item.title} className="flex gap-4 p-4">
                <item.icon className="h-6 w-6 mt-0.5 shrink-0 text-primary" />
                <div>
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t bg-muted/30">
        <div className="max-w-2xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl font-bold mb-4">Simple pricing</h2>
          <p className="text-muted-foreground mb-8">
            Agencies charge $3K–$6K and take weeks.<br />
            We charge €399 and deliver fast.
          </p>
          <div className="border rounded-xl bg-card p-8 max-w-md mx-auto">
            <div className="text-sm font-medium text-muted-foreground mb-2">Automated Audit</div>
            <div className="text-4xl font-bold mb-4">€399</div>
            <ul className="text-sm text-left space-y-2 mb-6">
              {[
                'Full messaging clarity analysis',
                'Competitor gap analysis (up to 3)',
                'AI-search visibility assessment',
                '10 prioritized fixes',
                '3 rewritten outreach messages',
                'PDF report + web dashboard',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link href="/score">
              <Button className="w-full" size="lg">
                Start with a free score
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="max-w-5xl mx-auto px-6 py-8 text-center text-sm text-muted-foreground">
          ClearSignal — B2B SaaS homepage audits
        </div>
      </footer>
    </div>
  )
}
