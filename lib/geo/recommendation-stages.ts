import type {
  ActionBlock,
  RecommendationStage,
  StagedGeoRecommendation,
  TechnicalEligibility,
} from '../schemas'

export const RECOMMENDATION_STAGE_LABELS: Record<RecommendationStage, string> = {
  ACCESS: 'Technical access',
  RETRIEVAL: 'First-party clarity/content',
  CITATION: 'Cited-source opportunity',
  ENTITY: 'Business facts/entity',
  AUTHORITY: 'Proof/third-party evidence',
  PROMINENCE: 'Messaging/comparison presence',
  MEASUREMENT: 'Re-test the same query set',
}

export function recommendationStageLabel(stage: RecommendationStage): string {
  return RECOMMENDATION_STAGE_LABELS[stage]
}

function normalizedText(value: { title?: string; description?: string } | string): string {
  return typeof value === 'string'
    ? value.toLowerCase()
    : `${value.title || ''} ${value.description || ''}`.toLowerCase()
}

export function recommendationStageFor(
  value: { title?: string; description?: string; category?: string } | string
): RecommendationStage {
  const text = normalizedText(value)
  const category = typeof value === 'string' ? '' : value.category || ''

  if (/\b(re-?run|retest|re-test|measure|measurement|monitor|track|validate after|test again)\b/.test(text)) return 'MEASUREMENT'
  if (/\b(robots?\.txt|crawler|crawl access|noindex|indexability|indexable|canonical|cdn|waf|http status|rendered html)\b/.test(text)) return 'ACCESS'
  if (/\b(schema|json-ld|structured data|entity|business profile|merchant center|feed|nap|name, address|sameas)\b/.test(text)) return 'ENTITY'
  if (/\b(third-party|independent|reviews?|testimonials?|case stud|customer logos?|directory|directories|publication|journalist|earned media|g2|capterra|clutch|reddit|youtube)\b/.test(text)) return 'AUTHORITY'
  if (/\b(cit(?:e|ed|ation)|source gap|comparison source|roundup|external source)\b/.test(text)) return 'CITATION'
  if (/\b(headline|\bh1\b|positioning|tagline|hero|call[- ]to[- ]action|\bcta\b|message|copy)\b/.test(text) || category === 'copy' || category === 'cta') return 'PROMINENCE'
  if (/\b(faq|page|content|category language|use case|alternatives?|comparison|answer|service area|location information)\b/.test(text) || category === 'structure' || category === 'ai_search') return 'RETRIEVAL'
  if (category === 'proof') return 'AUTHORITY'
  return 'RETRIEVAL'
}

function accessBlockReason(eligibility?: TechnicalEligibility): string | undefined {
  if (!eligibility || eligibility.overall_status === 'eligible') return undefined
  const blocked = [
    ...eligibility.checks.filter((item) => item.status === 'blocked'),
    ...eligibility.crawler_access.filter((item) => item.status === 'blocked'),
  ]
  if (blocked.length) return blocked.map((item) => item.detail).join(' ')
  if (eligibility.overall_status === 'unknown') {
    return 'Crawler access was not fully confirmed; verify technical eligibility before relying on downstream GEO changes.'
  }
  return undefined
}

export function buildStagedGeoRecommendations(
  recommendations: string[],
  eligibility?: TechnicalEligibility
): StagedGeoRecommendation[] {
  const result: StagedGeoRecommendation[] = []

  for (const check of eligibility?.checks || []) {
    if (check.status !== 'blocked') continue
    result.push({
      stage: 'ACCESS',
      action: check.id === 'ELIG-INDEX-001'
        ? 'Remove the unintended noindex directive, then confirm the audited page is publicly indexable.'
        : 'Restore a successful public response for the audited page before making downstream GEO changes.',
      depends_on_access: false,
      evidence_ids: [check.id],
    })
  }
  for (const crawler of eligibility?.crawler_access || []) {
    if (crawler.status !== 'blocked') continue
    result.push({
      stage: 'ACCESS',
      action: `Review the robots.txt rule blocking ${crawler.crawler} and allow access if ${crawler.engine} visibility is desired.`,
      depends_on_access: false,
      evidence_ids: [`ELIG-${crawler.crawler.toUpperCase()}-001`],
    })
  }

  const blockingReason = accessBlockReason(eligibility)
  for (const action of recommendations) {
    const stage = recommendationStageFor(action)
    result.push({
      stage,
      action,
      depends_on_access: stage !== 'ACCESS' && Boolean(blockingReason),
      blocking_reason: stage !== 'ACCESS' ? blockingReason : undefined,
    })
  }

  return result.filter((item, index, all) =>
    all.findIndex((candidate) => candidate.stage === item.stage && candidate.action === item.action) === index
  )
}

export function attachActionRecommendationStages(
  action: ActionBlock,
  eligibility?: TechnicalEligibility
): ActionBlock {
  const blockingReason = accessBlockReason(eligibility)
  return {
    ...action,
    top_fixes: action.top_fixes.map((fix) => {
      const stage = recommendationStageFor(fix)
      return {
        ...fix,
        recommendation_stage: stage,
        depends_on_access: stage !== 'ACCESS' && Boolean(blockingReason),
        blocking_reason: stage !== 'ACCESS' ? blockingReason : undefined,
      }
    }),
  }
}
