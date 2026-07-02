import { canClaimCredential, canClaimServiceAvailability } from '../business-context'
import type { BusinessContext } from '../schemas'

export function joinClaimList(items: string[]): string {
  if (items.length <= 1) return items[0] || 'details'
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

export function isRecommendationSentence(sentence: string): boolean {
  return /^\s*(?:add|display|include|show|list|render|surface|publish|create|claim|optimi[sz]e|mark up|ensure|use|verify|confirm|consider|do not|avoid|keep|replace|rewrite|build|develop|seek|pursue)\b/i.test(sentence)
}

export function unsupportedMovingClaims(sentence: string, ctx?: BusinessContext): string[] {
  if (!ctx || /\?\s*$/.test(sentence.trim())) return []
  const claims: string[] = []
  const add = (label: string) => {
    if (!claims.includes(label)) claims.push(label)
  }

  if (!canClaimCredential(ctx, 'insured') && /\b(?:fully\s+insured|licensed\s+and\s+insured|insured\s+movers?)\b/i.test(sentence)) {
    add('insurance details')
  }
  if (!canClaimCredential(ctx, 'wsib') && /\bWSIB(?:[- ]certified| credentials?| certification)?\b/i.test(sentence)) {
    add('WSIB status')
  }
  if (!canClaimCredential(ctx, 'cvor') && /\bCVOR(?:[- ]certified| credentials?| certification)?\b/i.test(sentence)) {
    add('CVOR status')
  }
  if (!canClaimCredential(ctx, 'homestars') && /\bHomeStars(?:[- ]rated| rating| Star Score| score)?\b/i.test(sentence)) {
    add('third-party rating details')
  }
  if (!canClaimServiceAvailability(ctx, 'piano') && /\bpiano\s+moving\b|\bpiano\s+movers?\b|\bmove\s+pianos?\b/i.test(sentence)) {
    add('piano-moving availability')
  }
  if (!canClaimServiceAvailability(ctx, 'storage') && /\bstorage\s+(?:is\s+)?available\b|\boffer\s+storage\b|\bstorage options\b/i.test(sentence)) {
    add('storage availability')
  }
  if (!canClaimServiceAvailability(ctx, 'last_minute') && /\blast[- ]minute\s+moves?\b|\blast[- ]minute\s+moving\b/i.test(sentence)) {
    add('last-minute availability')
  }
  if (!canClaimServiceAvailability(ctx, 'single_item') && /\bsingle[- ]item\s+(?:moves?|moving)\b/i.test(sentence)) {
    add('single-item moving availability')
  }
  if (!canClaimServiceAvailability(ctx, 'ontario_quebec') && /\b(?:across|serves?|serving|coverage across)\s+Ontario\s+and\s+Quebec\b/i.test(sentence)) {
    add('service coverage outside the primary market')
  }

  return claims
}

export function repairUnsupportedMovingClaimSentence(sentence: string, ctx?: BusinessContext): string {
  if (isRecommendationSentence(sentence)) return sentence
  const claims = unsupportedMovingClaims(sentence, ctx)
  if (claims.length === 0) return sentence
  return `Ask the team about ${joinClaimList(claims)} for this move.`
}
