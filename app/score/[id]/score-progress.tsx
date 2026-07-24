'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ScoreProgress({
  id,
  token,
  status,
  reason,
}: {
  id: string
  token: string
  status: 'processing' | 'failed'
  reason?: string | null
}) {
  const router = useRouter()

  useEffect(() => {
    if (status !== 'processing') return

    const poll = async () => {
      try {
        const response = await fetch(
          `/api/score/${id}?token=${encodeURIComponent(token)}`,
          { cache: 'no-store' }
        )
        if (!response.ok) return
        const data = await response.json()
        if (data.status !== 'processing') router.refresh()
      } catch {
        // A suspended mobile tab resumes polling when connectivity returns.
      }
    }

    const timer = window.setInterval(poll, 3000)
    void poll()
    return () => window.clearInterval(timer)
  }, [id, router, status, token])

  if (status === 'failed') {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-[#E8B7A5] bg-[#FFFDF9] p-8 text-center">
        <h1 className="text-3xl font-semibold">We could not finish the check</h1>
        <p className="mt-4 text-[#6E5A50]">
          {reason || 'Please start a new check and try again.'}
        </p>
        <Button className="mt-6 rounded-full" onClick={() => router.push('/score')}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div
      className="mx-auto max-w-xl rounded-2xl border border-[#E5D7C5] bg-[#FFFDF9] p-8 text-center"
      role="status"
    >
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#A9531F]" />
      <h1 className="mt-5 text-3xl font-semibold">Your check is running</h1>
      <p className="mt-4 text-[#6E5A50]">
        You can lock your phone or close this page. Reopen this link to resume.
      </p>
    </div>
  )
}
