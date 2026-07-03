/**
 * Ready-to-ship materials (#17).
 *
 * The LLM writes the copy (meta/FAQ/CTA). The JSON-LD snippet is built
 * DETERMINISTICALLY here from the brand + FAQ so it is always valid schema.org
 * (Organization + FAQPage) rather than hallucinated markup.
 */
import { buildVerifiedFactsLayer, factAllowed, observedValues } from './verified-facts'
import type { BusinessContext, ObservedBusinessContext, ReadyMaterialsLlm, ReadyMaterials, VerifiedFact } from './schemas'

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

function areaServedFromFacts(
  facts: VerifiedFact[],
  faq: { question: string; answer: string }[],
  observed?: ObservedBusinessContext
): string[] {
  const factLocations = observedValues(facts, 'OBS-LOCATION-')
  if (factLocations.length) return factLocations
  if (observed?.observed_location?.length) return observed.observed_location
  const text = faq.map((f) => `${f.question} ${f.answer}`).join(' ')
  const areas = ['Toronto', 'Ontario', 'Canada', 'Quebec']
  return areas.filter((area) => new RegExp(`\\b${area}\\b`, 'i').test(text))
}

function hasVerifiedText(ctx: BusinessContext | undefined, pattern: RegExp): boolean {
  return pattern.test(ctx?.verified_facts || '')
}

function factsFor(opts?: {
  businessContext?: BusinessContext
  observedBusinessContext?: ObservedBusinessContext
  verifiedFacts?: VerifiedFact[]
}): VerifiedFact[] {
  return opts?.verifiedFacts || buildVerifiedFactsLayer({
    businessContext: opts?.businessContext,
    observedBusinessContext: opts?.observedBusinessContext,
  })
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

function neutralMetaDescription(
  brand: string,
  url: string,
  observed?: ObservedBusinessContext
): string {
  const name = orgName(brand, url)
  const service = observed?.observed_service_category || observed?.inferred_business_type || 'services'
  const locations = observed?.observed_location?.length ? ` in ${observed.observed_location.slice(0, 2).join(' / ')}` : ''
  const action = /booking/i.test(observed?.observed_primary_cta || '')
    ? 'Book a consultation'
    : /quote/i.test(observed?.observed_primary_cta || '')
      ? 'Request a quote'
      : 'Contact the business'
  return `${name} provides ${service.toLowerCase()}${locations}. ${action} to discuss options, availability, and next steps.`
}

function safeFaqAnswer(
  brand: string,
  url: string,
  question: string,
  answer: string,
  observed?: ObservedBusinessContext
): string {
  const cleaned = stripUnsupportedPublishableClaims(answer)
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (cleaned.length >= 24 && !/\barrange your visit the website\b/i.test(cleaned)) return cleaned

  const name = orgName(brand, url)
  if (/\b(how long|timeline|take|receive|ready|delivery)\b/i.test(question)) {
    return `Contact ${name} directly to confirm the current timeline for your appointment, fitting, and final delivery.`
  }
  if (/\b(where|located|visit|address|atelier|studio)\b/i.test(question)) {
    const locations = observed?.observed_location?.length ? ` in ${observed.observed_location[0]}` : ''
    return `Contact ${name} directly to confirm the current studio location${locations} and arrange your visit.`
  }
  return `Contact ${name} directly to confirm the current details for your appointment.`
}

function publishableSafeMaterials(
  brand: string,
  url: string,
  llm: ReadyMaterialsLlm,
  opts?: { businessContext?: BusinessContext; observedBusinessContext?: ObservedBusinessContext; verifiedFacts?: VerifiedFact[] }
): ReadyMaterialsLlm {
  const facts = factsFor(opts)
  const moving = isMovingBusiness(brand, url, llm.faq, opts?.observedBusinessContext)
  const ctx = opts?.businessContext
  const needsNeutralMoving =
    moving &&
    !hasVerifiedText(ctx, /\b(insured|insurance|wsib|cvor|homestars|same[- ]day|last[- ]minute|condo|elevator|no hidden fees|minutes)\b/i) &&
    !factAllowed(facts, /\b(insurance|wsib|cvor|homestars|response time|pricing|condo|elevator)\b/i, 'ready_copy')

  if (needsNeutralMoving) return neutralMovingMaterials(brand, url, llm, opts?.observedBusinessContext)

  return {
    meta_title: stripUnsupportedPublishableClaims(llm.meta_title),
    meta_description: stripUnsupportedPublishableClaims(llm.meta_description) || neutralMetaDescription(brand, url, opts?.observedBusinessContext),
    faq: llm.faq
      .map((f) => ({
        question: stripUnsupportedPublishableClaims(f.question),
        answer: safeFaqAnswer(brand, url, f.question, f.answer, opts?.observedBusinessContext),
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
  observed?: ObservedBusinessContext,
  facts: VerifiedFact[] = []
): string {
  const name = orgName(brand, url)
  const moving = isMovingBusiness(brand, url, faq, observed)
  const areas = moving ? areaServedFromFacts(facts, faq, observed) : []
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
  opts?: { businessContext?: BusinessContext; observedBusinessContext?: ObservedBusinessContext; verifiedFacts?: VerifiedFact[] }
): ReadyMaterials {
  const facts = factsFor(opts)
  const safe = publishableSafeMaterials(brand, url, llm, opts)
  return { ...safe, json_ld: buildJsonLd(brand, url, safe.faq, opts?.observedBusinessContext, facts) }
}
