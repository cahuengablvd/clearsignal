'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Loader2 } from 'lucide-react'

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
      router.push(`/score/${data.id}`)
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
        <h1 className="text-3xl font-bold mb-2">Get your free ClearSignal score</h1>
        <p className="text-muted-foreground mb-8">
          Enter your homepage URL and we&apos;ll analyze 5 key conversion dimensions in seconds.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="url">Homepage URL *</Label>
            <Input
              id="url"
              name="url"
              type="url"
              placeholder="https://yourproduct.com"
              required
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@company.com"
              required
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="competitor_1">Competitor URL (optional)</Label>
            <Input
              id="competitor_1"
              name="competitor_1"
              type="url"
              placeholder="https://competitor.com"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="icp_description">Who is your ideal customer? (optional)</Label>
            <Textarea
              id="icp_description"
              name="icp_description"
              placeholder="e.g., Series A B2B SaaS founders with 10-50 employees looking to improve conversion rates"
              rows={3}
              className="mt-1.5"
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing your homepage...
              </>
            ) : (
              'Get my free score'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
