'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Loader2, CheckCircle } from 'lucide-react'

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
      <CheckoutContent />
    </Suspense>
  )
}

function CheckoutContent() {
  const searchParams = useSearchParams()
  const scoreId = searchParams.get('score_id') || ''
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [prefilled, setPrefilled] = useState({
    email: '',
    url: '',
    competitor_1: '',
    icp_description: '',
  })

  // Pre-fill from score if available
  useEffect(() => {
    if (scoreId) {
      fetch(`/api/score/${scoreId}`)
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data) {
            setPrefilled({
              email: data.email || '',
              url: data.url || '',
              competitor_1: data.competitor_1 || '',
              icp_description: '',
            })
          }
        })
        .catch(() => {})
    }
  }, [scoreId])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = new FormData(e.currentTarget)

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.get('email'),
          url: form.get('url'),
          competitor_1: form.get('competitor_1'),
          competitor_2: form.get('competitor_2'),
          competitor_3: form.get('competitor_3'),
          icp_description: form.get('icp_description'),
          score_id: scoreId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create checkout')
      }

      const { url } = await res.json()
      window.location.href = url
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      <nav className="border-b">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-xl font-bold tracking-tight">ClearSignal</span>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2">Order your full audit</h1>
        <p className="text-muted-foreground mb-8">
          €399 — one-time payment. You&apos;ll receive your full report via email.
        </p>

        <div className="bg-muted/50 rounded-lg p-4 mb-8 space-y-2">
          {[
            'Full messaging clarity analysis',
            'Competitive gap analysis (up to 3 competitors)',
            'AI-search visibility assessment',
            '10 prioritized fixes',
            '3 rewritten outreach messages',
            'PDF + web report',
          ].map((item) => (
            <div key={item} className="flex gap-2 text-sm">
              <CheckCircle className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
              <span>{item}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="url">Homepage URL *</Label>
            <Input id="url" name="url" type="url" required className="mt-1.5"
              defaultValue={prefilled.url} placeholder="https://yourproduct.com" />
          </div>

          <div>
            <Label htmlFor="email">Email *</Label>
            <Input id="email" name="email" type="email" required className="mt-1.5"
              defaultValue={prefilled.email} placeholder="you@company.com" />
          </div>

          <div>
            <Label htmlFor="competitor_1">Competitor 1 (optional)</Label>
            <Input id="competitor_1" name="competitor_1" type="url" className="mt-1.5"
              defaultValue={prefilled.competitor_1} placeholder="https://competitor1.com" />
          </div>

          <div>
            <Label htmlFor="competitor_2">Competitor 2 (optional)</Label>
            <Input id="competitor_2" name="competitor_2" type="url" className="mt-1.5"
              placeholder="https://competitor2.com" />
          </div>

          <div>
            <Label htmlFor="competitor_3">Competitor 3 (optional)</Label>
            <Input id="competitor_3" name="competitor_3" type="url" className="mt-1.5"
              placeholder="https://competitor3.com" />
          </div>

          <div>
            <Label htmlFor="icp_description">Describe your ideal customer (optional)</Label>
            <Textarea id="icp_description" name="icp_description" rows={3} className="mt-1.5"
              defaultValue={prefilled.icp_description}
              placeholder="e.g., Series A B2B SaaS founders with 10-50 employees" />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">{error}</div>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Redirecting to payment...</>
            ) : (
              'Pay €399 and start audit'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
