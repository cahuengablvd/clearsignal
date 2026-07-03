import type { BusinessContext } from '../schemas'
import { TONE_REPLACEMENTS } from '../trust-phrases'
import { repairUnsupportedMovingClaimSentence, unsupportedMovingClaims } from '../industry-profiles/moving'

export type Audience = 'client_report' | 'outreach' | 'operator_note'
export type ContentScope =
  | 'client_business_claim'
  | 'third_party_source_description'
  | 'recommendation'
  | 'publishable_copy'
  | 'internal_note'

export type SentenceDecision =
  | { action: 'keep' }
  | { action: 'swap'; text: string }
  | { action: 'replace'; text: string }
  | { action: 'drop' }

export const REPLACEMENT_SENTENCES = {
  performanceHypothesis:
    'Potential business impact should be treated as a hypothesis until verified with analytics or operator data.',
  recommendationHypothesis: 'Proof-related recommendations should be backed by verified source data.',
  reviewProofRecommendation: 'Rating recommendations should use verified review-source data.',
  quantifiedExample: 'Use verified business data before publishing this example.',
  unsupportedCommitment:
    'Specific service commitments should be published only when the business has verified them.',
  conditionalResponseTime:
    'Response-time wording should be used only when the business has verified it.',
  conditionalCredential:
    'Credential claims should use current verified business details.',
  unsupportedMovingClaim: 'Ask the team about service details for this move.',
} as const

export const CLIENT_VISIBLE_REPLACEMENT_SENTENCES = Object.values(REPLACEMENT_SENTENCES)

const UNVERIFIED_QUANTIFIED_EXAMPLE =
  /\b(?:at least|minimum|min\.?|around|about|approximately|approx\.?|~)?\s*\d+(?:[.,]\d+)?(?:\+|\s*[-\u2013]\s*\d+(?:[.,]\d+)?)?\s*(?:explainer\s+)?(?:videos?|logos?|seconds?|minutes?|hours?|weeks?|days?|months?|clients?|customers?|users?|case studies?|testimonials?|reviews?|outcomes?|enterprise calls?)\b/i
const PERCENT_CLAIM = /\b(?:by\s+|up\s+to\s+|around\s+|approximately\s+|~\s*)?\d{1,3}(?:[.,]\d+)?\s*(?:[-\u2013]|to)?\s*\d{0,3}(?:[.,]\d+)?\s*%/i
const REVENUE_CLAIM = /\$\s?\d[\d,]*(?:\.\d+)?\s?(?:k|m|mm|million|billion|\/mo|\/month|\/yr)?/i
const MULTIPLIER_CLAIM = /\b\d{1,2}(?:\.\d+)?\s?x\b/i
const OVERCLAIM_PHRASES = [
  /absent from (?:the )?(?:ai )?(?:knowledge bases?|answer layer|ecosystem)/gi,
  /entirely absent from the ai answer layer/gi,
  /functionally invisible/gi,
  /completely invisible(?:\s+everywhere)?/gi,
  /invisible everywhere/gi,
  /(?:not|never)\s+visible\s+anywhere/gi,
  /no visibility at all/gi,
  /totally absent from ai/gi,
  /entirely absent from (?:all )?(?:source )?ecosystems/gi,
]

const UNSUPPORTED_COMMITMENT =
  /\b(?:we\s+respond|we'?ll\s+(?:reply|respond)|responds?|reply|replies)\s+(?:within|in)\s+(?:\d+\s*)?(?:minutes?|hours?|business days?)\b|\bwithin hours\b|\b(?:same[- ]day|last[- ]minute)\s+(?:availability|quote|response|booking)\b|\bno hidden fees\b|\bclear quote before anything moves\b|\blicensed,\s*insured crews\b/i

const UNVERIFIED_BUSINESS_OUTCOME =
  /\b[A-Z][A-Za-z0-9&.\- ]{1,60}\s+(?:reduced|shortened|cut|lowered|increased|improved|lifted|grew|boosted|drove|accelerated)\s+(?:sales cycle|sales cycles|time to close|churn|costs?|activation|activation rates?|demo requests?|demo conversions?|trial signups?|conversion|conversion rates?|pipeline|revenue|retention|investor meetings?)\b|\b(?:product videos?|explainer videos?|animations?|ui motion|case studies?|landing pages?)\s+(?:increase|increased|improve|improved|lift|lifted|boost|boosted|reduce|reduced|drive|drove|accelerate|accelerated)\s+|\b(?:two-revision|two revision)\s+guarantee\b|\basset pays for itself in one closed deal\b|\bpays for itself in (?:one|a single|1) closed deal\b|\bclosed (?:a )?seed round\b|\b(?:influence|influenced|impact|impacted|move|moves|moved)\s+pipeline\b|\b(?:reduced|cut|lowered|decreased)\s+support tickets\b|\b(?:grow|grew|increase|increased|lift|lifted)\s+demo conversions\b|\b(?:improve|improves|improved|increase|increases|increased|lift|lifts|lifted|grow|grows|grew)\s+trial signups?\b|\b(?:influence|influences|influenced|secure|secures|secured|book|books|booked)\s+investor meetings?\b|\bsales team\s+(?:uses|used)\s+(?:the\s+)?(?:video|asset|case study)\s+before\s+every\s+enterprise call\b|\b(?:video|asset|case study)\s+(?:is|was)\s+used\s+before\s+every\s+enterprise call\b/i

const BROKEN_PLACEHOLDER_TAILS = [
  /\bRated\s+\d+(?:[.,]\d+)?\/\d+\s+from['")\s]*$/i,
  /\b(?:Prefer to talk\?\s*)?Call us directly\s*:?\s*$/i,
  /\bGet (?:Your|My|a) Free Quote\s+(?:in|within)\s*[-\u2013\u2014]?\s*$/i,
]

function applyToneSwaps(sentence: string): string {
  let out = sentence
  for (const [re, replacement] of TONE_REPLACEMENTS) out = out.replace(re, replacement)
  return out
}

function hasUnverifiedNumericClaim(sentence: string): boolean {
  return (
    PERCENT_CLAIM.test(sentence) ||
    REVENUE_CLAIM.test(sentence) ||
    MULTIPLIER_CLAIM.test(sentence) ||
    /\b\d+(?:[.,]\d+)?\/\d+\b/.test(sentence)
  )
}

function boundVisibilityClaims(sentence: string, mentions?: number, total?: number): string {
  const replacement =
    typeof mentions === 'number' && typeof total === 'number'
      ? mentions === 0
        ? `not found in ${total} tested query-engine combinations`
        : `mentioned in ${mentions} of ${total} tested query-engine combinations`
      : 'not found in the tested query-engine combinations'
  let out = sentence
  for (const re of OVERCLAIM_PHRASES) out = out.replace(re, replacement)
  return out
}

function isRecommendation(sentence: string): boolean {
  return /^\s*(?:add|display|include|show|list|render|surface|publish|create|claim|optimi[sz]e|mark up|ensure|use|verify|confirm|consider|avoid|keep|replace|rewrite|build|develop|seek|pursue)\b/i.test(sentence)
}

function recommendationReplacement(sentence: string): string {
  if (/\b(?:respond|reply|response[- ]time|within hours|within\s+\d+\s*(?:minutes?|hours?|business days?))\b/i.test(sentence)) {
    return REPLACEMENT_SENTENCES.conditionalResponseTime
  }
  if (/\b(HomeStars|rating|rated|review|score|testimonial)\b/i.test(sentence)) {
    return REPLACEMENT_SENTENCES.reviewProofRecommendation
  }
  return REPLACEMENT_SENTENCES.recommendationHypothesis
}

function commitmentReplacement(sentence: string, scope: ContentScope): string {
  if (/\b(?:respond|reply|response[- ]time|within hours|within\s+\d+\s*(?:minutes?|hours?|business days?))\b/i.test(sentence)) {
    return REPLACEMENT_SENTENCES.conditionalResponseTime
  }
  return scope === 'recommendation'
    ? REPLACEMENT_SENTENCES.recommendationHypothesis
    : REPLACEMENT_SENTENCES.unsupportedCommitment
}

function credentialRecommendationReplacement(labels: string[]): string {
  if (labels.some((label) => /insurance|WSIB|CVOR|rating|credential/i.test(label))) {
    return REPLACEMENT_SENTENCES.conditionalCredential
  }
  return REPLACEMENT_SENTENCES.unsupportedMovingClaim
}

function replacementDecision(ctx: { scope: ContentScope }, text: string): SentenceDecision {
  void text
  if (ctx.scope !== 'internal_note') return { action: 'drop' }
  return { action: 'replace', text }
}

function isExistingReplacementSentence(sentence: string): boolean {
  const normalized = sentence.trim().replace(/[.!?]+$/, '').toLowerCase()
  return CLIENT_VISIBLE_REPLACEMENT_SENTENCES.some(
    (replacement) => replacement.trim().replace(/[.!?]+$/, '').toLowerCase() === normalized
  )
}

export function decideSentence(
  sentence: string,
  ctx: {
    audience: Audience
    scope: ContentScope
    businessContext?: BusinessContext
    mentions?: number
    total?: number
  }
): SentenceDecision {
  if (!sentence.trim()) return { action: 'keep' }
  if (isExistingReplacementSentence(sentence)) {
    return ctx.scope !== 'internal_note'
      ? { action: 'drop' }
      : { action: 'keep' }
  }

  if (BROKEN_PLACEHOLDER_TAILS.some((re) => re.test(sentence.trim()))) return { action: 'drop' }
  if (/\bRated\s+\d+(?:[.,]\d+)?\/\d+\s+from['")\s]*(?:[.?!]|$)/i.test(sentence)) return { action: 'drop' }

  if (ctx.scope !== 'third_party_source_description') {
    if (UNVERIFIED_BUSINESS_OUTCOME.test(sentence)) {
      return ctx.audience === 'outreach'
        ? { action: 'drop' }
        : replacementDecision(
            ctx,
            ctx.scope === 'recommendation'
              ? recommendationReplacement(sentence)
              : REPLACEMENT_SENTENCES.performanceHypothesis
          )
    }
    if (hasUnverifiedNumericClaim(sentence)) {
      return ctx.audience === 'outreach'
        ? { action: 'drop' }
        : replacementDecision(
            ctx,
            ctx.scope === 'recommendation'
              ? recommendationReplacement(sentence)
              : REPLACEMENT_SENTENCES.performanceHypothesis
          )
    }
    if (UNVERIFIED_QUANTIFIED_EXAMPLE.test(sentence)) {
      return ctx.audience === 'outreach'
        ? { action: 'drop' }
        : replacementDecision(
            ctx,
            ctx.scope === 'recommendation'
              ? recommendationReplacement(sentence)
              : REPLACEMENT_SENTENCES.quantifiedExample
          )
    }
    if (UNSUPPORTED_COMMITMENT.test(sentence)) {
      return ctx.audience === 'outreach' || ctx.scope === 'publishable_copy'
        ? { action: 'drop' }
        : replacementDecision(ctx, commitmentReplacement(sentence, ctx.scope))
    }
  }

  if (
    ctx.scope === 'recommendation' &&
    ctx.businessContext &&
    unsupportedMovingClaims(sentence, ctx.businessContext).length > 0
  ) {
    return replacementDecision(
      ctx,
      credentialRecommendationReplacement(unsupportedMovingClaims(sentence, ctx.businessContext))
    )
  }

  if (
    ctx.scope !== 'third_party_source_description' &&
    ctx.businessContext &&
    !isRecommendation(sentence) &&
    unsupportedMovingClaims(sentence, ctx.businessContext).length > 0
  ) {
    if (ctx.audience === 'outreach') return { action: 'drop' }
    const replacement = repairUnsupportedMovingClaimSentence(sentence, ctx.businessContext)
    return replacement === sentence ? { action: 'keep' } : replacementDecision(ctx, replacement)
  }

  const bounded = boundVisibilityClaims(sentence, ctx.mentions, ctx.total)
  const swapped = applyToneSwaps(bounded)
  if (swapped !== sentence) return { action: 'swap', text: swapped }
  return { action: 'keep' }
}
