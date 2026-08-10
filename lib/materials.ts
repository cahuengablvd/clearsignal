/**
 * Ready-to-ship materials (#17).
 *
 * The LLM writes the copy (meta/FAQ/CTA). The JSON-LD snippet is built
 * DETERMINISTICALLY here from the brand + FAQ so it is always valid schema.org
 * (Organization + FAQPage) rather than hallucinated markup.
 */
import { buildVerifiedFactsLayer, factAllowed, observedValues } from './verified-facts'
import type { BusinessContext, ObservedBusinessContext, ReadyMaterialsLlm, ReadyMaterials, VerifiedFact } from './schemas'

export type MaterialCategory =
  | 'moving_service'
  | 'video_production'
  | 'tailoring_atelier'
  | 'art_gallery'
  | 'marketplace'
  | 'default'

function orgName(brand: string, url: string): string {
  if (brand && brand.trim()) return brand.trim()
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function normalizedLabel(value?: string): string {
  return (value || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function operatorMaterialCategory(value?: string): MaterialCategory | undefined {
  const normalized = normalizedLabel(value)
  if (!normalized || normalized === 'unknown') return undefined
  const categories: Record<string, MaterialCategory> = {
    gallery: 'art_gallery',
    art_gallery: 'art_gallery',
    marketplace: 'marketplace',
    two_sided_marketplace: 'marketplace',
    moving_service: 'moving_service',
    moving_services: 'moving_service',
    video_production: 'video_production',
    video_production_service: 'video_production',
    tailoring_atelier: 'tailoring_atelier',
    tailoring_service: 'tailoring_atelier',
    bespoke_tailoring: 'tailoring_atelier',
  }
  if (normalized === 'service_business') return undefined
  return categories[normalized] || 'default'
}

export function materialCategoryForContext(
  businessContext?: BusinessContext,
  observed?: ObservedBusinessContext
): MaterialCategory {
  const operatorCategory = operatorMaterialCategory(businessContext?.business_model)
  if (operatorCategory) return operatorCategory

  const contextText = [
    businessContext?.verified_facts,
    observed?.inferred_business_type,
    observed?.observed_service_category,
    ...(observed?.observed_services || []),
  ].join(' ').toLowerCase()
  if (/\b(moving|movers?|relocation|piano moving|moving quote)\b/.test(contextText)) return 'moving_service'
  if (/\b(video production|motion design|explainer video|product video|animation studio)\b/.test(contextText)) {
    return 'video_production'
  }
  if (/\b(bespoke|tailor(?:ed|ing)?|atelier|menswear|custom suits?|made-to-measure)\b/.test(contextText)) {
    return 'tailoring_atelier'
  }
  if (/\b(art gallery|gallery|artworks?|visual art|artist)\b/.test(contextText)) return 'art_gallery'

  const labels = [
    normalizedLabel(observed?.inferred_business_type),
    normalizedLabel(observed?.observed_service_category),
  ].filter(Boolean)

  if (labels.some((v) => ['moving_company', 'moving_service', 'moving_services'].includes(v))) {
    return 'moving_service'
  }
  if (labels.some((v) => ['video_production', 'video_production_service', 'motion_design', 'explainer_video_production'].includes(v))) {
    return 'video_production'
  }
  if (labels.some((v) => ['tailoring_atelier', 'bespoke_tailoring', 'tailoring_service', 'custom_tailoring'].includes(v))) {
    return 'tailoring_atelier'
  }
  if (labels.some((v) => ['art_gallery', 'gallery', 'online_art_gallery'].includes(v))) {
    return 'art_gallery'
  }

  return 'default'
}

function isMovingBusiness(opts?: {
  businessContext?: BusinessContext
  observedBusinessContext?: ObservedBusinessContext
}): boolean {
  return materialCategoryForContext(opts?.businessContext, opts?.observedBusinessContext) === 'moving_service'
}

function humanList(values: string[], max = 3): string {
  const items = values.map((v) => v.trim()).filter(Boolean).slice(0, max)
  if (items.length <= 1) return items[0] || ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function locationRegionPhrase(value: string): string {
  return /^gta$/i.test(value.trim()) ? 'the GTA' : value.trim()
}

function locationsToProse(values?: string[]): string {
  const items = Array.from(new Set((values || []).map((v) => v.trim()).filter(Boolean)))
  if (items.length === 0) return ''
  if (items.length === 1) return `in ${items[0]}`
  return `in ${items[0]} and across ${locationRegionPhrase(items[1])}`
}

function movingServicePhrase(services?: string[]): string {
  const normalized = (services || [])
    .map((service) => service.toLowerCase().trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((service) => service.replace(/\s+moving\b/i, ''))
  if (normalized.length) return `${humanList(normalized)} moving`
  return 'residential and commercial moving'
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

function movingFallbackMaterials(
  brand: string,
  url: string,
  llm: ReadyMaterialsLlm,
  observed?: ObservedBusinessContext
): ReadyMaterialsLlm {
  const name = orgName(brand, url)
  const locations = locationsToProse(observed?.observed_location)
  const servicePhrase = movingServicePhrase(observed?.observed_services)
  return {
    meta_title: llm.meta_title || `${name} | Moving Services`,
    meta_description: `${name} provides ${servicePhrase} services${locations ? ` ${locations}` : ''}. Request a quote to discuss timing, service coverage and move details.`,
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

function neutralGenericMaterials(
  brand: string,
  url: string,
  llm: ReadyMaterialsLlm,
  businessContext?: BusinessContext,
  observed?: ObservedBusinessContext
): ReadyMaterialsLlm {
  const name = orgName(brand, url)
  return {
    meta_title: llm.meta_title || `${name} | Official Website`,
    meta_description: neutralMetaDescription(brand, url, businessContext, observed),
    faq: [
      {
        question: `How do I contact ${name}?`,
        answer: `Use the contact options on ${name}'s website to discuss your needs and next steps.`,
      },
      {
        question: `What information should I share with ${name}?`,
        answer: 'Share the relevant project, service, appointment, or inquiry details so the team can respond with accurate next steps.',
      },
    ],
    cta_variants: ['Contact the business', `Contact ${name}`, 'Request information'],
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

function containsMovingServiceVocabulary(value: ReadyMaterialsLlm): boolean {
  const text = [
    value.meta_title,
    value.meta_description,
    ...value.cta_variants,
    ...value.faq.flatMap((f) => [f.question, f.answer]),
  ].join(' ')
  return /\b(moving quote|moving services?|movers?|pickup and drop[- ]off|stairs or elevator|inventory size|residential moving|commercial moving|piano moving)\b/i.test(text)
}

function containsPublishablePlaceholder(text: string): boolean {
  return /\b(?:use verified business data before publishing this example|specific business figures were not verified in this audit|before publishing this wording|contact the business to confirm)\b/i.test(text)
}

function neutralMetaDescription(
  brand: string,
  url: string,
  businessContext?: BusinessContext,
  observed?: ObservedBusinessContext
): string {
  const name = orgName(brand, url)
  const category = materialCategoryForContext(businessContext, observed)
  const locations = locationsToProse(observed?.observed_location)
  const action = /booking/i.test(observed?.observed_primary_cta || '') || businessContext?.primary_conversion_goal === 'booking'
    ? 'Book a consultation'
    : /quote/i.test(observed?.observed_primary_cta || '')
      ? 'Request a quote'
      : businessContext?.primary_conversion_goal === 'inquiry'
        ? 'Send an inquiry'
        : 'Contact the team'

  const locationPhrase = locations ? ` ${locations}` : ''
  if (category === 'tailoring_atelier') {
    return `${name} is a bespoke tailoring atelier${locationPhrase}. ${action} to discuss fit, fabric, timing, and appointment details.`
  }
  if (category === 'art_gallery') {
    return `${name} presents artwork and artist information${locationPhrase}. ${action} to ask about availability, acquisition, or gallery details.`
  }
  if (category === 'video_production') {
    return `${name} creates video, animation, and motion-design work${locationPhrase}. ${action} to discuss the brief, scope, and next steps.`
  }
  if (category === 'moving_service') {
    return `${name} provides moving services${locationPhrase}. ${action} to discuss timing, service coverage, and move details.`
  }
  return `${name} - ${action.toLowerCase()} to discuss options, availability, and next steps. The business category was not established in this audit.`
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
  if (
    cleaned.length >= 24 &&
    !/\barrange your visit the website\b/i.test(cleaned) &&
    !containsPublishablePlaceholder(cleaned)
  ) {
    return cleaned
  }

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
  const moving = isMovingBusiness(opts)
  const ctx = opts?.businessContext
  const needsNeutralMoving =
    moving &&
    !hasVerifiedText(ctx, /\b(insured|insurance|wsib|cvor|homestars|same[- ]day|last[- ]minute|condo|elevator|no hidden fees|minutes)\b/i) &&
    !factAllowed(facts, /\b(insurance|wsib|cvor|homestars|response time|pricing|condo|elevator)\b/i, 'ready_copy')

  if (needsNeutralMoving) return movingFallbackMaterials(brand, url, llm, opts?.observedBusinessContext)

  const category = materialCategoryForContext(ctx, opts?.observedBusinessContext)
  const hasObservedCategory = Boolean(
    opts?.observedBusinessContext?.inferred_business_type ||
    opts?.observedBusinessContext?.observed_service_category
  )
  const hasUnestablishedCategory =
    operatorMaterialCategory(ctx?.business_model) === 'default' ||
    (Boolean(ctx) && !ctx?.verified_facts?.trim() && !hasObservedCategory && category === 'default')
  if (!moving && hasUnestablishedCategory) {
    return neutralGenericMaterials(brand, url, llm, ctx, opts?.observedBusinessContext)
  }

  const cleanedMetaDescription = stripUnsupportedPublishableClaims(llm.meta_description)
  const safeMetaDescription =
    cleanedMetaDescription && !containsPublishablePlaceholder(cleanedMetaDescription)
      ? cleanedMetaDescription
      : neutralMetaDescription(brand, url, opts?.businessContext, opts?.observedBusinessContext)

  const safe = {
    meta_title: stripUnsupportedPublishableClaims(llm.meta_title),
    meta_description: safeMetaDescription,
    faq: llm.faq
      .map((f) => ({
        question: stripUnsupportedPublishableClaims(f.question),
        answer: safeFaqAnswer(brand, url, f.question, f.answer, opts?.observedBusinessContext),
      }))
      .filter((f) => f.question && f.answer),
    cta_variants: llm.cta_variants.map(stripUnsupportedPublishableClaims).filter(Boolean),
  }

  if (!moving && containsMovingServiceVocabulary(safe)) {
    return neutralGenericMaterials(brand, url, llm, opts?.businessContext, opts?.observedBusinessContext)
  }

  if (!safe.meta_description && safe.faq.length === 0 && safe.cta_variants.length === 0) {
    return neutralGenericMaterials(brand, url, llm, opts?.businessContext, opts?.observedBusinessContext)
  }

  return safe
}

/** Build deterministic JSON-LD only from verified business type and observed page structure. */
export function buildJsonLd(
  brand: string,
  url: string,
  faq: { question: string; answer: string }[],
  observed?: ObservedBusinessContext,
  facts: VerifiedFact[] = [],
  businessContext?: BusinessContext
): string {
  const name = orgName(brand, url)
  const category = materialCategoryForContext(businessContext, observed)
  const moving = isMovingBusiness({ businessContext, observedBusinessContext: observed })
  const marketplace = category === 'marketplace'
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
  if (marketplace && observed?.observed_marketplace_structure?.search_url_template) {
    graph.push({
      '@type': 'WebSite',
      name,
      url,
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: observed.observed_marketplace_structure.search_url_template,
        },
        'query-input': 'required name=search_term_string',
      },
    })
  }
  const marketplaceStructure = marketplace ? observed?.observed_marketplace_structure : undefined
  if (marketplaceStructure?.item_names?.length) {
    graph.push({
      '@type': 'ItemList',
      ...(marketplaceStructure.list_name ? { name: marketplaceStructure.list_name } : {}),
      itemListElement: marketplaceStructure.item_names.map((itemName, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: itemName,
      })),
    })
  } else if (marketplaceStructure?.offer_catalog_name) {
    graph.push({
      '@type': 'OfferCatalog',
      name: marketplaceStructure.offer_catalog_name,
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
  return {
    ...safe,
    json_ld: buildJsonLd(
      brand,
      url,
      safe.faq,
      opts?.observedBusinessContext,
      facts,
      opts?.businessContext
    ),
  }
}
