import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Refund Policy — ClearSignal',
  description: 'When ClearSignal refunds an AI visibility audit.',
}

const UPDATED = '16 July 2026'

export default function RefundPage() {
  return (
    <main className="min-h-screen bg-[#FBF6EE] text-[#2E2116]">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="text-[13px] font-semibold text-[#A9531F] hover:opacity-80">
          &larr; Back to ClearSignal
        </Link>

        <h1 className="mt-8 text-[clamp(2rem,4vw,2.75rem)] font-semibold tracking-[-0.02em]">Refund Policy</h1>
        <p className="mt-3 text-[13px] text-[#8D7B6B]">Last updated: {UPDATED}</p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-[#4A3A2D]">
          <section>
            <p>
              An AI Visibility Audit is a one-off digital report produced specifically for the website you submit. This
              policy explains exactly when we refund it. It forms part of our{' '}
              <Link href="/terms" className="font-semibold text-[#A9531F] hover:opacity-80">Terms of Service</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">Before we start work: full refund</h2>
            <p className="mt-3">
              If you change your mind before your audit has been generated, email us and we will refund you in full, no
              questions asked. Because we usually start within hours of payment, tell us as soon as possible.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">If we cannot deliver: full refund</h2>
            <p className="mt-3">
              If we are unable to produce your report — for example your website cannot be accessed, or the scan cannot
              be completed — we refund you in full. You are never charged for an audit you did not receive.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">After delivery</h2>
            <p className="mt-3">
              Once the report has been delivered, the work is complete and it cannot be &ldquo;returned&rdquo;, so we do
              not offer refunds simply because you disagree with the recommendations or because the findings were not
              what you hoped for. A low visibility score is a valid result, not a defective product.
            </p>
            <p className="mt-3">
              <strong>However, we stand behind the quality of the report.</strong> If within <strong>14 days</strong> of
              delivery you can show that the report contains material factual errors about your business, or that it is
              unusable, contact us at <a href="mailto:alexanderkalinko@gmail.com" className="font-semibold text-[#A9531F] hover:opacity-80">alexanderkalinko@gmail.com</a> with the specifics. We will either correct and re-issue the
              report, or refund you. We would rather fix it than keep money for work that did not help you.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">What is not a ground for refund</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>AI engines not naming, citing or recommending your business — we never guarantee this, and it is outside our control.</li>
              <li>Results changing after the scan, because AI systems and their sources change continuously.</li>
              <li>The absence of traffic, leads, conversions or revenue after implementing recommendations.</li>
              <li>Not implementing the recommendations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">How to request a refund</h2>
            <p className="mt-3">
              Email <a href="mailto:alexanderkalinko@gmail.com" className="font-semibold text-[#A9531F] hover:opacity-80">alexanderkalinko@gmail.com</a> from the address used for the order, with your order details and the reason.
              Approved refunds are returned to the original payment method via Stripe, normally within 5–10 business
              days depending on your bank.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">Chargebacks</h2>
            <p className="mt-3">
              If something is wrong, please contact us first — we will almost always sort it out faster than your bank
              can. Opening a chargeback without contacting us does not get you a quicker outcome.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">Your statutory rights</h2>
            <p className="mt-3">
              ClearSignal is sold to businesses and professionals. If you are a consumer under applicable law, your
              statutory rights, including any right of withdrawal, are not affected by this policy.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">Contact</h2>
            <p className="mt-3"><a href="mailto:alexanderkalinko@gmail.com" className="font-semibold text-[#A9531F] hover:opacity-80">alexanderkalinko@gmail.com</a></p>
          </section>
        </div>
      </div>
    </main>
  )
}
