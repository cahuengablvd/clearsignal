'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PublicPageHeader } from '@/components/public-page-header'
import { BarChart3, FileCheck2, Loader2, SearchCheck } from 'lucide-react'

export default function ScorePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = new FormData(e.currentTarget)
    const url = form.get('url') as string
    const email = form.get('email') as string
    const competitor_1 = form.get('competitor_1') as string
    const icp_description = form.get('icp_description') as string

    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, email, competitor_1, icp_description }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Something went wrong')
      }

      const data = await res.json()
      router.push(`/score/${data.id}?token=${encodeURIComponent(data.token)}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#FBF6EE] text-[#2E2116]">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(rgba(169,83,31,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(169,83,31,0.045) 1px, transparent 1px), radial-gradient(circle at 12% 18%, rgba(231,150,83,0.18), transparent 34%)',
          backgroundSize: '72px 72px, 72px 72px, 100% 100%',
        }}
      />
      <div className="relative">
        <PublicPageHeader actionHref="/sample" actionLabel="View sample report" />

        <main className="mx-auto grid max-w-6xl items-start gap-10 px-5 py-10 sm:px-6 sm:py-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-20">
          <section className="lg:sticky lg:top-28">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#A9531F]">
              Free AI visibility check
            </p>
            <h1 className="mt-5 max-w-xl text-4xl font-semibold leading-[1.05] sm:text-5xl">
              Get your free AI visibility score
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-[#6E5A50] sm:text-lg">
              See whether ChatGPT, Claude and Perplexity understand and recommend your business.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <ScoreBenefit
                icon={SearchCheck}
                title="Initial visibility snapshot"
              />
              <ScoreBenefit
                icon={BarChart3}
                title="Five website clarity checks"
              />
              <ScoreBenefit
                icon={FileCheck2}
                title="No analytics access required"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-[#E5D7C5] bg-[#FFFDF9] p-5 shadow-[0_28px_80px_rgba(78,49,27,0.12)] sm:p-8">
            <div className="mb-7">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A9531F]">
                Start your check
              </p>
              <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Start your visibility check</h2>
              <p className="mt-3 text-sm leading-6 text-[#756257]">
                Add your website and contact details. We&apos;ll run the check and take you to your result page.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="url" className="text-[#3D2E22]">Homepage URL *</Label>
            <Input
              id="url"
              name="url"
              type="url"
              placeholder="https://yourproduct.com"
              required
              className="mt-2 min-h-12 border-[#DCCDBA] bg-white text-[#2E2116] placeholder:text-[#A08E80] focus-visible:ring-[#A9531F]"
            />
          </div>

          <div>
            <Label htmlFor="email" className="text-[#3D2E22]">Email *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@company.com"
              required
              className="mt-2 min-h-12 border-[#DCCDBA] bg-white text-[#2E2116] placeholder:text-[#A08E80] focus-visible:ring-[#A9531F]"
            />
          </div>

          <div>
            <Label htmlFor="competitor_1" className="text-[#3D2E22]">Competitor URL (optional)</Label>
            <Input
              id="competitor_1"
              name="competitor_1"
              type="url"
              placeholder="https://competitor.com"
              className="mt-2 min-h-12 border-[#DCCDBA] bg-white text-[#2E2116] placeholder:text-[#A08E80] focus-visible:ring-[#A9531F]"
            />
          </div>

          <div>
            <Label htmlFor="icp_description" className="text-[#3D2E22]">Who is your ideal customer? (optional)</Label>
            <Textarea
              id="icp_description"
              name="icp_description"
              placeholder="e.g., Series A B2B SaaS founders with 10-50 employees looking to improve conversion rates"
              rows={3}
              className="mt-2 border-[#DCCDBA] bg-white text-[#2E2116] placeholder:text-[#A08E80] focus-visible:ring-[#A9531F]"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-[#E8B7A5] bg-[#FFF2ED] p-3 text-sm text-[#9A3F26]" role="alert">
              {error}
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="min-h-12 w-full rounded-full bg-[#2E2116] text-white hover:bg-[#4B3424]"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running your visibility check...
              </>
            ) : (
              'Get your free AI visibility score'
            )}
          </Button>
            </form>

            <p className="mt-5 text-center text-xs leading-5 text-[#8D7B6B]">
              Uses publicly available website content. No analytics connection required.
            </p>
          </section>
        </main>
      </div>
    </div>
  )
}

function ScoreBenefit({
  icon: Icon,
  title,
}: {
  icon: typeof SearchCheck
  title: string
}) {
  return (
    <div className="flex max-w-lg gap-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#DDCDB9] bg-[#FFF9F2] text-[#A9531F]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 className="self-center text-sm font-semibold leading-5 text-[#3D2E22]">{title}</h2>
    </div>
  )
}
