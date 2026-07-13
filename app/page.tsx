'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, FileText, HelpCircle, Link2, MapPinned, Minus, Plus } from 'lucide-react'

const BACKGROUNDS = [
  { src: '/hero-bg-1.jpg', label: 'A1' },
]

const COPPER = '#A9531F'
const ESPRESSO = '#2E2116'
const INK = '#3D2E22' // high-contrast supporting text
const NAV_ITEMS = [
  { label: 'Workflow', href: '#workflow' },
  { label: 'What you get', href: '#what-you-get' },
  { label: 'Pricing', href: '#pricing' },
]

const AUDIENCES = [
  {
    name: 'Agencies',
    copy: 'Answer the question clients are already asking: "What does AI say about us?" ClearSignal turns AI visibility gaps into competitor evidence, source issues and implementation work you can run for client websites.',
    cta: 'Get your free AI visibility score',
  },
  {
    name: 'SaaS & B2B teams',
    copy: 'See which competitors AI recommends, which sources it trusts, and what your website is missing before buyers reach a shortlist.',
    cta: 'Get your free AI visibility score',
  },
  {
    name: 'Service businesses',
    copy: '"Who should I hire for this?" is now an AI conversation. See who AI recommends, which sources it trusts, and where your website falls short.',
    cta: 'Get your free AI visibility score',
  },
]

const PRICING_AUDIT = [
  'AI visibility scan across ChatGPT, Claude and Perplexity',
  'Buyer-intent query set',
  'Competitor and citation gap analysis',
  'Website clarity and trust review',
  'Prioritized action plan',
  'Draft FAQ, meta and schema suggestions',
  'PDF report + web dashboard',
  'Human review before delivery',
]
const MOBILE_PRICING_AUDIT = PRICING_AUDIT.filter((item) =>
  [
    'AI visibility scan across ChatGPT, Claude and Perplexity',
    'Buyer-intent query set',
    'Competitor and citation gap analysis',
    'Website clarity and trust review',
    'Prioritized action plan',
    'Human review before delivery',
  ].includes(item)
)
const FAQS = [
  {
    q: 'What happens after the free score?',
    a: 'The free check gives you an initial visibility snapshot. You can then order the full expert-reviewed audit for competitor evidence, website gaps and a prioritized implementation plan.',
  },
  {
    q: 'Is this just an SEO audit?',
    a: 'No. SEO audits inspect search-engine signals. ClearSignal tests how AI answer engines describe and recommend your business, then connects those gaps to your website content, proof, structure and messaging.',
  },
  {
    q: 'Is this fully automated?',
    a: 'The free score is automated. The full founding audit is reviewed by a person before delivery to catch factual issues, unsupported claims and unclear recommendations. No Google Analytics or Search Console access is required for the first audit.',
  },
  {
    q: 'How long does the full audit take?',
    a: "Founding audits are reviewed manually before delivery. You'll receive an estimated delivery window before the audit starts.",
  },
  {
    q: 'Can you guarantee AI will recommend my business?',
    a: 'No. ClearSignal measures a tested query set and identifies signals that may improve visibility, citations and recommendations. AI results change over time.',
  },
  {
    q: 'Can agencies use ClearSignal for client audits?',
    a: 'Yes. Agencies can use ClearSignal to identify AI visibility gaps, source and citation issues, and implementation work for client websites. White-label and multi-client workflows are being tested during the founding phase.',
  },
  {
    q: 'What happens if my business is not mentioned by AI at all?',
    a: 'That is useful evidence. The audit shows which competitors or sources appear instead, which signals are missing, and what to fix first to become easier for answer engines to understand and cite.',
  },
  {
    q: 'Why not just ask ChatGPT myself?',
    a: 'You can. ChatGPT gives a single generic opinion. ClearSignal runs a structured buyer-query set across multiple AI engines, stores evidence, compares competitors, identifies cited sources, calculates visibility metrics and turns the findings into an implementation plan.',
  },
]

/* ---------- Engine logos (monochrome, nominative badges) ---------- */
function OpenAILogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M22.28 9.82a5.98 5.98 0 0 0-.51-4.91 6.05 6.05 0 0 0-6.51-2.9A6.07 6.07 0 0 0 4.98 4.18a5.98 5.98 0 0 0-4 2.9 6.05 6.05 0 0 0 .74 7.1 5.98 5.98 0 0 0 .51 4.9 6.05 6.05 0 0 0 6.52 2.9A5.98 5.98 0 0 0 13.26 24a6.06 6.06 0 0 0 5.77-4.21 5.99 5.99 0 0 0 4-2.9 6.06 6.06 0 0 0-.75-7.07Zm-9.02 12.6a4.48 4.48 0 0 1-2.88-1.04l.14-.08 4.78-2.76a.79.79 0 0 0 .39-.68v-6.74l2.02 1.17a.07.07 0 0 1 .04.05v5.58a4.5 4.5 0 0 1-4.49 4.5ZM3.6 18.3a4.47 4.47 0 0 1-.53-3.01l.14.08 4.78 2.76a.77.77 0 0 0 .78 0l5.84-3.37v2.33a.08.08 0 0 1-.03.06l-4.83 2.79A4.5 4.5 0 0 1 3.6 18.3ZM2.34 7.9a4.49 4.49 0 0 1 2.37-1.98v5.7a.77.77 0 0 0 .39.68l5.81 3.35-2.02 1.17a.08.08 0 0 1-.07 0l-4.83-2.79a4.5 4.5 0 0 1-1.65-6.13Zm16.6 3.85-5.84-3.4L15.12 7.2a.08.08 0 0 1 .07 0l4.83 2.79a4.49 4.49 0 0 1-.68 8.1v-5.67a.79.79 0 0 0-.4-.68Zm2.01-3.02-.14-.09-4.77-2.78a.78.78 0 0 0-.79 0L9.41 9.23V6.9a.07.07 0 0 1 .03-.06l4.83-2.79a4.5 4.5 0 0 1 6.68 4.66ZM8.31 12.86l-2.02-1.16a.08.08 0 0 1-.04-.06V6.07a4.5 4.5 0 0 1 7.38-3.45l-.14.08-4.78 2.76a.79.79 0 0 0-.39.68l-.01 6.72Zm1.1-2.36 2.6-1.5 2.61 1.5v3l-2.6 1.5-2.6-1.5v-3Z" />
    </svg>
  )
}
function PerplexityLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
      <path d="M12 3.5v17" />
      <path d="M4.5 8.5h15v5h-15z" />
      <path d="M12 8.5l6.5 5v-5m-6.5 5l-6.5 5v-5" />
      <path d="M12 13.5l6.5 4.5v-5m-6.5 5l-6.5 4.5v-5" />
    </svg>
  )
}
function AnthropicLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      {Array.from({ length: 12 }).map((_, i) => (
        <rect key={i} x="11.15" y="1.4" width="1.7" height="9.3" rx="0.85" transform={`rotate(${i * 30} 12 12)`} />
      ))}
    </svg>
  )
}
const ENGINES = [
  { name: 'ChatGPT', Logo: OpenAILogo },
  { name: 'Perplexity', Logo: PerplexityLogo },
  { name: 'Claude', Logo: AnthropicLogo },
]

/* ---------- Scroll reveal (respects prefers-reduced-motion) ---------- */
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true)
      return
    }
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(20px)',
        transition: `opacity 640ms cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 640ms cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

function GlassNav() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [blob, setBlob] = useState<{ left: number; width: number; visible: boolean }>({ left: 0, width: 0, visible: false })
  function moveBlob(e: React.MouseEvent<HTMLAnchorElement>) {
    const container = containerRef.current
    if (!container) return
    const cRect = container.getBoundingClientRect()
    const iRect = e.currentTarget.getBoundingClientRect()
    setBlob({ left: iRect.left - cRect.left, width: iRect.width, visible: true })
  }
  return (
    <div
      ref={containerRef}
      onMouseLeave={() => setBlob((b) => ({ ...b, visible: false }))}
      className="relative hidden items-center rounded-full border border-white/50 bg-white/35 px-1.5 py-1.5 shadow-[0_6px_24px_-14px_rgba(46,33,22,0.3)] md:flex"
      style={{ backdropFilter: 'blur(18px) saturate(1.5)', WebkitBackdropFilter: 'blur(18px) saturate(1.5)' }}
    >
      <span
        aria-hidden
        className="absolute top-1.5 bottom-1.5 rounded-full bg-white/70 shadow-sm"
        style={{
          left: blob.left,
          width: blob.width,
          opacity: blob.visible ? 1 : 0,
          transform: blob.visible ? 'scale(1)' : 'scale(0.85)',
          transition:
            'left 380ms cubic-bezier(0.22,1,0.36,1), width 380ms cubic-bezier(0.22,1,0.36,1), opacity 250ms ease, transform 250ms ease',
        }}
      />
      {NAV_ITEMS.map((item) => (
        <a key={item.label} href={item.href} onMouseEnter={moveBlob} className="relative z-10 rounded-full px-4 py-1.5 text-[14px] font-medium" style={{ color: INK }}>
          {item.label}
        </a>
      ))}
    </div>
  )
}

function StatusBadge({ kind }: { kind: 'named' | 'cited' | 'recommended' | 'missing' }) {
  const label = { named: 'Named', cited: 'Cited', recommended: 'Recommended', missing: 'Missing' }[kind]
  const missing = kind === 'missing'
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{
        borderColor: missing ? '#DFD5C7' : 'rgba(169,83,31,0.4)',
        color: missing ? '#9B8A78' : COPPER,
        backgroundColor: missing ? 'transparent' : 'rgba(169,83,31,0.06)',
      }}
    >
      {missing ? <Minus className="h-2.5 w-2.5" /> : <Check className="h-2.5 w-2.5" strokeWidth={3} />}
      {label}
    </span>
  )
}

/** Compact result chip used inside the product table. */
function ResultChip({ kind }: { kind: 'named' | 'cited' | 'miss' }) {
  if (kind === 'named')
    return <span className="rounded-md px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-white" style={{ backgroundColor: COPPER }}>Named</span>
  if (kind === 'cited')
    return <span className="rounded-md border px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wider" style={{ borderColor: 'rgba(169,83,31,0.45)', color: COPPER }}>Cited</span>
  return <span className="rounded-md border border-[#E4DACB] px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-[#A6957F]">Missing</span>
}

function SignalOverlay({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const line = tone === 'dark' ? 'rgba(46,33,22,0.05)' : 'rgba(255,255,255,0.07)'
  const path = tone === 'dark' ? 'rgba(169,83,31,0.10)' : 'rgba(233,169,107,0.18)'
  const node = tone === 'dark' ? 'rgba(169,83,31,0.16)' : 'rgba(233,169,107,0.3)'
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" style={{ opacity: 0.6 }}>
      <defs>
        <pattern id={`grid-${tone}`} width="90" height="90" patternUnits="userSpaceOnUse">
          <path d="M 90 0 L 0 0 0 90" fill="none" stroke={line} strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#grid-${tone})`} />
      <path d="M 120 180 C 340 120 520 260 760 200 S 1150 140 1520 220" fill="none" stroke={path} strokeWidth="1.2" strokeDasharray="1 7" />
      <path d="M 80 430 C 300 390 560 470 820 410 S 1250 360 1560 440" fill="none" stroke={path} strokeWidth="1" strokeDasharray="1 7" />
      {[[340, 132], [760, 200], [1150, 158], [560, 452], [1250, 372]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3" fill={node} />
      ))}
    </svg>
  )
}

function FloatingCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`absolute z-30 hidden rounded-xl border border-[#E9DECF] bg-white/95 px-4 py-2.5 shadow-[0_18px_40px_-20px_rgba(46,33,22,0.45)] backdrop-blur lg:block ${className || ''}`}>
      {children}
    </div>
  )
}

export default function LandingPage() {
  const bg = 0
  const [audience, setAudience] = useState(1)
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [tab, setTab] = useState(2) // Fix is the default product moment
  const engineScrollRef = useRef<HTMLDivElement>(null)

  return (
    <div className="min-h-screen bg-[#FBF6EE]" style={{ color: ESPRESSO }}>
      {/* ============ HERO ============ */}
      <section className="relative flex flex-col overflow-hidden lg:min-h-[92vh]">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[18%]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={BACKGROUNDS[bg].src} src={BACKGROUNDS[bg].src} alt="" className="h-full w-full object-cover object-center" />
          <div className="absolute inset-x-0 top-0 h-[48%] bg-gradient-to-b from-[#FBF6EE] via-[#FBF6EE]/75 to-transparent" />
          <div className="absolute inset-y-0 right-0 w-[62%] bg-gradient-to-l from-[#FBF6EE]/85 via-[#FBF6EE]/45 to-transparent" />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(60% 60% at 30% 42%, rgba(255,196,140,0.18), transparent 70%)' }} />
          <div className="absolute inset-x-0 bottom-0 h-[20%] bg-gradient-to-b from-transparent to-white" />
        </div>
        <SignalOverlay />

        {/* Balanced nav: logo left, links centered, CTA right */}
        <nav className="relative z-20 mx-auto flex w-full max-w-6xl items-center px-5 pt-5 sm:px-6 sm:pt-6">
          <div className="flex flex-1 justify-start">
            <span className="text-[16px] font-bold tracking-tight sm:text-[18px]" style={{ color: ESPRESSO }}>ClearSignal</span>
          </div>
          <GlassNav />
          <div className="flex flex-1 justify-end">
            <Link href="/score" className="rounded-full border border-[#E0D3C0] bg-white px-4 py-2 text-[12px] font-semibold shadow-sm transition-shadow duration-200 hover:shadow-md sm:px-5 sm:py-2.5 sm:text-[13px]">
              Get free score
            </Link>
          </div>
        </nav>

        <div className="relative z-20 mx-auto grid w-full max-w-6xl flex-1 items-center gap-4 px-5 pb-8 pt-10 sm:px-6 sm:pb-14 lg:grid-cols-[1fr_1fr] lg:gap-10 lg:pb-24 lg:pt-14">
          <div className="text-center lg:text-left">
            <div className="text-[11px] font-semibold uppercase tracking-[0.26em]" style={{ color: '#9E6238' }}>Expert-reviewed AI Visibility Audit</div>
            <h1 className="mt-5 text-[clamp(2.1rem,4.1vw,3.5rem)] font-semibold leading-[1.08] tracking-[-0.02em]">
              When buyers ask AI who to choose, does it recommend you &mdash; or your <span style={{ color: COPPER }}>competitor</span>?
            </h1>
            <p className="mx-auto mt-5 hidden max-w-md text-[15px] leading-relaxed text-[#6E5A50] sm:block lg:mx-0">
              ClearSignal tests the buyer questions that matter across ChatGPT, Claude and Perplexity, shows who appears instead of you, and delivers an expert-reviewed plan to improve your visibility.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 lg:mt-7 lg:justify-start">
              <Link href="/score" className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90" style={{ backgroundColor: ESPRESSO }}>
                Get your free AI visibility score <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/sample" className="inline-flex items-center rounded-full border border-[#E0D3C0] bg-white/90 px-6 py-3.5 text-sm font-semibold backdrop-blur transition-shadow duration-200 hover:shadow-md">View sample report</Link>
            </div>
            <p className="mt-2 text-[13px] font-medium lg:mt-5" style={{ color: INK }}>Start with a free score. Founding-client audits are &euro;149 for the first 20 businesses.</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:mt-4 lg:justify-start">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.18em]" style={{ color: '#7A6857' }}>Tested across</span>
              <div className="flex items-center gap-5" style={{ color: INK }}>
                {ENGINES.map(({ name, Logo }) => (
                  <span key={name} className="flex items-center gap-1.5" title={name}>
                    <Logo className="h-[18px] w-[18px]" />
                    <span className="text-[12.5px] font-semibold">{name}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Phone group: composed as one visual */}
          <div className="relative -my-24 flex scale-[0.78] justify-center sm:my-0 sm:scale-100">
            {/* depth behind the phone */}
            <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-[30rem] w-[30rem] rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,186,128,0.35) 0%, rgba(255,205,160,0.12) 45%, transparent 70%)', filter: 'blur(12px)' }} />
              <div className="absolute h-[30rem] w-[23rem] rotate-6 rounded-[3rem] border border-white/60 bg-white/25 shadow-[0_40px_100px_-50px_rgba(46,33,22,0.4)]" style={{ backdropFilter: 'blur(6px)' }} />
            </div>

            <div className="relative z-10 w-[280px] sm:w-[326px]">
              <FloatingCard className="-left-24 top-14">
                <div className="text-[10px] uppercase tracking-wider text-[#8D7B6B]">Mention rate</div>
                <div className="mt-0.5 text-[18px] font-semibold" style={{ color: ESPRESSO }}>21% <span className="text-[11px] font-medium text-[#9B8A78]">of 14 queries</span></div>
              </FloatingCard>
              <FloatingCard className="-right-20 top-36 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ backgroundColor: COPPER }}><Check className="h-3 w-3" strokeWidth={3} /></span>
                <span className="text-[12.5px] font-medium">Cited by Perplexity</span>
              </FloatingCard>
              <FloatingCard className="-left-16 bottom-36 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COPPER }} />
                <span className="text-[12.5px] font-medium">3 priority fixes found</span>
              </FloatingCard>
              <FloatingCard className="-right-14 bottom-16 flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5" style={{ color: COPPER }} />
                <span className="text-[12.5px] font-medium">Source gap detected</span>
              </FloatingCard>

              <div className="rounded-[3rem] border-[7px] border-[#221913] bg-[#221913] shadow-[0_50px_100px_-35px_rgba(46,33,22,0.5)] sm:rounded-[3.4rem]">
                <div className="relative flex h-[560px] flex-col overflow-hidden rounded-[2.55rem] bg-white sm:h-[664px] sm:rounded-[2.95rem]">
                  <div className="absolute left-1/2 top-3 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-[#221913]" />
                  <div className="flex flex-1 flex-col px-5 pb-5 pt-14">
                    <div className="text-[11px] font-medium uppercase tracking-widest text-[#B4A69A]">AI assistant</div>
                    <div className="mt-5 flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#F4EFE7] px-4 py-3 text-[13.5px] font-medium">best movers in Toronto?</div>
                    </div>
                    <div className="mt-5 text-[13.5px] leading-relaxed text-[#5C5148]">Here are the movers I&rsquo;d recommend:</div>
                    <div className="mt-3 space-y-2.5">
                      <div className="flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 shadow-[0_10px_28px_-16px_rgba(169,83,31,0.4)]" style={{ borderColor: 'rgba(169,83,31,0.4)' }}>
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: COPPER }}><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
                        <div>
                          <div className="text-[13.5px] font-semibold">Your Business</div>
                          <div className="text-[11px]" style={{ color: COPPER }}>named &amp; cited &mdash; yourbusiness.com</div>
                        </div>
                      </div>
                      {['Competitor A', 'Competitor B'].map((c, i) => (
                        <div key={c} className="flex items-center gap-3 rounded-2xl bg-[#F7F3EC] px-4 py-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E7DECF] text-[11px] font-bold text-[#93857A]">{i + 2}</span>
                          <div className="text-[13.5px] text-[#93857A]">{c}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 text-center text-[11px] text-[#B4A69A]">A result ClearSignal helps you work toward</div>
                    <div className="mt-auto flex items-center justify-between rounded-full border border-[#EDE5D9] bg-white px-4 py-3 shadow-sm">
                      <span className="text-[12.5px] text-[#B4A69A]">Ask me anything&hellip;</span>
                      <span className="h-5 w-5 rounded-full" style={{ backgroundColor: COPPER }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ SECTION 2: USE CASES ============ */}
      <section className="border-t border-[#EDE5D9] bg-white">
        <div className="mx-auto grid max-w-6xl items-start gap-14 px-6 py-24 lg:grid-cols-2">
          <div className="flex flex-col">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: '#9E6238' }}>Who it&rsquo;s for</div>
            <h2 className="mt-4 max-w-md text-[clamp(1.7rem,3vw,2.4rem)] font-semibold leading-[1.12] tracking-[-0.01em]">Built for teams whose buyers ask AI before they buy.</h2>
            <div className="mt-8 space-y-2">
              {AUDIENCES.map((a, i) => {
                const active = audience === i
                return (
                  <button
                    key={a.name}
                    onMouseEnter={() => setAudience(i)}
                    onClick={() => setAudience(i)}
                    className="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-300"
                    style={{
                      borderColor: active ? 'rgba(169,83,31,0.35)' : '#EDE5D9',
                      backgroundColor: active ? '#FFF7EF' : 'transparent',
                      boxShadow: active ? '0 10px 30px -20px rgba(169,83,31,0.5)' : 'none',
                    }}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold" style={{ backgroundColor: active ? COPPER : '#F0E9DF', color: active ? '#fff' : '#B3A491' }}>{i + 1}</span>
                    <span className="flex-1 text-[16px] font-medium" style={{ color: active ? ESPRESSO : '#9B8A78' }}>{a.name}</span>
                    <ArrowRight className="h-4 w-4 transition-opacity duration-300" style={{ color: COPPER, opacity: active ? 1 : 0 }} />
                  </button>
                )
              })}
            </div>
            <p className="mt-6 max-w-sm text-[14.5px] leading-relaxed text-[#6E5A50]">{AUDIENCES[audience].copy}</p>
            <div className="mt-6">
              <Link href="/score" className="inline-flex items-center gap-2 rounded-full border border-[#E0D3C0] bg-white px-6 py-3 text-sm font-semibold transition-shadow duration-200 hover:shadow-md">
                {AUDIENCES[audience].cta} <ArrowRight className="h-4 w-4" style={{ color: COPPER }} />
              </Link>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-[#EDE5D9] bg-[#FBF6EE] p-5 shadow-[0_30px_70px_-45px_rgba(46,33,22,0.4)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero-bg-6.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
            <div className="relative">
              <div className="mb-4 flex items-center justify-between px-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: '#9E6238' }}>Audit preview</div>
                <div className="text-[11px] font-medium text-[#8D7B6B]">yourbusiness.com</div>
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-[#EDE5D9] bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10.5px] uppercase tracking-wider text-[#8D7B6B]">AI Visibility Score</div>
                      <div className="mt-1 text-[34px] font-semibold leading-none" style={{ color: ESPRESSO }}>34<span className="text-[15px] font-medium text-[#B4A69A]">/100</span></div>
                      <div className="mt-1.5 text-[11px] text-[#8D7B6B]">14 queries &times; 3 engines</div>
                    </div>
                    <svg width="72" height="72" viewBox="0 0 72 72">
                      <circle cx="36" cy="36" r="30" fill="none" stroke="#EFE9E0" strokeWidth="7" />
                      <circle cx="36" cy="36" r="30" fill="none" stroke={COPPER} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${0.34 * 188} 188`} transform="rotate(-90 36 36)" />
                    </svg>
                  </div>
                </div>
                <div className="rounded-2xl border border-[#EDE5D9] bg-white p-5 shadow-sm">
                  <div className="text-[10.5px] uppercase tracking-wider text-[#8D7B6B]">Engine breakdown</div>
                  <div className="mt-3 space-y-2.5">
                    {[
                      { Logo: OpenAILogo, engine: 'ChatGPT', badge: 'missing' as const, note: 'competitors named instead' },
                      { Logo: PerplexityLogo, engine: 'Perplexity', badge: 'cited' as const, note: 'in cited sources' },
                      { Logo: AnthropicLogo, engine: 'Claude', badge: 'named' as const, note: 'position #2 of 5' },
                    ].map(({ Logo, engine, badge, note }) => (
                      <div key={engine} className="flex items-center gap-2.5">
                        <Logo className="h-4 w-4 shrink-0 text-[#3D2E22]" />
                        <span className="w-[74px] text-[13px] font-semibold">{engine}</span>
                        <span className="flex-1 truncate text-right text-[11px] text-[#8D7B6B]">{note}</span>
                        <StatusBadge kind={badge} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-[#EDE5D9] bg-white p-5 shadow-sm">
                  <div className="text-[10.5px] uppercase tracking-wider text-[#8D7B6B]">Top source gap</div>
                  <div className="mt-2 text-[13px] leading-relaxed text-[#5C5148]">AI answers cite local comparison articles &mdash; your business isn&rsquo;t in any of the top 3 cited sources.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ SECTION 3: WHY AI ANSWERS MATTER ============ */}
      <section className="border-t border-[#EDE5D9] bg-[#FBF6EE]">
        <div className="mx-auto max-w-[1120px] px-6 py-20">
          <Reveal className="mx-auto max-w-2xl text-center">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: '#9E6238' }}>The method</div>
            <h2 className="mt-4 text-[clamp(1.9rem,3.6vw,2.9rem)] font-semibold leading-[1.08] tracking-[-0.025em]">Three engines. Three different visibility signals.</h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[#6E5A50]">
              ChatGPT may name your business, Perplexity may cite your website, and Claude may place you on the shortlist. ClearSignal checks all three.
            </p>
          </Reveal>

          <div className="relative mt-10">
            <button
              type="button"
              aria-label="Previous AI engine example"
              onClick={() => engineScrollRef.current?.scrollBy({ left: -engineScrollRef.current.clientWidth * 0.9, behavior: 'smooth' })}
              className="absolute -left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#E6DBCB] bg-white/95 text-[#6E5A50] shadow-sm md:hidden"
            >
              <ArrowRight className="h-4 w-4 rotate-180" />
            </button>
            <button
              type="button"
              aria-label="Next AI engine example"
              onClick={() => engineScrollRef.current?.scrollBy({ left: engineScrollRef.current.clientWidth * 0.9, behavior: 'smooth' })}
              className="absolute -right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#E6DBCB] bg-white/95 text-[#6E5A50] shadow-sm md:hidden"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
            <div ref={engineScrollRef} className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 pl-6 pr-0 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden">
            {[
              {
                Logo: OpenAILogo, engine: 'ChatGPT', badge: 'named' as const, position: '20% center', caption: 'Names specific businesses',
                body: (
                  <>
                    <div className="text-[12.5px] leading-relaxed text-[#5C5148]">&ldquo;For a reliable move in Toronto I&rsquo;d start with <span className="font-semibold" style={{ color: ESPRESSO }}>Your Business</span>&hellip;&rdquo;</div>
                    <div className="mt-3 flex items-center gap-2 border-t border-[#F0E9DF] pt-2.5">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full text-white" style={{ backgroundColor: COPPER }}><Check className="h-2.5 w-2.5" strokeWidth={3} /></span>
                      <span className="text-[11px] font-medium" style={{ color: COPPER }}>Position #1 of 5</span>
                    </div>
                  </>
                ),
              },
              {
                Logo: PerplexityLogo, engine: 'Perplexity', badge: 'cited' as const, position: 'center', caption: 'Cites and ranks sources',
                body: (
                  <>
                    <div className="text-[10.5px] uppercase tracking-wider text-[#B3A491]">Sources reviewed &middot; 18</div>
                    <div className="mt-2 space-y-1.5">
                      {['Best movers in Toronto 2026', 'Moving cost guide'].map((t, i) => (
                        <div key={t} className="flex items-center justify-between gap-2 text-[11.5px]">
                          <span className="flex items-center gap-1.5 truncate text-[#5C5148]"><span className="text-[10px] font-bold text-[#C0B1A0]">{i + 1}</span>{t}</span>
                          <span className="shrink-0 font-medium" style={{ color: COPPER }}>yourbusiness.com</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 border-t border-[#F0E9DF] pt-2.5 text-[11px] font-medium" style={{ color: COPPER }}>2 cited sources</div>
                  </>
                ),
              },
              {
                Logo: AnthropicLogo, engine: 'Claude', badge: 'recommended' as const, position: '80% center', caption: 'Builds a contextual shortlist',
                body: (
                  <>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ backgroundColor: 'rgba(169,83,31,0.07)' }}>
                        <span className="text-[10px] font-bold" style={{ color: COPPER }}>1</span>
                        <span className="text-[12px] font-semibold" style={{ color: ESPRESSO }}>Your Business</span>
                      </div>
                      {['Competitor A', 'Competitor B'].map((c, i) => (
                        <div key={c} className="flex items-center gap-2 px-2 py-1"><span className="text-[10px] font-bold text-[#C0B1A0]">{i + 2}</span><span className="text-[12px] text-[#93857A]">{c}</span></div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-1.5 border-t border-[#F0E9DF] pt-2.5 text-[11px] text-[#8D7B6B]"><Link2 className="h-3 w-3" style={{ color: COPPER }} /> grounded in yourbusiness.com</div>
                  </>
                ),
              },
            ].map(({ Logo, engine, badge, position, body, caption }, i) => (
              <Reveal key={engine} delay={i * 100} className="min-w-[86%] snap-start md:min-w-0">
                <div className="relative h-[300px] overflow-hidden rounded-2xl border border-[#E6DBCB] md:h-[330px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/hero-bg-8.jpg" alt="" className="h-full w-full object-cover" style={{ objectPosition: position }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#2E2116]/20 to-transparent" />
                  <div className="absolute inset-x-4 top-5">
                    <div className="rounded-2xl border border-[#EDE5D9] bg-white p-4 shadow-[0_22px_50px_-22px_rgba(46,33,22,0.45)]">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Logo className="h-4 w-4 text-[#3D2E22]" />
                          <span className="text-[12px] font-semibold">{engine}</span>
                        </span>
                        <StatusBadge kind={badge} />
                      </div>
                      <div className="mt-3">{body}</div>
                    </div>
                  </div>
                  {/* caption attached to the card's lower edge */}
                  <div className="absolute inset-x-0 bottom-0 border-t border-white/40 bg-white/90 px-4 py-3 text-[12.5px] font-semibold backdrop-blur" style={{ color: INK }}>
                    {caption}
                  </div>
                </div>
              </Reveal>
            ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ SECTION 4: PRODUCT SHOWCASE (contrasting) ============ */}
      <section id="workflow" className="relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #2B2018 0%, #211812 55%, #1C140F 100%)' }}>
        <div aria-hidden className="pointer-events-none absolute -left-40 top-10 h-[38rem] w-[38rem] rounded-full" style={{ background: 'radial-gradient(circle, rgba(169,83,31,0.30), transparent 62%)', filter: 'blur(30px)' }} />
        <div aria-hidden className="pointer-events-none absolute -right-32 bottom-0 h-[34rem] w-[34rem] rounded-full" style={{ background: 'radial-gradient(circle, rgba(233,169,107,0.18), transparent 62%)', filter: 'blur(30px)' }} />
        <SignalOverlay tone="light" />

        <div className="relative z-10 mx-auto max-w-6xl px-6 py-24">
          <Reveal className="mx-auto max-w-2xl text-center">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: '#E9A96B' }}>The product</div>
            <h2 className="mt-4 text-[clamp(2rem,3.9vw,3.1rem)] font-semibold leading-[1.06] tracking-[-0.025em] text-white">From AI evidence to an implementation plan.</h2>
            <p className="mx-auto mt-4 hidden max-w-xl text-[15px] leading-relaxed text-[#C6B4A2] sm:block">
              Every finding is tied to a tested AI answer, cited source or page on your website &mdash; then turned into a prioritized task.
            </p>
          </Reveal>

          {/* Tabs */}
          <div className="mt-9 hidden justify-center sm:flex">
            <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] p-1.5 backdrop-blur">
              {['Scan', 'Analyze', 'Fix', 'Monitor'].map((t, i) => (
                <button
                  key={t}
                  onClick={() => setTab(i)}
                  className="flex items-center gap-2 rounded-full px-5 py-2 text-[13px] font-semibold transition-all duration-200"
                  style={tab === i ? { backgroundColor: COPPER, color: '#fff', boxShadow: '0 8px 22px -12px rgba(169,83,31,0.9)' } : { color: '#C6B4A2' }}
                >
                  {t}
                  {i === 3 && (
                    <span className="rounded-full px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wider" style={tab === i ? { backgroundColor: 'rgba(255,255,255,0.22)', color: '#fff' } : { backgroundColor: 'rgba(255,255,255,0.08)', color: '#9B8A78' }}>Coming soon</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Product window - constrained width */}
          <div className="mx-auto mt-8 max-w-[1120px] overflow-hidden rounded-2xl border border-white/10 bg-white shadow-[0_60px_120px_-45px_rgba(0,0,0,0.75)]">
            <div className="flex items-center gap-3 border-b border-[#EFE7DB] bg-[#FBF7F1] px-5 py-3">
              <div className="flex gap-1.5">
                {['#E7CDB8', '#EAD9C4', '#E2D3BE'].map((c) => (<span key={c} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} />))}
              </div>
              <div className="mx-auto flex items-center gap-2 rounded-md border border-[#EFE7DB] bg-white px-3.5 py-1 text-[11.5px] text-[#8D7B6B]">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: COPPER }} /> app.clearsignal.com / audit
              </div>
            </div>

            <div className="bg-white px-4 pb-5 pt-5 sm:px-7 sm:pb-6 sm:pt-6">
              {tab === 0 && (
                <div>
                  <div className="flex items-center justify-between">
                    <div><div className="text-[16px] font-semibold">Buyer-intent scan</div><div className="mt-0.5 text-[12.5px] text-[#8D7B6B]">14 queries tested across 3 engines</div></div>
                    <span className="rounded-full bg-[#FBF7F1] px-3.5 py-1.5 text-[11.5px] font-medium text-[#8D7B6B]">Running</span>
                  </div>
                  <div className="mt-5 overflow-x-auto rounded-xl border border-[#EFE7DB]">
                    <div className="min-w-[640px]">
                      <div className="grid grid-cols-[1.5fr_repeat(3,0.5fr)] items-center gap-3 bg-[#FBF7F1] px-5 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-[#8D7B6B]">
                        <span>Buyer question</span>
                        {ENGINES.map(({ name, Logo }) => (
                          <span key={name} className="flex items-center justify-center gap-1.5" style={{ color: INK }}><Logo className="h-3.5 w-3.5" /><span className="text-[10px] normal-case tracking-normal">{name}</span></span>
                        ))}
                      </div>
                      {[
                        { q: 'best movers in Toronto', s: ['miss', 'cited', 'named'] as const },
                        { q: 'affordable moving companies near me', s: ['miss', 'cited', 'miss'] as const },
                        { q: 'how to choose a reliable mover', s: ['named', 'cited', 'named'] as const },
                        { q: 'commercial movers GTA', s: ['miss', 'miss', 'cited'] as const },
                      ].map((row) => (
                        <div key={row.q} className="grid grid-cols-[1.5fr_repeat(3,0.5fr)] items-center gap-3 border-t border-[#F3ECE1] px-5 py-2.5 text-[13.5px]">
                          <span className="truncate text-[#5C5148]">&ldquo;{row.q}&rdquo;</span>
                          {row.s.map((st, j) => (<span key={j} className="flex justify-center"><ResultChip kind={st} /></span>))}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* compact summary bar */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#EFE7DB] bg-[#FBF7F1] px-5 py-3 text-[12px] text-[#6E5A50]">
                    <span><span className="font-semibold" style={{ color: ESPRESSO }}>14</span> queries tested</span>
                    <span><span className="font-semibold" style={{ color: ESPRESSO }}>3</span> engines checked</span>
                    <span>Mention rate <span className="font-semibold" style={{ color: COPPER }}>21%</span></span>
                    <span>Citation gaps found</span>
                  </div>
                </div>
              )}

              {tab === 1 && (
                <div>
                  <div className="text-[16px] font-semibold">Visibility analysis</div>
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[['Mention rate', '21%'], ['Citation rate', '14%'], ['Share of voice', '18%'], ['Avg position', '#3']].map(([label, val]) => (
                      <div key={label} className="rounded-xl border border-[#EFE7DB] bg-[#FBF7F1] p-4">
                        <div className="text-[28px] font-semibold leading-none" style={{ color: ESPRESSO }}>{val}</div>
                        <div className="mt-2 text-[12px] text-[#8D7B6B]">{label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-xl border border-[#EFE7DB] p-5">
                    <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[#8D7B6B]">AI recommends instead</div>
                    <div className="mt-3.5 space-y-3">
                      {[['CARGO CABBIE', 34], ['Rent-a-Son', 21], ['My Ninja Movers', 12]].map(([name, pct]) => (
                        <div key={name as string} className="flex items-center gap-4">
                          <span className="w-40 text-[13.5px] text-[#5C5148]">{name}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#F0E9DF]"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COPPER }} /></div>
                          <span className="w-10 text-right text-[12.5px] font-semibold text-[#8D7B6B]">{pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {tab === 2 && (
                <>
                <div className="lg:hidden">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[15px] font-semibold">Implementation plan</div>
                      <div className="mt-0.5 text-[13px] text-[#6E5A50]">Evidence becomes owner-ready tasks</div>
                    </div>
                    <span className="rounded-full bg-[#FBF7F1] px-3 py-1 text-[12px] font-medium text-[#6E5A50]">Fix view</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {[
                      { t: 'Rewrite H1 to name your city', ev: 'ChatGPT - not named', owner: 'Owner', st: 'Ready', Icon: FileText },
                      { t: 'Publish an FAQ with schema markup', ev: 'Perplexity - no FAQ cited', owner: 'Developer', st: 'Draft', Icon: HelpCircle },
                      { t: 'Create a local comparison page', ev: 'Source gap - top 3 sources', owner: 'Contributor', st: 'Planned', Icon: MapPinned },
                    ].map((f) => (
                      <div key={f.t} className="rounded-xl border border-[#EFE7DB] bg-[#FBF7F1] p-3.5">
                        <div className="flex items-start gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: COPPER }}>
                            <f.Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[14.5px] font-semibold leading-snug text-[#4A3A2D]">{f.t}</div>
                            <div className="mt-1.5 flex items-center gap-1 text-[12.5px] text-[#7A6857]"><Link2 className="h-3.5 w-3.5 shrink-0" style={{ color: 'rgba(169,83,31,0.65)' }} />{f.ev}</div>
                            <div className="mt-2.5 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wider">
                              <span className="rounded-md border px-2 py-1" style={{ borderColor: 'rgba(169,83,31,0.35)', color: COPPER }}>Fix</span>
                              <span className="rounded-md border border-[#E4DACB] px-2 py-1 text-[#8D7B6B]">{f.owner}</span>
                              <span className="rounded-md border border-[#E4DACB] px-2 py-1 text-[#8D7B6B]">{f.st}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="hidden gap-5 lg:grid lg:grid-cols-[1.5fr_1fr]">
                  <div>
                    <div className="flex items-center justify-between">
                      <div><div className="text-[16px] font-semibold">Implementation plan</div><div className="mt-0.5 text-[12.5px] text-[#8D7B6B]">Each finding, tied to evidence, becomes a task</div></div>
                      <span className="rounded-full bg-[#FBF7F1] px-3.5 py-1.5 text-[11.5px] font-medium text-[#8D7B6B]">4 fixes</span>
                    </div>
                    {/* workflow legend */}
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#A6957F]">
                      {['Finding', 'Evidence', 'Fix', 'Owner', 'Status'].map((step, i) => (
                        <span key={step} className="flex items-center gap-1.5">
                          {i > 0 && <ArrowRight className="h-3 w-3" style={{ color: '#D6C6B2' }} />}
                          <span style={i === 2 ? { color: COPPER } : undefined}>{step}</span>
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 overflow-hidden rounded-xl border border-[#EFE7DB]">
                      <div className="grid grid-cols-[1fr_84px_104px_84px] items-center gap-2 bg-[#FBF7F1] px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#8D7B6B]">
                        <span>Finding &amp; recommended fix</span><span>Priority</span><span>Owner</span><span>Status</span>
                      </div>
                      {[
                        { t: 'Rewrite H1 to name your city', ev: 'ChatGPT - not named', p: 'High', role: 'Owner', st: 'Ready', done: true },
                        { t: 'Publish an FAQ with schema markup', ev: 'Perplexity - no FAQ cited', p: 'High', role: 'Implementer', st: 'Draft', done: true },
                        { t: 'Create a local comparison page', ev: 'Source gap - top 3 sources', p: 'Medium', role: 'Contributor', st: 'Planned', done: false },
                        { t: 'Add named customer testimonials', ev: 'Claude - weak trust signals', p: 'Medium', role: 'Owner', st: 'Ready', done: true },
                      ].map((f, i) => (
                        <div key={f.t} className="grid grid-cols-[1fr_84px_104px_84px] items-center gap-2 border-t border-[#F3ECE1] px-4 py-2.5">
                          <span className="flex items-start gap-2.5">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: COPPER }}>{i + 1}</span>
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-medium text-[#5C5148]">{f.t}</span>
                              <span className="mt-0.5 flex items-center gap-1 text-[10.5px] text-[#A6957F]"><Link2 className="h-2.5 w-2.5 shrink-0" style={{ color: 'rgba(169,83,31,0.55)' }} /><span className="truncate">{f.ev}</span></span>
                            </span>
                          </span>
                          <span className="self-center rounded-md border px-1.5 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wider" style={f.p === 'High' ? { borderColor: 'rgba(169,83,31,0.4)', color: COPPER, backgroundColor: 'rgba(169,83,31,0.06)' } : { borderColor: '#E4DACB', color: '#A6957F' }}>{f.p}</span>
                          <span className="self-center text-[11.5px] text-[#8D7B6B]">{f.role}</span>
                          <span className="flex items-center gap-1 self-center text-[11px] font-medium" style={{ color: f.done ? COPPER : '#A6957F' }}>
                            {f.done ? <Check className="h-3 w-3" strokeWidth={3} /> : <span className="h-1.5 w-1.5 rounded-full bg-[#CBBBA8]" />}
                            {f.st}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#EFE7DB] bg-[#FBF7F1] p-5">
                    <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[#8D7B6B]">Ready-to-use materials</div>
                    <div className="mt-3 rounded-lg border border-[#EFE7DB] bg-white p-3.5">
                      <div className="text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: COPPER }}>Draft H1</div>
                      <div className="mt-1.5 text-[12.5px] leading-relaxed text-[#5C5148]">&ldquo;Toronto&rsquo;s trusted movers &mdash; homes, condos &amp; businesses. Licensed, insured, and rated across the GTA.&rdquo;</div>
                    </div>
                    <div className="mt-2.5 rounded-lg border border-[#EFE7DB] bg-white p-3.5">
                      <div className="text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: COPPER }}>Draft FAQ</div>
                      <div className="mt-1.5 text-[12.5px] leading-relaxed text-[#5C5148]">&ldquo;Do you handle condo moves?&rdquo; &mdash; answer written for citation-ready schema markup.</div>
                    </div>
                    <div className="mt-3 space-y-1.5 text-[11.5px] text-[#6E5A50]">
                      {['Meta copy suggestions', 'FAQ schema (JSON-LD)', 'Implementation briefs'].map((m) => (
                        <div key={m} className="flex items-center gap-2"><Check className="h-3 w-3 shrink-0" style={{ color: COPPER }} strokeWidth={3} />{m}</div>
                      ))}
                    </div>
                  </div>
                </div>
                </>
              )}

              {tab === 3 && (
                <div className="relative">
                  <span className="absolute right-0 top-0 rounded-full border border-[#E9DECF] bg-white px-3 py-1 text-[11px] font-semibold text-[#8D7B6B]">Coming soon</span>
                  <div><div className="text-[16px] font-semibold">Weekly monitoring</div><div className="mt-0.5 text-[12.5px] text-[#8D7B6B]">Track changes over time after the founding audit phase</div></div>
                  <div className="mt-5 rounded-xl border border-[#EFE7DB] bg-[#FBF7F1] p-5">
                    <svg viewBox="0 0 320 90" className="h-28 w-full" preserveAspectRatio="none">
                      <polyline points="0,72 45,68 90,70 135,58 180,52 225,44 270,34 320,22" fill="none" stroke={COPPER} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      {[[0, 72], [45, 68], [90, 70], [135, 58], [180, 52], [225, 44], [270, 34], [320, 22]].map(([x, y]) => (<circle key={`${x}`} cx={x} cy={y} r="2.5" fill={COPPER} />))}
                    </svg>
                    <div className="mt-1.5 flex justify-between text-[11px] text-[#A6957F]"><span>28/100</span><span>34/100</span></div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-[#EFE7DB] p-4">
                      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[#8D7B6B]">Competitor movement</div>
                      <div className="mt-3 space-y-2 text-[13px]">
                        <div className="flex items-center justify-between text-[#5C5148]">Rent-a-Son <span className="text-[#A6957F]">&darr; slipping</span></div>
                        <div className="flex items-center justify-between text-[#5C5148]">My Ninja Movers <span style={{ color: COPPER }}>&uarr; gaining</span></div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#EFE7DB] p-4">
                      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[#8D7B6B]">Newly cited sources</div>
                      <div className="mt-3 space-y-2 text-[13px]">
                        <div className="flex items-center gap-2 text-[#5C5148]"><Link2 className="h-3.5 w-3.5" style={{ color: COPPER }} /> yourbusiness.com</div>
                        <div className="flex items-center gap-2 text-[#5C5148]"><Link2 className="h-3.5 w-3.5" style={{ color: COPPER }} /> torontomovers-guide.com</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============ SECTION 5: RESULTS STRIP ============ */}
      <section id="what-you-get" className="border-t border-[#EDE5D9] bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-[clamp(1.9rem,3.4vw,2.7rem)] font-semibold leading-[1.1] tracking-[-0.025em]">What the full audit gives you</h2>
            <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-[#6E5A50]">
              Evidence from real AI answers, clarity on what is missing, and a plan your team can implement.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              { h: 'Where you stand', c: 'Mention rate, citation rate and visibility across the tested buyer-intent queries.' },
              { h: 'Why competitors appear', c: 'Real AI answer excerpts, cited sources, competitor mentions and missing trust signals.' },
              { h: 'What to fix first', c: 'Prioritized actions, draft copy, schema suggestions and clear implementation ownership.' },
            ].map((card, i) => (
              <Reveal key={card.h} delay={i * 100}>
                <div className="h-full rounded-2xl border border-[#E6DBCB] bg-[#FFFDF9] p-7">
                  <span className="hidden h-5 w-[3px] rounded-full sm:block" style={{ backgroundColor: COPPER }} />
                  <h3 className="text-[22px] font-bold leading-snug tracking-[-0.015em] sm:mt-5" style={{ color: ESPRESSO }}>{card.h}</h3>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-[#8D7B6B]">{card.c}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <p className="mt-10 text-center text-[12.5px] font-medium" style={{ color: '#7A6857' }}>Automated scan. Expert-reviewed before delivery.</p>
        </div>
      </section>

      {/* ============ SECTION 6: PRICING ============ */}
      <section id="pricing" className="relative overflow-hidden border-t border-[#E6DBCB]" style={{ background: 'linear-gradient(180deg, #FBF6EE 0%, #F5EDE1 100%)' }}>
        <SignalOverlay />
        <div className="relative z-10 mx-auto max-w-6xl px-6 py-24">
          <Reveal className="mx-auto max-w-2xl text-center">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: '#9E6238' }}>Founding offer</div>
            <h2 className="mt-4 text-[clamp(2rem,3.7vw,3rem)] font-semibold leading-[1.08] tracking-[-0.025em]">One expert-reviewed audit. No subscription required.</h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[#6E5A50]">
              Get the evidence, priorities and implementation materials your team needs before deciding whether ongoing monitoring is worthwhile.
            </p>
          </Reveal>

          {/* Main audit card - single, centered */}
          <Reveal className="mx-auto mt-12 max-w-2xl">
            <div className="flex flex-col rounded-2xl border bg-white p-9 shadow-[0_40px_90px_-55px_rgba(46,33,22,0.55)]" style={{ borderColor: 'rgba(169,83,31,0.28)' }}>
              <div className="flex items-start justify-end gap-6 sm:justify-between">
                <div className="hidden sm:block">
                  <div className="text-[17px] font-semibold leading-snug" style={{ color: ESPRESSO }}>AI Visibility Audit</div>
                  <div className="mt-1 text-[13px] text-[#8D7B6B]">Includes expert website clarity and citation-readiness review.</div>
                </div>
                <span className="shrink-0 rounded-full border px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider" style={{ borderColor: 'rgba(169,83,31,0.35)', color: COPPER, backgroundColor: 'rgba(169,83,31,0.06)' }}>Founding price &mdash; first 20</span>
              </div>

              <div className="mt-7 flex items-end gap-4">
                <span className="text-[64px] font-semibold leading-none tracking-[-0.03em]" style={{ color: ESPRESSO }}>&euro;149</span>
                <div className="pb-1.5 text-[12.5px] text-[#9B8A78]">Regular price &euro;399<br />after the founding offer.</div>
              </div>

              <ul className="mt-8 grid gap-x-7 gap-y-3 text-[14px] sm:hidden">
                {MOBILE_PRICING_AUDIT.map((b) => (
                  <li key={b} className="flex gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: COPPER }} strokeWidth={2.5} /><span className="text-[#5C5148]">{b}</span></li>
                ))}
              </ul>
              <ul className="mt-8 hidden gap-x-7 gap-y-2.5 text-[13.5px] sm:grid sm:grid-cols-2">
                {PRICING_AUDIT.map((b) => (
                  <li key={b} className="flex gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: COPPER }} strokeWidth={2.5} /><span className="text-[#5C5148]">{b}</span></li>
                ))}
              </ul>

              <Link href="/score" className="mt-8 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-semibold text-white transition-opacity duration-200 hover:opacity-90" style={{ backgroundColor: ESPRESSO }}>
                Start with a free score <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Monitoring as a small secondary note, not a card */}
            <p className="mt-5 text-center text-[14px] font-medium text-[#6E5A50]">
              Weekly monitoring is coming soon.{' '}
              <button className="font-semibold transition-colors hover:opacity-80" style={{ color: COPPER }}>Join the waitlist</button>.
            </p>
          </Reveal>

        </div>
      </section>

      {/* ============ SECTION 7: FAQ (minimal, narrow) ============ */}
      <section id="faq" className="border-t border-[#EDE5D9] bg-white">
        <div className="mx-auto max-w-[780px] px-6 py-20">
          <h2 className="text-center text-[clamp(2.6rem,5vw,3.8rem)] font-semibold leading-none tracking-[-0.04em]" style={{ color: ESPRESSO }}>FAQ</h2>
          <div className="mt-10 border-t border-[#EAE2D6]">
            {FAQS.map((item, i) => {
              const open = openFaq === i
              return (
                <div key={item.q} className="border-b border-[#EAE2D6]">
                  <button onClick={() => setOpenFaq(open ? null : i)} className="flex min-h-[48px] w-full items-center justify-between gap-6 py-3.5 text-left sm:py-[17px]">
                    <span className="text-[14.5px] font-medium sm:text-[15.5px]" style={{ color: ESPRESSO }}>{item.q}</span>
                    <span className="shrink-0" style={{ color: 'rgba(169,83,31,0.7)' }}>
                      {open ? <Minus className="h-[18px] w-[18px]" /> : <Plus className="h-[18px] w-[18px]" />}
                    </span>
                  </button>
                  <div className="grid transition-all duration-300" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
                    <div className="overflow-hidden">
                      <p className="max-w-2xl pb-5 pr-10 text-[14px] leading-relaxed text-[#6E5A50]">{item.a}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ============ FOOTER (compact dark) ============ */}
      <footer style={{ backgroundColor: '#231A12' }}>
        <div className="mx-auto max-w-6xl px-6 py-9">
          <div className="flex flex-col items-center justify-between gap-5 text-center md:flex-row md:text-left">
            <div className="flex items-center gap-2.5 text-[16px] font-bold tracking-tight text-white">
              <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#E9A96B' }} />
              ClearSignal
            </div>
            <nav className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-[12.5px] text-[#D2C2B0] sm:text-[13px]">
              {[
                { label: 'Workflow', href: '#workflow' },
                { label: 'What you get', href: '#what-you-get', hideMobile: true },
                { label: 'Pricing', href: '#pricing' },
                { label: 'FAQ', href: '#faq' },
                { label: 'Sample audit', href: '/sample', hideMobile: true },
              ].map((l, i) => (
                <span key={l.label} className={`items-center gap-2 ${l.hideMobile ? 'hidden sm:flex' : 'flex'}`}>
                  {i > 0 && <span className="text-[#6B5844]">&middot;</span>}
                  <a href={l.href} className="transition-colors duration-200 hover:text-white">{l.label}</a>
                </span>
              ))}
            </nav>
          </div>
          <div className="mt-7 flex flex-col items-center justify-between gap-3 border-t pt-6 text-center text-[12px] leading-relaxed text-[#A08D77] md:flex-row md:text-left" style={{ borderColor: 'rgba(233,169,107,0.14)' }}>
            <span>Expert-reviewed AI visibility audits for teams that want to be found, cited and recommended.</span>
            <span className="text-[#8C7862]">ClearSignal measures a tested query set. Results may vary as AI systems and source data change.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

