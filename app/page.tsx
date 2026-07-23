'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, BriefcaseBusiness, Building2, Check, ChevronLeft, ChevronRight, Link2, MapPinned, Minus, Plus } from 'lucide-react'
import { DELIVERY_PROMISE } from '@/lib/delivery-promise'
import { AUDIT_PRODUCT_LABEL } from '@/lib/audit-label'

const BACKGROUNDS = [
  { src: '/hero-bg-1.jpg', label: 'A1' },
]

const COPPER = '#A9531F'
const ESPRESSO = '#2E2116'
const INK = '#3D2E22' // high-contrast supporting text
const NAV_ITEMS = [
  { label: "Who it's for", href: '#who-its-for' },
  { label: 'Workflow', href: '#workflow' },
  { label: 'Pricing', href: '#pricing' },
]

const AUDIENCES = [
  {
    name: 'Service businesses',
    copy: '"Who should I hire for this?" is now an AI conversation. See who AI recommends, which sources it trusts, and where your website falls short.',
    mobileCopy: 'Buyers increasingly ask AI who to hire locally. See which businesses it recommends, which sources it trusts, and where your website falls short.',
    cta: 'Get your free AI visibility score',
  },
  {
    name: 'Agencies',
    copy: 'Answer the question clients are already asking: "What does AI say about us?" ClearSignal turns AI visibility gaps into competitor evidence, source issues and implementation work you can run for client websites.',
    mobileCopy: 'See how AI describes your clients, which competitors appear instead, and where your agency can create the most valuable improvements.',
    cta: 'Get your free AI visibility score',
  },
  {
    name: 'SaaS & B2B teams',
    copy: 'See which competitors AI recommends, which sources it trusts, and what your website is missing before buyers reach a shortlist.',
    mobileCopy: 'See which vendors AI shortlists for category and solution queries, and what proof, content and product signals your website is missing.',
    cta: 'Get your free AI visibility score',
  },
]

const AUDIENCE_PREVIEWS = [
  {
    header: 'Local visibility audit',
    Icon: MapPinned,
    score: 34,
    meta: '14 local buyer-intent queries \u00d7 3 engines',
    engines: [
      { Logo: OpenAILogo, engine: 'ChatGPT', badge: 'missing' as const, badgeLabel: 'Missing', note: 'competitors named instead' },
      { Logo: PerplexityLogo, engine: 'Perplexity', badge: 'cited' as const, badgeLabel: 'Cited', note: 'local sources cited' },
      { Logo: AnthropicLogo, engine: 'Claude', badge: 'named' as const, badgeLabel: 'Named', note: 'business named' },
    ],
    gapLabel: 'Top visibility gap',
    gap: 'AI answers rely on local comparison pages, directories and customer reviews, but your business is missing from the sources they cite.',
  },
  {
    header: 'Client audit preview',
    Icon: BriefcaseBusiness,
    score: 42,
    meta: '18 buyer-intent queries \u00d7 3 engines',
    engines: [
      { Logo: OpenAILogo, engine: 'ChatGPT', badge: 'named' as const, badgeLabel: 'Competitor named', note: 'competitor appears' },
      { Logo: PerplexityLogo, engine: 'Perplexity', badge: 'cited' as const, badgeLabel: '2 sources cited', note: 'supporting sources found' },
      { Logo: AnthropicLogo, engine: 'Claude', badge: 'named' as const, badgeLabel: 'Client mentioned', note: 'client appears' },
    ],
    gapLabel: 'Top client opportunity',
    gap: 'Three competitors appear more often because they have clearer case studies, third-party proof and category-focused pages.',
    supportingLine: 'Includes evidence, prioritized fixes, PDF report and implementation brief.',
  },
  {
    header: 'Category visibility audit',
    Icon: Building2,
    score: 27,
    meta: '16 category and solution queries \u00d7 3 engines',
    engines: [
      { Logo: OpenAILogo, engine: 'ChatGPT', badge: 'missing' as const, badgeLabel: 'Missing', note: 'competitors named instead' },
      { Logo: PerplexityLogo, engine: 'Perplexity', badge: 'cited' as const, badgeLabel: 'Docs cited', note: 'documentation cited' },
      { Logo: AnthropicLogo, engine: 'Claude', badge: 'named' as const, badgeLabel: 'Competitor named', note: 'competitor appears' },
    ],
    gapLabel: 'Top category gap',
    gap: 'AI relies on comparison pages, use-case content, product documentation and customer proof that your website does not explain clearly enough.',
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
    q: 'How is ClearSignal different from asking ChatGPT to audit my website?',
    a: "A single ChatGPT conversation gives you one model's general opinion. ClearSignal runs a structured set of buyer-intent questions across ChatGPT, Claude and Perplexity, compares which businesses and sources appear, stores the evidence, identifies website and citation gaps, and turns the findings into an expert-reviewed implementation plan.",
  },
  {
    q: 'What happens after the free score?',
    a: 'The free check gives you an initial visibility snapshot. The full audit adds a structured multi-engine query set, competitor and citation evidence, website clarity gaps, prioritized recommendations, draft implementation materials and expert review before delivery.',
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
    q: 'What happens if my business is not mentioned by AI at all?',
    a: 'That is useful evidence. The audit shows which competitors or sources appear instead, which signals are missing, and what to fix first to become easier for answer engines to understand and cite.',
  },
  {
    q: 'Can you guarantee AI will recommend my business?',
    a: 'No. ClearSignal measures a tested query set and identifies signals that may improve visibility, citations and recommendations. AI results change over time.',
  },
  {
    q: 'How long does the full audit take?',
    a: DELIVERY_PROMISE,
  },
  {
    q: 'Can agencies use ClearSignal for client audits?',
    a: 'Yes. Agencies can use ClearSignal to identify AI visibility gaps, source and citation issues, and implementation work for client websites. White-label and multi-client workflows are being tested during the founding phase.',
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

function StatusBadge({ kind, label: customLabel }: { kind: 'named' | 'cited' | 'recommended' | 'missing'; label?: string }) {
  const label = customLabel || { named: 'Named', cited: 'Cited', recommended: 'Recommended', missing: 'Missing' }[kind]
  const missing = kind === 'missing'
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider sm:text-[10px]"
      style={{
        borderColor: missing ? '#DFD5C7' : 'rgba(169,83,31,0.4)',
        color: missing ? '#9B8A78' : COPPER,
        backgroundColor: missing ? 'transparent' : 'rgba(169,83,31,0.06)',
      }}
    >
      {missing
        ? <Minus className={customLabel ? 'hidden h-2.5 w-2.5 sm:block' : 'h-2.5 w-2.5'} />
        : <Check className={customLabel ? 'hidden h-2.5 w-2.5 sm:block' : 'h-2.5 w-2.5'} strokeWidth={3} />}
      {label}
    </span>
  )
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
    <div
      className={`absolute z-30 hidden rounded-xl border border-white/70 bg-white/55 px-4 py-2.5 shadow-[0_18px_40px_-20px_rgba(46,33,22,0.45)] lg:block ${className || ''}`}
      style={{ backdropFilter: 'blur(18px) saturate(1.35)', WebkitBackdropFilter: 'blur(18px) saturate(1.35)' }}
    >
      {children}
    </div>
  )
}

function AudienceAuditPreview({ activeIndex }: { activeIndex: number }) {
  return (
    <div
      id="audience-audit-preview"
      className="relative min-w-0 overflow-hidden rounded-3xl border border-[#EDE5D9] bg-[#FBF6EE] p-3 shadow-[0_30px_70px_-45px_rgba(46,33,22,0.4)] sm:p-5"
    >
      <p className="sr-only" aria-live="polite">
        {AUDIENCE_PREVIEWS[activeIndex].header}: {AUDIENCE_PREVIEWS[activeIndex].score} out of 100.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/hero-bg-6.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
      <div className="relative grid min-w-0">
        {AUDIENCE_PREVIEWS.map((preview, index) => {
          const active = index === activeIndex
          const PreviewIcon = preview.Icon

          return (
            <div
              key={preview.header}
              aria-hidden={!active}
              className="col-start-1 row-start-1 min-w-0 transition-[opacity,transform] duration-200 ease-out"
              style={{
                opacity: active ? 1 : 0,
                pointerEvents: active ? 'auto' : 'none',
                transform: active ? 'translateY(0)' : 'translateY(7px)',
              }}
            >
              <div className="mb-4 flex items-center justify-between gap-3 px-1">
                <div className="flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: '#9E6238' }}>
                  <PreviewIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{preview.header}</span>
                </div>
                <div className="hidden shrink-0 text-[11px] font-medium text-[#8D7B6B] min-[360px]:block">yourbusiness.com</div>
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-[#EDE5D9] bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10.5px] uppercase tracking-wider text-[#8D7B6B]">AI Visibility Score</div>
                      <div className="mt-1 text-[34px] font-semibold leading-none" style={{ color: ESPRESSO }}>{preview.score}<span className="text-[15px] font-medium text-[#B4A69A]">/100</span></div>
                      <div className="mt-1.5 text-[11px] text-[#8D7B6B]">{preview.meta}</div>
                    </div>
                    <svg width="72" height="72" viewBox="0 0 72 72" aria-label={`${preview.score} out of 100`}>
                      <circle cx="36" cy="36" r="30" fill="none" stroke="#EFE9E0" strokeWidth="7" />
                      <circle cx="36" cy="36" r="30" fill="none" stroke={COPPER} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(preview.score / 100) * 188} 188`} transform="rotate(-90 36 36)" />
                    </svg>
                  </div>
                </div>
                <div className="rounded-2xl border border-[#EDE5D9] bg-white p-3 shadow-sm sm:p-5">
                  <div className="text-[10.5px] uppercase tracking-wider text-[#8D7B6B]">Engine breakdown</div>
                  <div className="mt-2.5 space-y-1 sm:mt-3 sm:space-y-2.5">
                    {preview.engines.map(({ Logo, engine, badge, badgeLabel, note }) => (
                      <div key={engine}>
                        <div className="sm:hidden">
                          <div className="flex min-h-9 items-center gap-2.5">
                            <Logo className="h-4 w-4 shrink-0 text-[#3D2E22]" />
                            <span className="flex-1 text-[13px] font-semibold">{engine}</span>
                            <StatusBadge kind={badge} label={badgeLabel} />
                          </div>
                          <div className="-mt-0.5 pl-[26px] text-[11px] leading-snug text-[#8D7B6B]">{note}</div>
                        </div>
                        <div className="hidden items-center gap-2.5 sm:flex">
                          <Logo className="h-4 w-4 shrink-0 text-[#3D2E22]" />
                          <span className="w-[74px] text-[13px] font-semibold">{engine}</span>
                          <span className="flex-1 text-right text-[11px] text-[#8D7B6B]">{note}</span>
                          <StatusBadge kind={badge} label={badgeLabel} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex min-h-[132px] flex-col rounded-2xl border border-[#EDE5D9] bg-white p-4 shadow-sm sm:p-5">
                  <div className="text-[10.5px] uppercase tracking-wider text-[#8D7B6B]">{preview.gapLabel}</div>
                  <div className="mt-2 text-[13px] leading-relaxed text-[#5C5148]">{preview.gap}</div>
                  <div className="mt-auto pt-2 text-[11px] font-medium leading-relaxed text-[#8D7B6B]">
                    {preview.supportingLine || <span aria-hidden>&nbsp;</span>}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ProductShowcase() {
  const [openStage, setOpenStage] = useState<number | null>(2)
  const [activeStage, setActiveStage] = useState(0)
  const showcaseRef = useRef<HTMLElement>(null)
  const autoplayTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([])
  const interactionRef = useRef(false)
  const engineStates = [
    { Logo: OpenAILogo, engine: 'ChatGPT', state: 'Missing', signal: 28 },
    { Logo: PerplexityLogo, engine: 'Perplexity', state: 'Cited', signal: 72 },
    { Logo: AnthropicLogo, engine: 'Claude', state: 'Appears', signal: 56 },
  ]
  const competitorSignals = ['Strong customer reviews', 'Clear service-area pages', 'Mentions in comparison sources']
  const missingSignals = ['Clear location information', 'Third-party proof', 'Presence in cited sources']
  const actions = [
    'Add your city and service area to the homepage heading.',
    'Add a concise FAQ section.',
    'Add customer proof and comparison content.',
  ]
  const mobileStages = [
    { title: 'Where you stand', summary: '34/100 · 21% mentioned · 14% cited' },
    { title: 'Why competitors appear', summary: 'Stronger reviews, clearer pages and cited sources' },
    { title: 'What to fix first', summary: 'Add location · Add FAQ · Add proof' },
  ]
  const desktopStages = [
    { label: 'Measure', title: 'Where you stand' },
    { label: 'Explain', title: 'Why competitors appear' },
    { label: 'Act', title: 'What to fix first' },
  ]
  const stopAutoplay = useCallback(() => {
    interactionRef.current = true
    autoplayTimersRef.current.forEach(clearTimeout)
    autoplayTimersRef.current = []
  }, [])

  const selectStage = useCallback((stage: number) => {
    stopAutoplay()
    setActiveStage(stage)
  }, [stopAutoplay])

  useEffect(() => {
    const section = showcaseRef.current
    if (!section) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) return

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || interactionRef.current || autoplayTimersRef.current.length > 0) return
      setActiveStage(0)
      autoplayTimersRef.current = [
        setTimeout(() => {
          if (!interactionRef.current) setActiveStage(1)
        }, 4000),
        setTimeout(() => {
          if (!interactionRef.current) setActiveStage(2)
          autoplayTimersRef.current = []
        }, 8000),
      ]
      observer.disconnect()
    }, { threshold: 0.35 })

    observer.observe(section)
    return () => {
      observer.disconnect()
      autoplayTimersRef.current.forEach(clearTimeout)
      autoplayTimersRef.current = []
    }
  }, [])

  return (
    <section ref={showcaseRef} id="workflow" className="relative scroll-mt-6 overflow-hidden" style={{ background: 'linear-gradient(180deg, #2B2018 0%, #211812 55%, #1C140F 100%)' }}>
      <div aria-hidden className="pointer-events-none absolute -left-40 top-10 h-[38rem] w-[38rem] rounded-full" style={{ background: 'radial-gradient(circle, rgba(169,83,31,0.30), transparent 62%)', filter: 'blur(30px)' }} />
      <div aria-hidden className="pointer-events-none absolute -right-32 bottom-0 h-[34rem] w-[34rem] rounded-full" style={{ background: 'radial-gradient(circle, rgba(233,169,107,0.18), transparent 62%)', filter: 'blur(30px)' }} />
      <SignalOverlay tone="light" />

      <div className="relative z-10 mx-auto max-w-[1400px] px-5 py-20 sm:px-6 sm:py-24">
        <Reveal className="mx-auto max-w-3xl text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#E9A96B]">The product</div>
          <h2 className="mt-4 text-[clamp(2.25rem,10vw,2.75rem)] font-semibold leading-[1.04] tracking-[-0.025em] text-white sm:text-[clamp(2rem,3.9vw,3.1rem)]">From AI visibility to clear next steps.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-[14px] leading-relaxed text-[#C6B4A2] sm:text-[15px]">
            See where you appear, why competitors are chosen, and what your team should improve first.
          </p>
        </Reveal>

        <div
          className="relative mx-auto mt-11 hidden h-[530px] w-full max-w-[1280px] overflow-visible lg:block"
          style={{ perspective: '1600px', perspectiveOrigin: '50% 44%' }}
          aria-label="ClearSignal product story"
          onMouseEnter={stopAutoplay}
          onFocusCapture={stopAutoplay}
          onTouchStart={stopAutoplay}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault()
              selectStage((activeStage + 2) % 3)
            }
            if (event.key === 'ArrowRight') {
              event.preventDefault()
              selectStage((activeStage + 1) % 3)
            }
            if (event.key === 'Home') selectStage(0)
            if (event.key === 'End') selectStage(2)
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[52px] h-[390px] w-[820px] -translate-x-1/2 opacity-70 blur-[100px] transition-transform duration-[580ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{
              background: 'radial-gradient(ellipse at 50% 64%, rgba(185,89,38,0.34) 0%, rgba(122,62,34,0.18) 38%, transparent 72%), radial-gradient(ellipse at 72% 50%, rgba(192,119,64,0.16) 0%, transparent 62%)',
              transform: `translateX(calc(-50% + ${(activeStage - 1) * 46}px))`,
            }}
          />
          {desktopStages.map((stage, index) => {
            const relative = (index - activeStage + 3) % 3
            const active = relative === 0
            const direction = relative === 1 ? 1 : -1
            return (
              <button
                key={stage.label}
                type="button"
                aria-label={`Show ${stage.label}: ${stage.title}`}
                aria-current={active ? 'step' : undefined}
                onClick={() => selectStage(index)}
                className="absolute left-1/2 top-0 h-[420px] overflow-hidden rounded-[26px] border p-0 text-left outline-none backdrop-blur-xl transition-[transform,opacity,filter,background-color,box-shadow] duration-[580ms] ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:ring-2 focus-visible:ring-[#E9A96B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#211812] motion-reduce:transition-opacity motion-reduce:duration-200"
                style={{
                  width: 'min(960px, calc(100% - 250px))',
                  zIndex: active ? 30 : 10,
                  opacity: active ? 1 : 0.58,
                  pointerEvents: active ? 'auto' : 'none',
                  filter: active ? 'none' : 'blur(0.65px) brightness(0.78)',
                  backgroundColor: active ? 'rgba(66, 47, 37, 0.96)' : 'rgba(54, 39, 31, 0.97)',
                  borderColor: active ? 'rgba(233,169,107,0.34)' : 'rgba(233,169,107,0.18)',
                  boxShadow: active ? '0 54px 120px -44px rgba(0,0,0,0.96), 0 22px 56px -38px rgba(199,104,48,0.42), inset 0 1px 0 rgba(255,255,255,0.055)' : '0 30px 70px -38px rgba(0,0,0,0.92)',
                  transformStyle: 'preserve-3d',
                  transform: active
                    ? 'translate3d(-50%, 0, 0) rotateY(0deg) scale(1)'
                    : `translate3d(calc(-50% + ${direction * 286}px), 14px, -130px) rotateY(${direction * -6}deg) scale(0.94)`,
                }}
              >
                {!active && (
                  <>
                    <span aria-hidden className={`pointer-events-none absolute inset-y-0 z-20 w-px bg-[#E9A96B]/50 ${direction > 0 ? 'left-0' : 'right-0'}`} />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 z-10"
                      style={{ background: direction > 0 ? 'linear-gradient(90deg, rgba(233,169,107,0.07), transparent 32%, rgba(18,12,9,0.46) 100%)' : 'linear-gradient(270deg, rgba(233,169,107,0.07), transparent 32%, rgba(18,12,9,0.46) 100%)' }}
                    />
                  </>
                )}
                <div className="h-full px-7 py-6 text-[#FFF8F0] xl:px-8 xl:py-7">
                  <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#E9A96B]">{String(index + 1).padStart(2, '0')} {stage.label}</div>
                  <h3 className="mt-1.5 text-[26px] font-semibold leading-tight">{stage.title}</h3>

                  {!active && (
                    <div className={`absolute top-[108px] w-[190px] border-t border-[#E9A96B]/25 pt-5 text-[14px] leading-relaxed text-[#D7C5B4] ${direction > 0 ? 'right-7 text-right' : 'left-7'}`}>
                      {index === 0 && <><div className="text-[38px] font-semibold leading-none text-white">34<span className="text-[12px] text-[#BCA894]">/100</span></div><div className="mt-3">21% mentioned<br />14% cited</div></>}
                      {index === 1 && <><div className="font-semibold text-white">Recommendation signals</div><div className="mt-2">Reviews, service pages and cited sources.</div></>}
                      {index === 2 && <ol className="space-y-2">{['Add location', 'Add FAQ', 'Add proof'].map((item, itemIndex) => <li key={item}><span className="text-[#E9A96B]">0{itemIndex + 1}</span> {item}</li>)}</ol>}
                    </div>
                  )}

                  {active && index === 0 && (
                    <div className="mt-3">
                      <p className="text-[14px] leading-relaxed text-[#D7C5B4]">See whether your business is named, cited or missing from the buyer questions that matter.</p>
                      <div className="mt-4 grid h-[238px] grid-cols-[0.8fr_1.2fr] gap-4">
                        <div className="rounded-[18px] border border-[#A66A47]/45 bg-[#573E31] p-5">
                          <div className="flex items-center justify-between gap-4">
                            <div><div className="text-[12px] font-semibold uppercase tracking-[0.13em] text-[#D8B091]">AI visibility score</div><div className="mt-2 text-[50px] font-semibold leading-none text-white">34<span className="text-[15px] text-[#BFA994]">/100</span></div></div>
                            <svg width="82" height="82" viewBox="0 0 72 72" aria-label="34 out of 100"><circle cx="36" cy="36" r="29" fill="none" stroke="#745747" strokeWidth="7" /><circle cx="36" cy="36" r="29" fill="none" stroke="#D2763C" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${0.34 * 182} 182`} transform="rotate(-90 36 36)" /></svg>
                          </div>
                          <div className="mt-5 grid grid-cols-2 border-t border-[#876250] pt-4"><div><div className="text-[24px] font-semibold text-[#F0A46F]">21%</div><div className="text-[12px] text-[#C9B5A3]">Mention rate</div></div><div className="border-l border-[#876250] pl-5"><div className="text-[24px] font-semibold text-[#F0A46F]">14%</div><div className="text-[12px] text-[#C9B5A3]">Citation rate</div></div></div>
                        </div>
                        <div className="rounded-[18px] border border-white/10 bg-[#50382C] p-5">
                          <div className="flex items-center justify-between"><div className="text-[15px] font-semibold text-[#F4E9DE]">Engine status</div><div className="text-[12px] text-[#BCA894]">3 engines checked</div></div>
                          <div className="mt-3 space-y-2">{engineStates.map(({ Logo, engine, state, signal }) => <div key={engine} className="rounded-[12px] border border-white/10 bg-[#432F26] px-4 py-2.5"><div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2.5 text-[15px] font-medium"><Logo className="h-[17px] w-[17px]" />{engine}</span><span className="rounded-full border border-[#B87852]/70 px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide text-[#F0A46F]">{state}</span></div><div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#C76830]" style={{ width: `${signal}%` }} /></div></div>)}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {active && index === 1 && (
                    <div className="mt-3">
                      <p className="text-[14px] leading-relaxed text-[#D7C5B4]">Understand which proof, content and sources help competitors get recommended.</p>
                      <div className="relative mt-4 grid h-[238px] grid-cols-2 overflow-hidden rounded-[18px] border border-white/10 bg-[#51392D]">
                        <div className="flex flex-col justify-center p-7"><div className="text-[16px] font-semibold uppercase tracking-[0.1em] text-[#E9A96B]">Why they appear</div><ul className="mt-5 space-y-4 text-[15px] leading-snug text-[#F6EDE5]">{competitorSignals.map((item) => <li key={item} className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#F0A46F]" />{item}</li>)}</ul></div>
                        <div className="flex flex-col justify-center border-l border-[#8A6250] bg-[#493328] p-7"><div className="text-[16px] font-semibold uppercase tracking-[0.1em] text-[#D2B49C]">What you&rsquo;re missing</div><ul className="mt-5 space-y-4 text-[15px] leading-snug text-[#E0CFC0]">{missingSignals.map((item) => <li key={item} className="flex gap-3"><Minus className="mt-0.5 h-4 w-4 shrink-0 text-[#A99482]" />{item}</li>)}</ul></div>
                        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#B87852] bg-[#3A291F] text-[#F0A46F]"><ArrowRight className="h-4 w-4" /></div>
                      </div>
                    </div>
                  )}

                  {active && index === 2 && (
                    <div className="mt-3">
                      <p className="text-[14px] leading-relaxed text-[#D7C5B4]">Get clear, prioritized changes your team can implement.</p>
                      <ol className="mt-4 grid h-[238px] grid-cols-[1.08fr_0.92fr] grid-rows-2 gap-4">
                        <li className="row-span-2 flex flex-col rounded-[18px] border border-[#B87852]/65 bg-[#5A4032] p-6"><div className="flex items-center justify-between"><span className="text-[12px] font-bold tracking-[0.14em] text-[#F0A46F]">01</span><span className="rounded-full border border-[#B87852] px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-[#F0A46F]">High impact</span></div><p className="mt-auto max-w-[330px] text-[20px] font-semibold leading-snug text-white">{actions[0]}</p></li>
                        {actions.slice(1).map((action, actionIndex) => <li key={action} className="flex items-center gap-4 rounded-[16px] border border-white/10 bg-[#50382C] p-5"><span className="text-[12px] font-bold tracking-[0.14em] text-[#E9A96B]">0{actionIndex + 2}</span><div className="min-w-0 flex-1"><div className="text-[12px] font-bold uppercase tracking-wide text-[#D2B49C]">{actionIndex === 0 ? 'High impact' : 'Next step'}</div><p className="mt-2 text-[15px] font-medium leading-snug text-[#FFF8F0]">{action}</p></div><ArrowRight className="h-5 w-5 shrink-0 text-[#E9A96B]" /></li>)}
                      </ol>
                    </div>
                  )}
                </div>
              </button>
            )
          })}

          <button
            type="button"
            aria-label={`Show previous story: ${desktopStages[(activeStage + 2) % 3].title}`}
            onClick={() => selectStage((activeStage + 2) % 3)}
            className="absolute left-2 top-[210px] z-40 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[#A66A47]/60 bg-[#35261E]/95 text-[#E9A96B] shadow-lg outline-none transition-[border-color,background-color,color,transform] hover:scale-105 hover:border-[#E9A96B] hover:bg-[#4A3328] hover:text-white focus-visible:ring-2 focus-visible:ring-[#E9A96B] xl:left-10"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label={`Show next story: ${desktopStages[(activeStage + 1) % 3].title}`}
            onClick={() => selectStage((activeStage + 1) % 3)}
            className="absolute right-2 top-[210px] z-40 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[#A66A47]/60 bg-[#35261E]/95 text-[#E9A96B] shadow-lg outline-none transition-[border-color,background-color,color,transform] hover:scale-105 hover:border-[#E9A96B] hover:bg-[#4A3328] hover:text-white focus-visible:ring-2 focus-visible:ring-[#E9A96B] xl:right-10"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute bottom-7 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-[#2F211A]/90 p-1.5 backdrop-blur" aria-label="Product story progress">
            {desktopStages.map((stage, index) => (
              <button key={stage.label} type="button" onClick={() => selectStage(index)} aria-current={activeStage === index ? 'step' : undefined} className={`min-h-11 rounded-full border px-4 text-[13px] font-semibold transition-[background-color,border-color,color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9A96B] ${activeStage === index ? 'border-[#C77843] bg-[#B55B2A] text-white' : 'border-transparent text-[#BCA894] hover:border-white/10 hover:bg-white/[0.04] hover:text-white'}`}>
                <span className="mr-2 text-[11px] tracking-wider">0{index + 1}</span>{stage.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-7 max-w-2xl overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.055] backdrop-blur-xl lg:hidden">
          {mobileStages.map((stage, index) => {
            const active = openStage === index

            return (
              <div key={stage.title} className={`border-b border-white/10 border-l-2 transition-colors duration-300 last:border-b-0 ${active ? 'border-l-[#D2763C] bg-[#493228]' : 'border-l-transparent'}`}>
                <button type="button" aria-expanded={active} aria-controls={`product-stage-panel-${index}`} onClick={() => { stopAutoplay(); setOpenStage(active ? null : index) }} className={`flex min-h-[76px] w-full items-center gap-3 px-4 py-4 text-left outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#E9A96B] sm:px-5 ${active ? 'bg-[#5A3B2C]' : ''}`}>
                  <span className="shrink-0 text-[11px] font-bold tracking-[0.15em] text-[#E9A96B]">{String(index + 1).padStart(2, '0')}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-semibold leading-tight text-white">{stage.title}</span>
                    <span className={`mt-1 block text-[12px] leading-snug text-[#BCA894] transition-opacity duration-200 ${active ? 'opacity-0' : 'opacity-100'}`}>{stage.summary}</span>
                  </span>
                  <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors duration-300 ${active ? 'border-[#C77843]/70 text-[#F0A46F]' : 'border-white/10 text-[#E9A96B]'}`}>
                    <Plus className={`absolute h-4 w-4 transition-[opacity,transform] duration-300 motion-reduce:transition-none ${active ? 'rotate-180 opacity-0' : 'rotate-0 opacity-100'}`} />
                    <Minus className={`absolute h-4 w-4 transition-[opacity,transform] duration-300 motion-reduce:transition-none ${active ? 'rotate-180 opacity-100' : 'rotate-0 opacity-0'}`} />
                  </span>
                </button>
                <div id={`product-stage-panel-${index}`} aria-hidden={!active} className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none" style={{ gridTemplateRows: active ? '1fr' : '0fr' }}>
                  <div className="overflow-hidden">
                    <div className={`mx-2 mb-2 rounded-b-[14px] border-t border-[#A06D54]/55 bg-[#6A4A3A] p-3 text-[#FFF8F0] transition-[opacity,transform] duration-300 ease-out motion-reduce:translate-y-0 motion-reduce:transition-opacity sm:p-3.5 ${active ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'}`}>
                      {index === 0 && (
                        <div>
                          <div className="grid grid-cols-[1fr_auto] items-end gap-3 px-1 pb-3">
                            <div><div className="text-[9px] font-semibold uppercase tracking-wider text-[#BCA894]">AI visibility score</div><div className="mt-0.5 text-[30px] font-semibold leading-none">34<span className="text-[11px] text-[#BCA894]">/100</span></div></div>
                            <div className="grid grid-cols-2 gap-3 text-right"><div><div className="text-[16px] font-semibold text-[#F0A46F]">21%</div><div className="text-[9px] text-[#BCA894]">Mentioned</div></div><div><div className="text-[16px] font-semibold text-[#F0A46F]">14%</div><div className="text-[9px] text-[#BCA894]">Cited</div></div></div>
                          </div>
                          <div className="mt-2 space-y-2">{engineStates.map(({ Logo, engine, state, signal }, rowIndex) => <div key={engine} className={`rounded-[11px] border border-[#A36F55]/35 bg-[#493228]/90 px-3 py-2.5 transition-[opacity,transform] duration-300 motion-reduce:transition-none ${active ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'}`} style={{ transitionDelay: active ? `${70 + rowIndex * 40}ms` : '0ms' }}><div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-[12.5px] font-medium"><Logo className="h-3.5 w-3.5 text-[#E9D8CA]" />{engine}</span><span className="text-[9.5px] font-bold uppercase tracking-wider text-[#F0A46F]">{state}</span></div><div className="mt-2 h-0.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#D2763C] transition-[width] duration-300 motion-reduce:transition-none" style={{ width: active ? `${signal}%` : '0%' }} /></div></div>)}</div>
                        </div>
                      )}
                      {index === 1 && (
                        <div className="space-y-2.5">
                          <div className="rounded-[11px] border border-[#A36F55]/35 bg-[#493228]/90 p-3"><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#F0A46F]">They have</div><ul className="mt-2.5 space-y-2 text-[12.5px] leading-[1.35] text-[#F6EDE5]">{competitorSignals.map((item, rowIndex) => <li key={item} className={`flex gap-2.5 transition-[opacity,transform] duration-300 motion-reduce:transition-none ${active ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'}`} style={{ transitionDelay: active ? `${70 + rowIndex * 40}ms` : '0ms' }}><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F0A46F]" />{item}</li>)}</ul></div>
                          <div className="rounded-[11px] border border-[#8C6652]/35 bg-[#493228]/90 p-3"><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#C9B5A3]">You&rsquo;re missing</div><ul className="mt-2.5 space-y-2 text-[12.5px] leading-[1.35] text-[#E0CFC0]">{missingSignals.map((item, rowIndex) => <li key={item} className={`flex gap-2.5 transition-[opacity,transform] duration-300 motion-reduce:transition-none ${active ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'}`} style={{ transitionDelay: active ? `${190 + rowIndex * 40}ms` : '0ms' }}><Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#B9A492]" />{item}</li>)}</ul></div>
                        </div>
                      )}
                      {index === 2 && (
                        <ol className="space-y-2">
                          {actions.map((action, actionIndex) => <li key={action} className={`grid grid-cols-[18px_1fr] items-center gap-3 rounded-[11px] border border-[#A36F55]/35 bg-[#493228]/90 px-3 py-2.5 transition-[opacity,transform] duration-300 motion-reduce:transition-none ${active ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'}`} style={{ transitionDelay: active ? `${70 + actionIndex * 40}ms` : '0ms' }}><ArrowRight className="h-4 w-4 shrink-0 text-[#F0A46F]" /><span className="text-[12.5px] font-medium leading-snug">{action}</span></li>)}
                        </ol>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div id="what-you-get" className="mx-auto mt-5 flex max-w-[1120px] flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-center text-[11px] font-medium text-[#D7C5B4] sm:mt-6 sm:text-[12.5px]">
          <span>Web dashboard + PDF report</span><span className="text-[#E9A96B]">·</span><span>Real AI evidence</span><span className="text-[#E9A96B]">·</span><span>Expert-reviewed before delivery</span>
        </div>
      </div>
    </section>
  )
}

export default function LandingPage() {
  const bg = 0
  const [audience, setAudience] = useState(0)
  const [audiencePreview, setAudiencePreview] = useState<number | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const engineScrollRef = useRef<HTMLDivElement>(null)
  const visibleAudience = audiencePreview ?? audience

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
          <div className="hidden flex-1 justify-end sm:flex">
            <Link href="/score" className="rounded-full border border-[#E0D3C0] bg-white px-5 py-2.5 text-[13px] font-semibold shadow-sm transition-shadow duration-200 hover:shadow-md">
              Get free score
            </Link>
          </div>
        </nav>

        <div className="relative z-20 mx-auto grid w-full max-w-6xl flex-1 items-center gap-4 px-5 pb-8 pt-10 sm:px-6 sm:pb-14 lg:grid-cols-[1fr_1fr] lg:gap-10 lg:pb-24 lg:pt-14">
          <div className="text-center lg:text-left">
            <div className="text-[11px] font-semibold uppercase tracking-[0.26em]" style={{ color: '#9E6238' }}>{AUDIT_PRODUCT_LABEL}</div>
            <h1 className="mt-5 text-[clamp(2.1rem,4.1vw,3.5rem)] font-semibold leading-[1.08] tracking-[-0.02em]">
              When buyers ask AI who to choose, does it recommend you, or your <span style={{ color: COPPER }}>competitor</span>?
            </h1>
            <p className="mx-auto mt-5 hidden max-w-md text-[15px] leading-relaxed text-[#6E5A50] sm:block lg:mx-0">
              ClearSignal tests the buyer questions that matter across ChatGPT, Claude and Perplexity, shows who appears instead of you, and delivers an expert-reviewed plan to improve your visibility.
            </p>
            <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row sm:flex-wrap sm:gap-3 lg:mt-7 lg:justify-start">
              <Link href="/score" className="inline-flex w-full max-w-[290px] items-center justify-center gap-2 rounded-full px-4 py-3.5 text-[13.5px] font-semibold text-white transition-opacity duration-200 hover:opacity-90 sm:w-auto sm:max-w-none sm:px-6 sm:text-sm" style={{ backgroundColor: ESPRESSO }}>
                Get your free AI visibility score <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/sample" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold underline underline-offset-4 transition-opacity hover:opacity-75 sm:min-h-0 sm:rounded-full sm:border sm:border-[#E0D3C0] sm:bg-white/90 sm:px-6 sm:py-3.5 sm:no-underline sm:backdrop-blur sm:transition-shadow sm:hover:opacity-100 sm:hover:shadow-md">View sample report</Link>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:mt-5 lg:justify-start">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.18em]" style={{ color: '#7A6857' }}>Tested across</span>
              <div className="flex items-center gap-3 sm:gap-5" style={{ color: INK }}>
                {ENGINES.map(({ name, Logo }) => (
                  <span key={name} className="flex items-center gap-1.5" title={name}>
                    <Logo className="h-[17px] w-[17px] sm:h-[18px] sm:w-[18px]" />
                    <span className="text-[11.5px] font-semibold sm:text-[12.5px]">{name}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Phone group: composed as one visual */}
          <div className="relative -mb-24 -mt-8 flex scale-[0.84] justify-center sm:my-0 sm:scale-100">
            {/* depth behind the phone */}
            <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-[30rem] w-[30rem] rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,186,128,0.35) 0%, rgba(255,205,160,0.12) 45%, transparent 70%)', filter: 'blur(12px)' }} />
              <div className="absolute h-[30rem] w-[23rem] rotate-6 rounded-[3rem] border border-white/60 bg-white/25 shadow-[0_40px_100px_-50px_rgba(46,33,22,0.4)]" style={{ backdropFilter: 'blur(6px)' }} />
              <div className="absolute h-[28rem] w-[21rem] -rotate-3 translate-x-[-1.2rem] translate-y-[0.7rem] rounded-[3rem] border border-white/55 bg-white/20" style={{ backdropFilter: 'blur(5px)' }} />
              <div className="absolute h-[27rem] w-[20rem] rotate-[11deg] translate-x-[1.35rem] translate-y-[1.25rem] rounded-[3rem] border border-white/45 bg-white/15" style={{ backdropFilter: 'blur(4px)' }} />
              <div className="absolute hidden h-[31rem] w-[22rem] -translate-x-[3rem] translate-y-[1.8rem] -rotate-[10deg] rounded-[3.4rem] border border-white/35 bg-white/10 shadow-[0_45px_110px_-65px_rgba(46,33,22,0.45)] backdrop-blur-[5px] sm:block" />
              <div className="absolute hidden h-[29rem] w-[22rem] translate-x-[3.2rem] translate-y-[2.2rem] rotate-[15deg] rounded-[3.4rem] border border-white/35 bg-white/10 shadow-[0_45px_110px_-65px_rgba(46,33,22,0.45)] backdrop-blur-[5px] sm:block" />
              <div className="absolute hidden h-[24rem] w-[25rem] translate-y-[4.7rem] rotate-3 rounded-[3.4rem] border border-white/30 bg-white/[0.08] backdrop-blur-[4px] sm:block" />
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
                          <div className="text-[11px]" style={{ color: COPPER }}>named &amp; cited &middot; yourbusiness.com</div>
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
      <section id="who-its-for" className="scroll-mt-6 border-t border-[#EDE5D9] bg-white">
        <div className="mx-auto grid max-w-6xl items-start px-6 py-24 lg:grid-cols-2 lg:gap-14">
          <div className="flex flex-col lg:col-start-1 lg:row-start-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: '#9E6238' }}>Who it&rsquo;s for</div>
            <h2 className="mt-4 max-w-md text-[clamp(1.7rem,3vw,2.4rem)] font-semibold leading-[1.12] tracking-[-0.01em]">Built for teams whose buyers ask AI before they buy.</h2>
            <div className="mt-8 space-y-2">
              {AUDIENCES.map((a, i) => {
                const active = visibleAudience === i
                return (
                  <button
                    type="button"
                    key={a.name}
                    aria-controls="audience-audit-preview"
                    aria-pressed={audience === i}
                    onMouseEnter={() => {
                      if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) setAudiencePreview(i)
                    }}
                    onMouseLeave={() => {
                      if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) setAudiencePreview(null)
                    }}
                    onFocus={() => setAudiencePreview(i)}
                    onBlur={() => setAudiencePreview(null)}
                    onClick={() => {
                      setAudience(i)
                      setAudiencePreview(null)
                    }}
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
            <p className="mt-6 hidden max-w-sm text-[14.5px] leading-relaxed text-[#6E5A50] lg:block">{AUDIENCES[visibleAudience].copy}</p>
            <div className="mt-6 hidden lg:block">
              <Link href="/score" className="inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-[13.5px] font-semibold text-white transition-opacity duration-200 hover:opacity-90 sm:w-auto sm:px-6 sm:text-sm" style={{ backgroundColor: ESPRESSO }}>
                {AUDIENCES[visibleAudience].cta} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="mt-6 lg:col-start-2 lg:row-start-1 lg:mt-0">
            <AudienceAuditPreview activeIndex={visibleAudience} />
          </div>

          <div className="mt-4 lg:hidden">
            <div className="grid min-h-[92px]" aria-live="polite">
              {AUDIENCES.map((segment, index) => {
                const active = index === visibleAudience

                return (
                  <p
                    key={segment.name}
                    aria-hidden={!active}
                    className="col-start-1 row-start-1 text-[14.5px] leading-relaxed text-[#6E5A50] transition-[opacity,transform] duration-200 ease-out"
                    style={{
                      opacity: active ? 1 : 0,
                      pointerEvents: active ? 'auto' : 'none',
                      transform: active ? 'translateY(0)' : 'translateY(7px)',
                    }}
                  >
                    {segment.mobileCopy}
                  </p>
                )
              })}
            </div>
            <div className="mt-6">
              <Link href="/score" className="inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-[13.5px] font-semibold text-white transition-opacity duration-200 hover:opacity-90" style={{ backgroundColor: ESPRESSO }}>
                {AUDIENCES[visibleAudience].cta} <ArrowRight className="h-4 w-4" />
              </Link>
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

      <ProductShowcase />

      {/* ============ SECTION 6: PRICING ============ */}
      <section id="pricing" className="relative scroll-mt-6 overflow-hidden border-t border-[#E6DBCB]" style={{ background: 'linear-gradient(180deg, #FBF6EE 0%, #F5EDE1 100%)' }}>
        <SignalOverlay />
        <div className="relative z-10 mx-auto max-w-6xl px-5 py-14 sm:px-6 sm:py-24">
          <Reveal className="mx-auto max-w-2xl text-center">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: '#9E6238' }}>Founding offer</div>
            <h2 className="mt-4 text-[clamp(1.8rem,3.7vw,3rem)] font-semibold leading-[1.08] tracking-[-0.025em]">One expert-reviewed audit. No subscription required.</h2>
            <p className="mx-auto mt-4 hidden max-w-xl text-[15px] leading-relaxed text-[#6E5A50] sm:block">
              Get the evidence, priorities and implementation materials your team needs before deciding whether ongoing monitoring is worthwhile.
            </p>
          </Reveal>

          {/* Main audit card - single, centered */}
          <Reveal className="mx-auto mt-7 max-w-2xl sm:mt-12">
            <div className="flex flex-col rounded-2xl border bg-white p-4 shadow-[0_40px_90px_-55px_rgba(46,33,22,0.55)] sm:p-9" style={{ borderColor: 'rgba(169,83,31,0.28)' }}>
              <div className="flex items-start justify-between gap-3 sm:gap-6">
                <div>
                  <div className="text-[17px] font-semibold leading-snug" style={{ color: ESPRESSO }}>AI Visibility Audit</div>
                  <div className="mt-1 hidden max-w-sm text-[13px] leading-relaxed text-[#8D7B6B] sm:block">Expert-reviewed AI visibility and citation-readiness audit.</div>
                </div>
                <span className="shrink-0 rounded-full border px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-wider sm:px-3 sm:text-[10.5px]" style={{ borderColor: 'rgba(169,83,31,0.35)', color: COPPER, backgroundColor: 'rgba(169,83,31,0.06)' }}>Founding offer &middot; first 20</span>
              </div>
              <div className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-[#8D7B6B] sm:hidden">Expert-reviewed AI visibility and citation-readiness audit.</div>

              <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1 sm:mt-7 sm:gap-x-4">
                <span className="text-[52px] font-semibold leading-none tracking-[-0.03em] sm:text-[64px]" style={{ color: ESPRESSO }}>&euro;149</span>
                <span className="pb-1 text-[17px] font-medium text-[#A99B8E] line-through sm:hidden">&euro;399</span>
                <div className="hidden pb-1.5 text-[12.5px] leading-snug text-[#9B8A78] sm:block">Regular &euro;399 after the founding offer</div>
              </div>
              <div className="mt-0.5 text-[11px] leading-snug text-[#9B8A78] sm:hidden">Founding price for the first 20 audits</div>

              <ul className="mt-4 grid gap-2 text-[13.5px] sm:hidden">
                {MOBILE_PRICING_AUDIT.map((b) => (
                  <li key={b} className="flex gap-2.5 leading-[1.3]"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: COPPER }} strokeWidth={2.5} /><span className="text-[#5C5148]">{b}</span></li>
                ))}
              </ul>
              <ul className="mt-8 hidden gap-x-7 gap-y-2.5 text-[13.5px] sm:grid sm:grid-cols-2">
                {PRICING_AUDIT.map((b) => (
                  <li key={b} className="flex gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: COPPER }} strokeWidth={2.5} /><span className="text-[#5C5148]">{b}</span></li>
                ))}
              </ul>

              <Link href="/checkout" className="mt-5 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full px-6 py-3 text-[14.5px] font-semibold text-white transition-opacity duration-200 hover:opacity-90 sm:mt-8 sm:text-[15px]" style={{ backgroundColor: ESPRESSO }}>
                Order the full audit &middot; &euro;149 <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/score" className="mt-1 inline-flex min-h-11 items-center justify-center whitespace-nowrap text-[12px] font-semibold underline decoration-[#C9B7A4] underline-offset-4 transition-opacity hover:opacity-70 sm:text-[13px]">
                Not ready yet? Get your free score &rarr;
              </Link>
            </div>

            {/* Monitoring as a small secondary note, not a card */}
            <p className="mt-5 text-center text-[14px] font-semibold text-[#6E5A50]">
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
                      <p className="max-w-2xl pb-5 pr-1 text-[14px] leading-relaxed text-[#6E5A50] sm:pr-10">{item.a}</p>
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
                { label: "Who it's for", href: '#who-its-for' },
                { label: 'Workflow', href: '#workflow' },
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
          <nav className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-[12px] text-[#A08D77] md:justify-start">
            {[
              { label: 'Terms', href: '/terms' },
              { label: 'Privacy', href: '/privacy' },
              { label: 'Refund', href: '/refund' },
            ].map((l, i) => (
              <span key={l.label} className="flex items-center gap-2">
                {i > 0 && <span className="text-[#6B5844]">&middot;</span>}
                <Link href={l.href} className="transition-colors duration-200 hover:text-white">{l.label}</Link>
              </span>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  )
}
