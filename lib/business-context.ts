import { BusinessContextSchema, type BusinessContext, type ObservedBusinessContext } from './schemas'

export function normalizeBusinessContext(value: unknown): BusinessContext {
  const parsed = BusinessContextSchema.safeParse(value || {})
  return parsed.success ? parsed.data : BusinessContextSchema.parse({})
}

export function businessContextPrompt(ctx: BusinessContext): string {
  const lines = [
    `Business model: ${ctx.business_model}`,
    `Primary conversion goal: ${ctx.primary_conversion_goal}`,
    `Purchase / booking availability: ${ctx.purchase_availability}`,
    `Shipping / service availability: ${ctx.ships_internationally}`,
    `Certificates / provenance / verification: ${ctx.provenance_or_authentication}`,
    `Target markets/languages: ${ctx.target_markets_languages || 'Not provided'}`,
    `Verified facts operator allows ClearSignal to use: ${ctx.verified_facts || 'None provided'}`,
  ]

  return [
    'BUSINESS CONTEXT (operator-provided; treat as the only verified commercial context):',
    ...lines,
    '',
    'Commercial-claim rules:',
    '- Do not state that products are for sale unless purchase / booking availability or verified facts explicitly support it.',
    '- Do not state international shipping, certificates, provenance, secure payment, returns, pricing, awards, affiliations, or scarcity unless verified facts explicitly say so.',
    '- If a buyer would need those details, write that they should contact the business to confirm availability, pricing, authenticity documentation, purchase terms, and shipping.',
  ].join('\n')
}

export function hasVerifiedFact(ctx: BusinessContext, pattern: RegExp): boolean {
  pattern.lastIndex = 0
  return pattern.test(ctx.verified_facts || '')
}

export function canClaimPurchaseAvailable(ctx: BusinessContext): boolean {
  const availability = String(ctx.purchase_availability || '').toLowerCase()
  return (
    ctx.purchase_availability === 'yes' ||
    ctx.purchase_availability === 'some' ||
    (!!availability && !['unknown', 'no', 'not_applicable', 'not_currently_available'].includes(availability)) ||
    hasVerifiedFact(ctx, /\b(for sale|available to buy|available for purchase|purchase|buy online)\b/i)
  )
}

export function canClaimInternationalShipping(ctx: BusinessContext): boolean {
  const availability = String(ctx.ships_internationally || '').toLowerCase()
  return (
    ctx.ships_internationally === 'yes' ||
    availability === 'international' ||
    hasVerifiedFact(ctx, /\b(?:international shipping|ships internationally|worldwide shipping)\b/i)
  )
}

export function canClaimProvenance(ctx: BusinessContext): boolean {
  const verification = String(ctx.provenance_or_authentication || '').toLowerCase()
  return (
    ctx.provenance_or_authentication === 'yes' ||
    (!!verification && !['unknown', 'no', 'not_applicable', 'no_formal_verification'].includes(verification)) ||
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

function htmlAttribute(tag: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = tag.match(new RegExp(`\\b${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  return (match?.[1] ?? match?.[2] ?? match?.[3])?.trim() || undefined
}

function observedSearchUrlTemplate(pageUrl: string, html: string): string | undefined {
  for (const match of html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)) {
    const openingTag = `<form${match[1]}>`
    const body = match[2]
    const method = (htmlAttribute(openingTag, 'method') || 'get').toLowerCase()
    if (method !== 'get') continue

    const inputs = Array.from(body.matchAll(/<input\b[^>]*>/gi), (item) => item[0])
    const searchInput = inputs.find((input) => {
      const type = (htmlAttribute(input, 'type') || '').toLowerCase()
      const name = htmlAttribute(input, 'name') || ''
      return type === 'search' || /^(?:q|query|search|keyword)$/i.test(name)
    })
    const isSearchForm = /\brole\s*=\s*(?:"search"|'search'|search)\b/i.test(openingTag) || Boolean(searchInput)
    if (!isSearchForm || !searchInput) continue

    const parameter = htmlAttribute(searchInput, 'name')
    if (!parameter) continue
    try {
      const base = new URL(pageUrl)
      const target = new URL(htmlAttribute(openingTag, 'action') || base.pathname, base)
      if (!/^https?:$/.test(target.protocol) || target.origin !== base.origin) continue
      target.searchParams.set(parameter, '{search_term_string}')
      return target.toString().replace(/%7Bsearch_term_string%7D/gi, '{search_term_string}')
    } catch {
      continue
    }
  }
  return undefined
}

function cleanObservedLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const clean = value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return clean && clean.length <= 160 ? clean : undefined
}

function marketplaceListFromJsonLd(html: string): { list_name?: string; item_names?: string[] } | undefined {
  const candidates: Record<string, unknown>[] = []
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (!value || typeof value !== 'object') return
    const record = value as Record<string, unknown>
    const types = Array.isArray(record['@type']) ? record['@type'] : [record['@type']]
    if (types.some((type) => type === 'ItemList' || type === 'OfferCatalog')) candidates.push(record)
    Object.values(record).forEach(visit)
  }

  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json'|application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(match[1].trim()))
    } catch {
      continue
    }
  }

  for (const candidate of candidates) {
    const elements = Array.isArray(candidate.itemListElement) ? candidate.itemListElement : []
    const itemNames = elements
      .map((element) => {
        if (!element || typeof element !== 'object') return undefined
        const record = element as Record<string, unknown>
        const item = record.item && typeof record.item === 'object'
          ? record.item as Record<string, unknown>
          : undefined
        const offered = record.itemOffered && typeof record.itemOffered === 'object'
          ? record.itemOffered as Record<string, unknown>
          : undefined
        return cleanObservedLabel(item?.name ?? offered?.name ?? record.name)
      })
      .filter((name): name is string => Boolean(name))
      .slice(0, 20)
    const listName = cleanObservedLabel(candidate.name)
    if (listName || itemNames.length) {
      return {
        ...(listName ? { list_name: listName } : {}),
        ...(itemNames.length ? { item_names: Array.from(new Set(itemNames)) } : {}),
      }
    }
  }
  return undefined
}

function observedOfferCatalogName(markdown: string, html: string): string | undefined {
  const markdownHeadings = markdown
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s{0,3}#{1,6}\s+/, '').trim())
  const htmlHeadings = Array.from(html.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi), (match) =>
    cleanObservedLabel(match[1]) || ''
  )
  return [...markdownHeadings, ...htmlHeadings]
    .map(cleanObservedLabel)
    .find((heading) => Boolean(heading && /\b(?:compare|browse|view)\b.{0,100}\b(?:offers?|listings?|providers?)\b/i.test(heading)))
}

export function inferObservedBusinessContext(args: {
  url: string
  markdown: string
  html?: string
}): ObservedBusinessContext {
  const text = `${args.url} ${args.markdown} ${args.html || ''}`.replace(/\s+/g, ' ')
  const quoteCta = /\b(get|request|book)\s+(?:a\s+)?(?:free\s+)?quote\b|\bquote request\b|\bget quote\b/i.test(text)
  const bookingCta = /\bbook(?:ing)?\b/i.test(text)
  const observedList = marketplaceListFromJsonLd(args.html || '')
  const searchUrlTemplate = observedSearchUrlTemplate(args.url, args.html || '')
  const offerCatalogName = observedOfferCatalogName(args.markdown, args.html || '')
  const observedMarketplaceStructure = searchUrlTemplate || observedList || offerCatalogName
    ? {
        ...(searchUrlTemplate ? { search_url_template: searchUrlTemplate } : {}),
        ...observedList,
        ...(offerCatalogName && !observedList?.item_names?.length ? { offer_catalog_name: offerCatalogName } : {}),
      }
    : undefined

  return {
    observed_primary_cta: quoteCta ? 'Quote request' : bookingCta ? 'Booking/contact request' : undefined,
    observed_marketplace_structure: observedMarketplaceStructure,
  }
}
