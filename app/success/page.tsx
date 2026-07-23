import Link from 'next/link'
import { CheckCircle2, Mail, ShieldAlert } from 'lucide-react'
import { PublicPageHeader } from '@/components/public-page-header'
import { DELIVERY_PROMISE } from '@/lib/delivery-promise'
import { isPaidCheckoutSession } from '@/lib/stripe-session'

const CONTACT_EMAIL = 'hello@getclearsignal.io'

export default async function SuccessPage({
  searchParams,
}: {
  searchParams?: { session_id?: string | string[] }
}) {
  const rawSessionId = searchParams?.session_id
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId
  const paid = await isPaidCheckoutSession(sessionId)

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#FBF6EE] text-[#2E2116]">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(rgba(169,83,31,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(169,83,31,0.045) 1px, transparent 1px), radial-gradient(circle at 50% 24%, rgba(231,150,83,0.2), transparent 36%)',
          backgroundSize: '72px 72px, 72px 72px, 100% 100%',
        }}
      />
      <div className="relative">
        <PublicPageHeader />
        <main className="mx-auto max-w-2xl px-5 py-14 text-center sm:px-6 sm:py-24">
          <section className="rounded-2xl border border-[#E5D7C5] bg-[#FFFDF9] p-6 shadow-[0_28px_80px_rgba(78,49,27,0.12)] sm:p-10">
            {paid ? (
              <>
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-[#DDB58E] bg-[#FFF1E3] text-[#A9531F]">
                  <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
                </span>
                <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-[#A9531F]">Payment confirmed</p>
                <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Your audit is in the queue</h1>
                <p className="mt-5 text-base leading-7 text-[#6E5A50]">
                  We are generating your audit now. A person will review the findings before we email your web report and PDF.
                </p>
                <p className="mt-4 text-base leading-7 text-[#6E5A50]">{DELIVERY_PROMISE}</p>
                <div className="mt-7 inline-flex items-center gap-3 rounded-full border border-[#E2D4C2] bg-[#FBF6EE] px-4 py-3 text-sm text-[#5F4B40]">
                  <Mail className="h-4 w-4 text-[#A9531F]" aria-hidden="true" />
                  Watch your inbox for the order confirmation.
                </div>
              </>
            ) : (
              <>
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-[#DDB58E] bg-[#FFF1E3] text-[#A9531F]">
                  <ShieldAlert className="h-7 w-7" aria-hidden="true" />
                </span>
                <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-[#A9531F]">Payment not confirmed</p>
                <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">We could not verify this payment</h1>
                <p className="mt-5 text-base leading-7 text-[#6E5A50]">
                  No paid Stripe session was found for this page. If your card was charged, contact us and we will check the order.
                </p>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-[#2E2116] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#4B3424]"
                >
                  Contact ClearSignal
                </a>
              </>
            )}
            <div className="mt-7">
              <Link href="/" className="text-sm font-semibold text-[#8C421A] hover:underline">Back to home</Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
