import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Zap, BarChart3, Target, Search, CheckCircle } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="border-b">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight">ClearSignal</span>
          <Link href="/score">
            <Button variant="outline" size="sm">Free AI visibility check</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
        <Badge variant="secondary" className="mb-5">GEO / Answer Engine Optimization</Badge>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
          Does ChatGPT recommend you —<br />
          or your competitor?
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Buyers now ask ChatGPT, Perplexity and Google&apos;s AI which tool to use. ClearSignal
          measures whether AI assistants actually recommend your B2B SaaS — then tells you exactly
          what to fix to get cited.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
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
        <p className="mt-4 text-xs text-muted-foreground">
          We ask real AI engines the questions your buyers ask — and show you who they name.
        </p>
      </section>

      {/* How it works */}
      <section className="border-t bg-muted/30">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-center mb-12">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-lg font-bold">1</div>
              <h3 className="font-semibold mb-2">Get your free score</h3>
              <p className="text-sm text-muted-foreground">Enter your URL. We ask real AI engines what your buyers ask and measure if you&apos;re named.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-lg font-bold">2</div>
              <h3 className="font-semibold mb-2">Order your audit</h3>
              <p className="text-sm text-muted-foreground">Pay once. We probe ChatGPT, Perplexity &amp; Google AI across your buying queries and competitors.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-lg font-bold">3</div>
              <h3 className="font-semibold mb-2">Get your action plan</h3>
              <p className="text-sm text-muted-foreground">Receive the exact content gaps costing you citations, plus a prioritized fix list.</p>
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
              { icon: Search, title: 'AI Visibility measurement', desc: 'We query ChatGPT, Perplexity & Google AI with your buyers’ questions and measure how often — and where — you get named and cited.' },
              { icon: BarChart3, title: 'Share-of-voice vs competitors', desc: 'See exactly who AI recommends instead of you, and your share of voice across buying queries.' },
              { icon: Target, title: 'Citation gap analysis', desc: 'The specific content, entity and structure signals the cited sources have and you don’t — the reasons AI skips you.' },
              { icon: Zap, title: 'Prioritized action plan', desc: '10 specific fixes to get cited more, ranked by impact and effort. Plus messaging-clarity scoring.' },
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
                'AI visibility across ChatGPT, Perplexity & Google',
                'Share-of-voice vs up to 3 competitors',
                'Citation gap analysis — why AI skips you',
                'Full messaging clarity analysis',
                '10 prioritized fixes to get cited',
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
