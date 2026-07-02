import type { BusinessContext, ObservedBusinessContext, VerifiedFact } from './schemas'

type Output = VerifiedFact['allowed_outputs'][number]

function fact(args: Omit<VerifiedFact, 'allowed_outputs'> & { allowed_outputs?: Output[] }): VerifiedFact {
  return {
    ...args,
    allowed_outputs: args.allowed_outputs || ['analysis'],
  }
}

function userFact(id: string, claim: string, allowed: Output[] = ['analysis', 'ready_copy', 'faq', 'schema', 'outreach']): VerifiedFact {
  return fact({
    id,
    claim,
    source_type: 'user_verified',
    confidence: 100,
    requires_operator_confirmation: false,
    allowed_outputs: allowed,
  })
}

function observedFact(id: string, claim: string, confidence = 85, allowed: Output[] = ['analysis', 'ready_copy', 'faq', 'schema']): VerifiedFact {
  return fact({
    id,
    claim,
    source_type: 'target_page_observed',
    confidence,
    requires_operator_confirmation: false,
    allowed_outputs: allowed,
  })
}

function inferredFact(id: string, claim: string, confidence = 60): VerifiedFact {
  return fact({
    id,
    claim,
    source_type: 'inferred',
    confidence,
    requires_operator_confirmation: true,
    allowed_outputs: ['analysis'],
  })
}

export function buildVerifiedFactsLayer(args: {
  businessContext?: BusinessContext
  observedBusinessContext?: ObservedBusinessContext
}): VerifiedFact[] {
  const facts: VerifiedFact[] = []
  const ctx = args.businessContext
  const observed = args.observedBusinessContext
  const verified = ctx?.verified_facts?.trim()

  if (verified) {
    facts.push(userFact('USER-FACTS-001', verified))
    for (const [id, re, claim] of [
      ['USER-INSURANCE-001', /\b(insured|insurance|fully insured|licensed and insured)\b/i, 'Insurance details are operator-verified.'],
      ['USER-WSIB-001', /\bwsib\b/i, 'WSIB status is operator-verified.'],
      ['USER-CVOR-001', /\bcvor\b/i, 'CVOR status is operator-verified.'],
      ['USER-HOMESTARS-001', /\bhomestars\b/i, 'HomeStars details are operator-verified.'],
      ['USER-RESPONSE-TIME-001', /\b(same[- ]day|within\s+\d+\s+(?:minutes?|hours?|business days?))\b/i, 'Response time is operator-verified.'],
      ['USER-PRICE-001', /\b(no hidden fees|price|pricing|cost|free quote)\b/i, 'Pricing/quote wording is operator-verified.'],
      ['USER-CONDO-001', /\b(condo|elevator|building management)\b/i, 'Condo/elevator coordination details are operator-verified.'],
    ] as const) {
      if (re.test(verified)) facts.push(userFact(id, claim))
    }
  }

  if (observed?.inferred_business_type) {
    facts.push(observedFact('OBS-BUSINESS-TYPE-001', `Business type observed: ${observed.inferred_business_type}.`, 85))
  }
  if (observed?.observed_primary_cta) {
    facts.push(observedFact('OBS-PRIMARY-CTA-001', `Primary conversion action observed: ${observed.observed_primary_cta}.`, 90))
  }
  if (observed?.observed_service_category) {
    facts.push(observedFact('OBS-SERVICE-CATEGORY-001', `Service category observed: ${observed.observed_service_category}.`, 85))
  }
  for (const [i, location] of (observed?.observed_location || []).entries()) {
    facts.push(observedFact(`OBS-LOCATION-${String(i + 1).padStart(3, '0')}`, `Location observed: ${location}.`, 80))
  }
  for (const [i, service] of (observed?.observed_services || []).entries()) {
    facts.push(observedFact(`OBS-SERVICE-${String(i + 1).padStart(3, '0')}`, `Service observed: ${service}.`, 75))
  }

  if (!verified && observed?.inferred_business_type) {
    facts.push(inferredFact('ASSUMPTION-OPERATOR-REVIEW-001', 'Commercial claims still require operator review before publication.'))
  }

  return facts
}

export function factAllowed(facts: VerifiedFact[], pattern: RegExp, output: Output): boolean {
  return facts.some((item) => {
    pattern.lastIndex = 0
    return item.allowed_outputs.includes(output) && pattern.test(item.claim)
  })
}

export function observedValues(facts: VerifiedFact[], prefix: string): string[] {
  return facts
    .filter((item) => item.id.startsWith(prefix))
    .map((item) => item.claim.replace(/^[^:]+:\s*/, '').replace(/[.]$/, '').trim())
    .filter(Boolean)
}
