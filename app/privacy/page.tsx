import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — ClearSignal',
  description: 'How ClearSignal collects, uses and protects personal data.',
  alternates: { canonical: '/privacy' },
}

const UPDATED = '16 July 2026'

const SUBPROCESSORS: { name: string; purpose: string; where: string }[] = [
  { name: 'Vercel', purpose: 'Website and application hosting', where: 'USA / EU' },
  { name: 'Supabase', purpose: 'Database storing your order, audit inputs and report', where: 'Stockholm, Sweden (EU)' },
  { name: 'Stripe', purpose: 'Payment processing', where: 'USA / EU' },
  { name: 'Resend', purpose: 'Sending the report delivery email', where: 'USA / EU' },
  { name: 'Trigger.dev', purpose: 'Running the audit as a background job', where: 'USA / EU' },
  { name: 'Firecrawl', purpose: 'Fetching your publicly available website content', where: 'USA' },
  { name: 'Anthropic (Claude)', purpose: 'Analysing content and generating report text', where: 'USA' },
  { name: 'OpenAI', purpose: 'Testing how the engine answers questions about your category', where: 'USA' },
  { name: 'Perplexity', purpose: 'Testing how the engine answers questions about your category', where: 'USA' },
  { name: 'Google', purpose: 'Testing how the engine answers questions about your category', where: 'USA' },
  { name: 'Upstash', purpose: 'Rate limiting to prevent abuse', where: 'USA / EU' },
]

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#FBF6EE] text-[#2E2116]">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="text-[13px] font-semibold text-[#A9531F] hover:opacity-80">
          &larr; Back to ClearSignal
        </Link>

        <h1 className="mt-8 text-[clamp(2rem,4vw,2.75rem)] font-semibold tracking-[-0.02em]">Privacy Policy</h1>
        <p className="mt-3 text-[13px] text-[#8D7B6B]">Last updated: {UPDATED}</p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-[#4A3A2D]">
          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">1. Who is responsible for your data</h2>
            <p className="mt-3">
              The data controller is Alexander Kalinko, a sole trader based at Gaujas street 5C, M&#257;rupe, LV-2167,
              Latvia, operating as ClearSignal. For any privacy question or request, contact{' '}
              <a href="mailto:hello@getclearsignal.io" className="font-semibold text-[#A9531F] hover:opacity-80">hello@getclearsignal.io</a>.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">2. What we collect</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li><strong>Order and audit data:</strong> your email address, the website address you submit, competitor website addresses, and the audience/ICP description you provide.</li>
              <li><strong>Payment data:</strong> handled by Stripe. We receive confirmation of payment and limited transaction details. <strong>We never receive or store your card number.</strong></li>
              <li><strong>Report data:</strong> the generated report, the AI answers collected during the scan, and the publicly available website content analysed.</li>
              <li><strong>Technical data:</strong> standard server and security logs, and data used for rate limiting.</li>
            </ul>
            <p className="mt-3">
              We do not ask you for special categories of personal data. Please do not submit them.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">3. Why we use it, and on what legal basis</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li><strong>To perform our contract with you</strong> (Art. 6(1)(b) GDPR): running the audit, producing and delivering the report, and providing support.</li>
              <li><strong>Our legitimate interests</strong> (Art. 6(1)(f) GDPR): keeping the service secure, preventing abuse, and improving the quality of our reports.</li>
              <li><strong>Legal obligation</strong> (Art. 6(1)(c) GDPR): keeping records required for accounting and tax.</li>
            </ul>
            <p className="mt-3">
              We do not sell your data, and we do not use it for advertising.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">4. Automated processing and AI</h2>
            <p className="mt-3">
              Producing your report involves automated analysis and AI models. Specifically, the website address and
              business name you submit, and content publicly available on that website, are sent to the AI providers
              listed below so we can test how those engines describe your business and generate the report text.
            </p>
            <p className="mt-3">
              Every report is reviewed by a person before it is delivered. The processing does not produce legal or
              similarly significant effects on any individual within the meaning of Art. 22 GDPR.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">5. Who we share it with (sub-processors)</h2>
            <p className="mt-3">We use the following providers to deliver the service:</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-[13.5px]">
                <thead>
                  <tr className="border-b border-[#E4DACB] text-left text-[11px] uppercase tracking-wider text-[#8D7B6B]">
                    <th className="py-2 pr-4 font-semibold">Provider</th>
                    <th className="py-2 pr-4 font-semibold">Purpose</th>
                    <th className="py-2 font-semibold">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {SUBPROCESSORS.map((p) => (
                    <tr key={p.name} className="border-b border-[#EFE7DB] align-top">
                      <td className="py-2.5 pr-4 font-medium text-[#2E2116]">{p.name}</td>
                      <td className="py-2.5 pr-4 text-[#5C5148]">{p.purpose}</td>
                      <td className="py-2.5 text-[#8D7B6B]">{p.where}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">6. International transfers</h2>
            <p className="mt-3">
              Several of the providers above are located in the United States. Where personal data is transferred
              outside the EEA, the transfer is based on the European Commission&rsquo;s Standard Contractual Clauses or
              another lawful transfer mechanism offered by that provider.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">7. How long we keep it</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li><strong>Audit reports and order data:</strong> kept for 12 months so you can access your report, then deleted or anonymised.</li>
              <li><strong>Accounting records:</strong> kept for the period required by law in Latvia.</li>
              <li><strong>Free score submissions:</strong> kept for 12 months.</li>
            </ul>
            <p className="mt-3">You can ask us to delete your data earlier — see below.</p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">8. Your rights</h2>
            <p className="mt-3">
              Under the GDPR you have the right to access your data, correct it, delete it, restrict or object to its
              processing, and receive it in a portable format. To exercise any of these, email{' '}
              <a href="mailto:hello@getclearsignal.io" className="font-semibold text-[#A9531F] hover:opacity-80">hello@getclearsignal.io</a>. We will
              respond within one month.
            </p>
            <p className="mt-3">
              You also have the right to lodge a complaint with your local data protection supervisory authority.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">9. Cookies</h2>
            <p className="mt-3">
              We use only what is necessary to run the site: a session cookie for our own administration area, and
              technical data required for security and rate limiting. We do not use analytics, tracking or advertising
              cookies, and we do not embed third-party tracking scripts. If this changes, we will update this policy
              and ask for your consent where required.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">10. Security</h2>
            <p className="mt-3">
              Data is transmitted over encrypted connections and stored with the providers listed above. Access to
              reports is limited to you, via the link we send, and to our administration area.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">11. Changes</h2>
            <p className="mt-3">
              We may update this policy. The current version is always published on this page with its date.
            </p>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold text-[#2E2116]">12. Contact</h2>
            <p className="mt-3">
              <a href="mailto:hello@getclearsignal.io" className="font-semibold text-[#A9531F] hover:opacity-80">hello@getclearsignal.io</a>
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
