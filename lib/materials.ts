/**
 * Ready-to-ship materials (#17).
 *
 * The LLM writes the copy (meta/FAQ/CTA). The JSON-LD snippet is built
 * DETERMINISTICALLY here from the brand + FAQ so it is always valid schema.org
 * (Organization + FAQPage) rather than hallucinated markup.
 */
import type { BusinessContext, ObservedBusinessContext, ReadyMaterialsLlm, ReadyMaterials } from './schemas'

function orgName(brand: string, url: string): string {
  if (brand && brand.trim()) return brand.trim()
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function isMovingBusiness(
  brand: string,
  url: string,
  faq: { question: string; answer: string }[],
  observed?: ObservedBusinessContext
): boolean {
  if (/moving/i.test(observed?.inferred_business_type || '') || /moving/i.test(observed?.observed_service_category || '')) {
    return true
  }
  const haystack = `${brand} ${url} ${faq.map((f) => `${f.question} ${f.answer}`).join(' ')}`.toLowerCase()
  return /\b(moving|movers?|relocation|relocations|piano moving|commercial move|residential move)\b/.test(haystack)
}

function areaServedFromText(
  faq: { question: string; answer: string }[],
  observed?: ObservedBusinessContext
): string[] {
  if (observed?.observed_location?.length) return observed.observed_location
  const text = faq.map((f) => `${f.question} ${f.answer}`).join(' ')
  const areas = ['Toronto', 'Ontario', 'Canada', 'Quebec']
  return areas.filter((area) => new RegExp(`\\b${area}\\b`, 'i').test(text))
}

function hasVerifiedText(ctx: BusinessContext | undefined, pattern: RegExp): boolean {
  return pattern.test(ctx?.verified_facts || '')
}

function neutralMovingMaterials(
  brand: string,
  url: string,
  llm: ReadyMaterialsLlm,
  observed?: ObservedBusinessContext
): ReadyMaterialsLlm {
  const name = orgName(brand, url)
  const locations = observed?.observed_location?.length ? ` in ${observed.observed_location.join(' / ')}` : ''
  const servicePhrase = observed?.observed_services?.length
    ? observed.observed_services.slice(0, 2).join(' and ').toLowerCase()
    : 'residential and commercial moving'
  return {
    meta_title: llm.meta_title || `${name} | Moving Services`,
    meta_description: `${name} provides ${servicePhrase} services${locations}. Request a quote to discuss timing, service coverage and move details.`,
    faq: [
      {
        question: `How do I request a moving quote from ${name}?`,
        answer:
          'Use the website quote or contact form and share your origin, destination, preferred move date, inventory size, and any building access details.',
      },
      {
        question: `What details should I prepare before contacting ${name}?`,
        answer:
          'Prepare the pickup and drop-off addresses, preferred timing, approximate item list, stairs or elevator access, parking details, and any special handling needs.',
      },
      {
        question: 'How should I confirm service availability for my move?',
        answer:
          'Request a quote with your move details so the team can confirm service coverage, timing, and any requirements specific to your building or items.',
      },
    ],
    cta_variants: ['Request a Moving Quote', 'Get My Moving Quote', `Contact ${name}`],
  }
}

function stripUnsupportedPublishableClaims(text: string): string {
  return text
    .replace(/\b(?:same[- ]day|last[- ]minute)\b[^.?!]*/gi, 'availability')
    .replace(/\bget a free quote (?:online )?in minutes\b/gi, 'request a quote online')
    .replace(/\bfree quote in minutes\b/gi, 'quote request')
    .replace(/\bno hidden fees\b/gi, 'clear move details')
    .replace(/\blicensed(?:,? and)? insured\b/gi, 'credential details')
    .replace(/\binsured crews?\b/gi, 'moving team')
    .replace(/\bwe respond same day\b/gi, 'request a response')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function publishableSafeMaterials(
  brand: string,
  url: string,
  llm: ReadyMaterialsLlm,
  opts?: { businessContext?: BusinessContext; observedBusinessContext?: ObservedBusinessContext }
): ReadyMaterialsLlm {
  const moving = isMovingBusiness(brand, url, llm.faq, opts?.observedBusinessContext)
  const ctx = opts?.businessContext
  const needsNeutralMoving =
    moving &&
    !hasVerifiedText(ctx, /\b(insured|insurance|wsib|cvor|homestars|same[- ]day|last[- ]minute|condo|elevator|no hidden fees|minutes)\b/i)

  if (needsNeutralMoving) return neutralMovingMaterials(brand, url, llm, opts?.observedBusinessContext)

  return {
    meta_title: stripUnsupportedPublishableClaims(llm.meta_title),
    meta_description: stripUnsupportedPublishableClaims(llm.meta_description),
    faq: llm.faq
      .map((f) => ({
        question: stripUnsupportedPublishableClaims(f.question),
        answer: stripUnsupportedPublishableClaims(f.answer),
      }))
      .filter((f) => f.question && f.answer),
    cta_variants: llm.cta_variants.map(stripUnsupportedPublishableClaims).filter(Boolean),
  }
}

/** Build a valid Organization + FAQPage JSON-LD <script> block from the FAQ. */
export function buildJsonLd(
  brand: string,
  url: string,
  faq: { question: string; answer: string }[],
  observed?: ObservedBusinessContext
): string {
  const name = orgName(brand, url)
  const moving = isMovingBusiness(brand, url, faq, observed)
  const areas = moving ? areaServedFromText(faq, observed) : []
  const graph: Record<string, unknown>[] = [
    moving
      ? {
          '@type': 'MovingCompany',
          name,
          url,
          ...(areas.length > 0 ? { areaServed: areas } : {}),
        }
      : { '@type': 'Organization', name, url },
  ]
  if (moving) {
    graph.push({
      '@type': 'Service',
      name: `${name} moving services`,
      serviceType: 'Moving services',
      provider: { '@type': 'MovingCompany', name, url },
      ...(areas.length > 0 ? { areaServed: areas } : {}),
    })
  }
  if (faq.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    })
  }
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2)
  return `<script type="application/ld+json">\n${json}\n</script>`
}

/** Combine LLM copy with the deterministic JSON-LD snippet. */
export function assembleMaterials(
  brand: string,
  url: string,
  llm: ReadyMaterialsLlm,
  opts?: { businessContext?: BusinessContext; observedBusinessContext?: ObservedBusinessContext }
): ReadyMaterials {
  const safe = publishableSafeMaterials(brand, url, llm, opts)
  return { ...safe, json_ld: buildJsonLd(brand, url, safe.faq, opts?.observedBusinessContext) }
}
