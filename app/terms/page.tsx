import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service — ClearSignal',
  description: 'The terms that apply to ClearSignal AI visibility audits.',
}

const UPDATED = '16 July 2026'

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#FBF6EE] text-[#2E2116]">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="text-[13px] font-semibold text-[#A9531F] hover:opacity-80">
          &larr; Back to ClearSignal
        </Link>

        <h1 className="mt-8 text-[clamp(2rem,4vw,2.75rem)] font-semibold tracking-[-0.02em]">Terms of Service</h1>
        <p className="mt-3 text-[13px] text-[#8D7B6B]">Last updated: {UPDATED}</p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-[#4A3A2D]">
          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">1. Who we are</h2>
            <p className="mt-3">
              ClearSignal (&ldquo;ClearSignal&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is operated by Alexander Kalinko,
              a sole trader based in Latvia, Gaujas street 5C, M&#257;rupe, LV-2167, Latvia. You can reach us at{' '}
              <a href="mailto:alexanderkalinko@gmail.com" className="font-semibold text-[#A9531F] hover:opacity-80">alexanderkalinko@gmail.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">2. What these terms cover</h2>
            <p className="mt-3">
              These terms apply when you order an AI Visibility Audit from us, or use the free AI visibility score on
              this website. By placing an order you accept these terms.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">3. Business customers only</h2>
            <p className="mt-3">
              ClearSignal is offered to businesses and professionals for purposes related to their trade or profession.
              It is not intended for consumers. If you are a consumer under applicable law, your statutory rights are
              not affected by these terms.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">4. The service</h2>
            <p className="mt-3">An AI Visibility Audit consists of:</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>an automated scan that tests how AI answer engines respond to a structured set of buyer-intent questions about your category;</li>
              <li>a review of your publicly available website content and of the competitors you name;</li>
              <li>a report containing a visibility score, mention and citation rates, competitor and source gaps, and prioritized recommended changes;</li>
              <li>a review by a person before the report is delivered to you.</li>
            </ul>
            <p className="mt-3">
              The report is delivered as a web report and a downloadable PDF.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">5. What the audit is not</h2>
            <p className="mt-3">
              This is the most important section of these terms. Please read it.
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>
                <strong>We do not guarantee any result.</strong> AI answer engines are controlled by third parties
                (such as OpenAI, Anthropic, Perplexity and Google). We cannot guarantee that your business will be
                named, cited, recommended or ranked by any engine, at any time, or that visibility will improve.
              </li>
              <li>
                <strong>Findings are a point-in-time measurement.</strong> The audit reflects the responses returned by
                the tested engines, for the tested question set, at the time of the scan. AI systems and their sources
                change continuously, and repeating the same scan later may produce different results.
              </li>
              <li>
                <strong>We do not promise commercial outcomes.</strong> We make no claim about traffic, leads,
                conversions, revenue or return on investment.
              </li>
              <li>
                <strong>Recommendations are advisory.</strong> Deciding whether and how to implement them, and the
                consequences of doing so, are your responsibility.
              </li>
              <li>
                The audit is not legal, financial, tax or professional advice.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">6. Orders, price and payment</h2>
            <p className="mt-3">
              The founding price is <strong>&euro;149</strong> per audit for the first 20 audits. The regular price is
              &euro;399. Prices are one-time, per audit, in euro, and the amount shown at checkout is the total amount
              payable for one audit.
            </p>
            <p className="mt-3">
              Payments are processed by Stripe. We do not receive or store your card details. Your order is confirmed
              once Stripe confirms payment.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">7. Delivery</h2>
            <p className="mt-3">
              We aim to deliver your report <strong>within 2 business days</strong> of confirmed payment. Because every
              report is reviewed by a person before delivery, this is a target rather than a guaranteed deadline. If we
              expect a material delay, we will tell you by email. If we cannot deliver at all, we will refund you in
              full.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">8. Your responsibilities</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>Provide an accurate website address and, where relevant, accurate competitor addresses and audience description. The quality of the audit depends on this.</li>
              <li>Confirm that you are entitled to request an analysis of the website you submit.</li>
              <li>Do not submit websites or content that are unlawful, or that you have no right to have analysed.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">9. Use of the report</h2>
            <p className="mt-3">
              The report is produced for you and licensed for your internal business use, including use with your own
              clients where the audit was ordered on their behalf. You may not resell, republish or redistribute the
              report as a standalone product without our written agreement. We retain all rights in our methodology,
              templates, scoring and software.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">10. Refunds</h2>
            <p className="mt-3">
              See our <Link href="/refund" className="font-semibold text-[#A9531F] hover:opacity-80">Refund Policy</Link>,
              which forms part of these terms.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">11. Liability</h2>
            <p className="mt-3">
              Nothing in these terms excludes liability that cannot be excluded by law. Subject to that, our total
              liability arising out of or in connection with an audit is limited to the amount you paid for that audit.
              We are not liable for indirect or consequential loss, or for loss of profit, revenue, data or goodwill.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">12. Availability</h2>
            <p className="mt-3">
              ClearSignal is provided on an &ldquo;as available&rdquo; basis. We may change, suspend or discontinue any
              part of the service, including the free score. Where we discontinue something you have paid for and not
              received, we will refund you.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">13. Changes to these terms</h2>
            <p className="mt-3">
              We may update these terms. The version in force is the one published here on the date you place your
              order.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">14. Governing law</h2>
            <p className="mt-3">
              These terms are governed by the laws of Latvia, and the courts of Latvia have exclusive jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">15. Contact</h2>
            <p className="mt-3">
              <a href="mailto:alexanderkalinko@gmail.com" className="font-semibold text-[#A9531F] hover:opacity-80">alexanderkalinko@gmail.com</a>
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
