import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle, Mail } from 'lucide-react'

export default function SuccessPage() {
  return (
    <div className="min-h-screen">
      <nav className="border-b">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <span className="text-xl font-bold tracking-tight">ClearSignal</span>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>

        <h1 className="text-3xl font-bold mb-3">Payment received!</h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          Your ClearSignal audit is now being generated. This usually takes a few minutes.
          We&apos;ll send you an email with a link to your full report as soon as it&apos;s ready.
        </p>

        <div className="bg-muted/50 rounded-lg p-4 inline-flex items-center gap-3 mb-8">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm">Check your inbox — your report link will arrive shortly.</span>
        </div>

        <div>
          <Link href="/">
            <Button variant="outline">Back to home</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
