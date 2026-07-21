'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PublicPageHeader } from '@/components/public-page-header'
import { Check, Loader2, LockKeyhole } from 'lucide-react'

const DRAFT_KEY = 'clearsignal-paid-checkout-draft'

type CheckoutDraft = {
  email: string
  url: string
  competitor_1: string
  competitor_2: string
  competitor_3: string
  icp_description: string
  business_model: string
  primary_conversion_goal: string
  target_markets_languages: string
  verified_facts: string
}

const EMPTY_DRAFT: CheckoutDraft = {
  email: '',
  url: '',
  competitor_1: '',
  competitor_2: '',
  competitor_3: '',
  icp_description: '',
  business_model: '',
  primary_conversion_goal: '',
  target_markets_languages: '',
  verified_facts: '',
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-[#FBF6EE]"><Loader2 className="h-6 w-6 animate-spin text-[#A9531F]" /></div>}>
      <CheckoutContent />
    </Suspense>
  )
}

function CheckoutContent() {
  const searchParams = useSearchParams()
  const scoreId = searchParams.get('score_id') || ''
  const scoreToken = searchParams.get('token') || ''
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<CheckoutDraft>(EMPTY_DRAFT)

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(DRAFT_KEY)
      if (stored) setDraft((current) => ({ ...current, ...JSON.parse(stored) }))
    } catch {
      // Storage can be unavailable in privacy-restricted browsers.
    }

    if (!scoreId) return
    const qs = scoreToken ? `?token=${encodeURIComponent(scoreToken)}` : ''
    fetch(`/api/score/${scoreId}${qs}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data) return
        setDraft((current) => ({
          ...current,
          email: current.email || data.email || '',
          url: current.url || data.url || '',
          competitor_1: current.competitor_1 || data.competitor_1 || '',
        }))
      })
      .catch(() => {})
  }, [scoreId, scoreToken])

  function updateDraft(field: keyof CheckoutDraft, value: string) {
    setDraft((current) => {
      const next = { ...current, [field]: value }
      try {
        window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next))
      } catch {
        // The server still persists the order before redirecting to Stripe.
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: draft.email,
          url: draft.url,
          competitor_1: draft.competitor_1,
          competitor_2: draft.competitor_2,
          competitor_3: draft.competitor_3,
          icp_description: draft.icp_description,
          business_context: {
            business_model: draft.business_model || 'unknown',
            primary_conversion_goal: draft.primary_conversion_goal || 'unknown',
            target_markets_languages: draft.target_markets_languages,
            verified_facts: draft.verified_facts,
          },
          score_id: scoreId,
          score_token: scoreToken,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create checkout')
      window.location.href = data.url
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  const fieldClass = 'mt-2 min-h-12 border-[#DCCDBA] bg-white text-[#2E2116] placeholder:text-[#A08E80] focus-visible:ring-[#A9531F]'

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#FBF6EE] text-[#2E2116]">
      <div
        className="pointer-events-none absolute inset-0 opacity-55"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(rgba(169,83,31,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(169,83,31,0.045) 1px, transparent 1px), radial-gradient(circle at 12% 18%, rgba(231,150,83,0.18), transparent 34%)',
          backgroundSize: '72px 72px, 72px 72px, 100% 100%',
        }}
      />
      <div className="relative">
        <PublicPageHeader actionHref="/sample" actionLabel="View sample report" />

        <main className="mx-auto grid max-w-6xl items-start gap-10 px-5 py-10 sm:px-6 sm:py-14 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16 lg:py-20">
          <section className="lg:sticky lg:top-28">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#A9531F]">AI Visibility Audit</p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.05] sm:text-5xl">Order your full audit</h1>
            <p className="mt-5 text-lg leading-7 text-[#6E5A50]">
              <strong className="text-[#2E2116]">&euro;149</strong> one-time payment. No subscription required.
            </p>
            <div className="mt-8 space-y-3">
              {[
                'AI visibility scan across ChatGPT, Claude and Perplexity',
                'Competitor and citation gap analysis',
                'Website clarity and trust review',
                'Prioritized action plan and draft implementation materials',
                'PDF report, web dashboard and human review',
              ].map((item) => (
                <div key={item} className="flex gap-3 text-sm leading-6 text-[#5F4B40]">
                  <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#FFF1E3] text-[#A9531F]">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <p className="mt-8 flex items-center gap-2 text-xs leading-5 text-[#8D7B6B]">
              <LockKeyhole className="h-4 w-4 text-[#A9531F]" aria-hidden="true" />
              Secure payment handled by Stripe.
            </p>
          </section>

          <section className="rounded-2xl border border-[#E5D7C5] bg-[#FFFDF9] p-5 shadow-[0_28px_80px_rgba(78,49,27,0.12)] sm:p-8">
            <div className="mb-7">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A9531F]">Audit details</p>
              <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Tell us what to review</h2>
              <p className="mt-3 text-sm leading-6 text-[#756257]">Only your website and email are required. Extra context makes the report more specific.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <Field label="Homepage URL *" id="url">
                <Input id="url" type="url" required value={draft.url} onChange={(e) => updateDraft('url', e.target.value)} placeholder="https://yourproduct.com" className={fieldClass} />
              </Field>
              <Field label="Email *" id="email">
                <Input id="email" type="email" required value={draft.email} onChange={(e) => updateDraft('email', e.target.value)} placeholder="you@company.com" className={fieldClass} />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                {[1, 2, 3].map((number) => {
                  const field = `competitor_${number}` as 'competitor_1' | 'competitor_2' | 'competitor_3'
                  return (
                    <Field key={field} label={`Competitor ${number} (optional)`} id={field}>
                      <Input id={field} type="url" value={draft[field]} onChange={(e) => updateDraft(field, e.target.value)} placeholder="https://competitor.com" className={fieldClass} />
                    </Field>
                  )
                })}
              </div>

              <Field label="Describe your ideal customer (optional)" id="icp_description">
                <Textarea id="icp_description" rows={3} maxLength={2000} value={draft.icp_description} onChange={(e) => updateDraft('icp_description', e.target.value)} placeholder="Who buys from you, and what are they trying to achieve?" className={fieldClass} />
              </Field>

              <div className="border-t border-[#E9DDCE] pt-6">
                <h3 className="font-semibold">Optional business context</h3>
                <p className="mt-1 text-sm leading-6 text-[#756257]">These are treated as details supplied by you, not as crawler observations.</p>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Field label="Business model" id="business_model">
                    <Input id="business_model" maxLength={120} value={draft.business_model} onChange={(e) => updateDraft('business_model', e.target.value)} placeholder="e.g., Service business" className={fieldClass} />
                  </Field>
                  <Field label="Primary conversion goal" id="primary_conversion_goal">
                    <Input id="primary_conversion_goal" maxLength={120} value={draft.primary_conversion_goal} onChange={(e) => updateDraft('primary_conversion_goal', e.target.value)} placeholder="e.g., Quote request" className={fieldClass} />
                  </Field>
                </div>
                <div className="mt-5 space-y-5">
                  <Field label="Target markets and languages" id="target_markets_languages">
                    <Textarea id="target_markets_languages" rows={2} maxLength={1000} value={draft.target_markets_languages} onChange={(e) => updateDraft('target_markets_languages', e.target.value)} placeholder="e.g., Toronto and GTA; English" className={fieldClass} />
                  </Field>
                  <Field label="Verified facts we may use" id="verified_facts">
                    <Textarea id="verified_facts" rows={3} maxLength={2000} value={draft.verified_facts} onChange={(e) => updateDraft('verified_facts', e.target.value)} placeholder="Confirmed services, credentials, locations or policies. Leave blank if unknown." className={fieldClass} />
                  </Field>
                </div>
              </div>

              {error && <div className="rounded-lg border border-[#E8B7A5] bg-[#FFF2ED] p-3 text-sm text-[#9A3F26]" role="alert">{error}</div>}

              <Button type="submit" size="lg" className="min-h-12 w-full rounded-full bg-[#2E2116] text-white hover:bg-[#4B3424]" disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing secure payment...</> : <>Pay &euro;149 and start audit</>}
              </Button>
              <p className="text-center text-xs leading-5 text-[#8D7B6B]">Your order details are saved before you continue to Stripe.</p>
            </form>
          </section>
        </main>
      </div>
    </div>
  )
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id} className="text-[#3D2E22]">{label}</Label>
      {children}
    </div>
  )
}
