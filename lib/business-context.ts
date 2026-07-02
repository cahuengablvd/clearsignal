import { BusinessContextSchema, type BusinessContext, type ObservedBusinessContext } from './schemas'

export function normalizeBusinessContext(value: unknown): BusinessContext {
  const parsed = BusinessContextSchema.safeParse(value || {})
  return parsed.success ? parsed.data : BusinessContextSchema.parse({})
}

export function businessContextPrompt(ctx: BusinessContext): string {
  const lines = [
    `Business model: ${ctx.business_model}`,
    `Primary conversion goal: ${ctx.primary_conversion_goal}`,
    `Products/services directly available for purchase: ${ctx.purchase_availability}`,
    `Ships internationally: ${ctx.ships_internationally}`,
    `Certificates/provenance/authentication: ${ctx.provenance_or_authentication}`,
    `Target markets/languages: ${ctx.target_markets_languages || 'Not provided'}`,
    `Verified facts operator allows ClearSignal to use: ${ctx.verified_facts || 'None provided'}`,
  ]

  return [
    'BUSINESS CONTEXT (operator-provided; treat as the only verified commercial context):',
    ...lines,
    '',
    'Commercial-claim rules:',
    '- Do not state that products are for sale unless purchase availability is yes/some or verified facts say so.',
    '- Do not state international shipping, certificates, provenance, secure payment, returns, pricing, awards, affiliations, or scarcity unless verified facts explicitly say so.',
    '- If a buyer would need those details, write that they should contact the business to confirm availability, pricing, authenticity documentation, purchase terms, and shipping.',
  ].join('\n')
}

export function hasVerifiedFact(ctx: BusinessContext, pattern: RegExp): boolean {
  pattern.lastIndex = 0
  return pattern.test(ctx.verified_facts || '')
}

export function canClaimPurchaseAvailable(ctx: BusinessContext): boolean {
  return (
    ctx.purchase_availability === 'yes' ||
    ctx.purchase_availability === 'some' ||
    hasVerifiedFact(ctx, /\b(for sale|available to buy|available for purchase|purchase|buy online)\b/i)
  )
}

export function canClaimInternationalShipping(ctx: BusinessContext): boolean {
  return ctx.ships_internationally === 'yes' || hasVerifiedFact(ctx, /\b(?:international shipping|ships internationally|worldwide shipping)\b/i)
}

export function canClaimProvenance(ctx: BusinessContext): boolean {
  return (
    ctx.provenance_or_authentication === 'yes' ||
    hasVerifiedFact(ctx, /\b(certificate|certificates|provenance|authentication|authenticated|authenticity)\b/i)
  )
}

export function canClaimCommercialPolicy(ctx: BusinessContext, kind: 'secure_payment' | 'returns' | 'pricing' | 'awards'): boolean {
  // Each alternation is wrapped in (?:...) so the \b anchors apply to the whole
  // set, not just the first/last branch. Without the group, middle branches
  // matched substrings (e.g. "eur" in "Europe" -> pricing, "press" in
  // "impressive" -> awards).
  const patterns = {
    secure_payment: /\b(?:secure payment|payment accepted|checkout|card payments?|stripe|paypal)\b/i,
    returns: /\b(?:return policy|returns accepted|refunds?)\b/i,
    pricing: /\b(?:pricing|price|prices|costs?|eur|\u20ac|\$)\b/i,
    awards: /\b(?:award|awards|press|featured in|partner|partnership|affiliated|affiliation)\b/i,
  }
  return hasVerifiedFact(ctx, patterns[kind])
}

export function canClaimCredential(ctx: BusinessContext, kind: 'insured' | 'wsib' | 'cvor' | 'homestars'): boolean {
  const patterns = {
    insured: /\b(?:insured|insurance|fully insured|licensed and insured)\b/i,
    wsib: /\bwsib\b/i,
    cvor: /\bcvor\b/i,
    homestars: /\bhomestars\b/i,
  }
  return hasVerifiedFact(ctx, patterns[kind])
}

export function canClaimServiceAvailability(ctx: BusinessContext, kind: 'piano' | 'storage' | 'last_minute' | 'single_item' | 'ontario_quebec'): boolean {
  const patterns = {
    piano: /\b(?:piano moving|piano movers?|move pianos?)\b/i,
    storage: /\bstorage\b/i,
    last_minute: /\blast[- ]minute\b/i,
    single_item: /\bsingle[- ]item\b/i,
    ontario_quebec: /\b(?:ontario|quebec)\b/i,
  }
  return hasVerifiedFact(ctx, patterns[kind])
}

export function inferObservedBusinessContext(args: {
  url: string
  markdown: string
  html?: string
}): ObservedBusinessContext {
  const text = `${args.url} ${args.markdown} ${args.html || ''}`.replace(/\s+/g, ' ')
  const lower = text.toLowerCase()
  const locations = ['Toronto', 'GTA', 'Ontario', 'Quebec', 'Canada'].filter((place) =>
    new RegExp(`\\b${place.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)
  )
  const services: string[] = []
  const addService = (label: string, re: RegExp) => {
    if (re.test(text) && !services.includes(label)) services.push(label)
  }
  addService('Residential moving', /\bresidential\s+(?:moving|moves?|relocation)\b/i)
  addService('Commercial moving', /\bcommercial\s+(?:moving|moves?|relocation)\b/i)
  addService('Condo moving', /\bcondo\s+(?:moving|moves?)\b/i)
  addService('Piano moving', /\bpiano\s+(?:moving|movers?)\b/i)
  addService('Packing', /\bpacking\s+(?:services?|help)\b/i)
  addService('Storage', /\bstorage\b/i)

  const isMoving = /\b(moving company|movers?|relocation|residential moving|commercial moving)\b/i.test(text)
  const quoteCta = /\b(get|request|book)\s+(?:a\s+)?(?:free\s+)?quote\b|\bquote request\b|\bget quote\b/i.test(text)
  const bookingCta = /\bbook(?:ing)?\b/i.test(text)

  return {
    inferred_business_type: isMoving ? 'Moving service' : undefined,
    observed_primary_cta: quoteCta ? 'Quote request' : bookingCta ? 'Booking/contact request' : undefined,
    observed_service_category: isMoving ? 'Moving services' : undefined,
    observed_location: locations.length ? locations : undefined,
    observed_services: services.length ? services : undefined,
  }
}
