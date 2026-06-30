import { BusinessContextSchema, type BusinessContext } from './schemas'

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
  return ctx.ships_internationally === 'yes' || hasVerifiedFact(ctx, /\binternational shipping|ships internationally|worldwide shipping\b/i)
}

export function canClaimProvenance(ctx: BusinessContext): boolean {
  return (
    ctx.provenance_or_authentication === 'yes' ||
    hasVerifiedFact(ctx, /\b(certificate|certificates|provenance|authentication|authenticated|authenticity)\b/i)
  )
}

export function canClaimCommercialPolicy(ctx: BusinessContext, kind: 'secure_payment' | 'returns' | 'pricing' | 'awards'): boolean {
  const patterns = {
    secure_payment: /\bsecure payment|payment accepted|checkout|card payments?|stripe|paypal\b/i,
    returns: /\breturn policy|returns accepted|refunds?\b/i,
    pricing: /\bpricing|price|prices|costs?|eur|\u20ac|\$\b/i,
    awards: /\baward|awards|press|featured in|partner|partnership|affiliated|affiliation\b/i,
  }
  return hasVerifiedFact(ctx, patterns[kind])
}
