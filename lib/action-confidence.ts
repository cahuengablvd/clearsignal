import type { ActionBlock, Finding, GeoResult } from './schemas'
import { inferFixContributor, inferFixImplementer, inferFixOwner } from './role-assignment'
import { obsIdForFinding } from './findings'
import { buildGeoActionEvidenceCatalog, filterGeoActionEvidenceIds } from './geo/action-evidence'

const NO_DIRECT_EVIDENCE = 'Based on audit synthesis; no single direct evidence item.'

function textOf(fix: ActionBlock['top_fixes'][number]): string {
  return [fix.title, fix.description, fix.observed, fix.inferred, fix.recommended]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function formatAiVisibilityFix(fix: ActionBlock['top_fixes'][number]): ActionBlock['top_fixes'][number] {
  if (fix.category !== 'ai_search' || !fix.observed || !fix.inferred || !fix.recommended) return fix
  return {
    ...fix,
    description: `Observed: ${fix.observed}\n\nInferred: ${fix.inferred}\n\nRecommended: ${fix.recommended}`,
  }
}

function findById(findings: Finding[], id: string): Finding | undefined {
  return findings.find((f) => f.id === id)
}

function confidenceFromFinding(finding: Finding | undefined, fallback: number, fallbackBasis: string) {
  if (!finding) return { confidence: fallback, confidence_basis: fallbackBasis }
  return {
    confidence: finding.confidence,
    confidence_basis: finding.confidence_basis,
  }
}

function isExternalDependency(text: string): boolean {
  return /\b(backlinks?|roundups?|publications?|journalists?|partners?|competitor article|competitor's article|youtube|reddit|clutch|designrush|g2|capterra|directories|directory|review sites?|wikipedia|wikidata)\b/i.test(text)
}

function confidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 85) return 'high'
  if (confidence >= 60) return 'medium'
  return 'low'
}

function controlForFix(fix: ActionBlock['top_fixes'][number]): 'high' | 'medium' | 'low' {
  const text = textOf(fix)
  if (isExternalDependency(text)) return 'low'
  if (/\b(schema|json-ld|headline|tagline|copy|cta|faq|meta|landing page|service page|case stud|web3)\b/i.test(text)) {
    return 'high'
  }
  return 'medium'
}

function probabilityForFix(confidence: number, control: 'high' | 'medium' | 'low'): 'high' | 'medium' | 'low' {
  if (control === 'low') return confidence >= 80 ? 'medium' : 'low'
  if (confidence >= 85) return 'high'
  if (confidence >= 55) return 'medium'
  return 'low'
}

function claimLevelForFix(
  fix: ActionBlock['top_fixes'][number],
  confidence: number,
  findings: Finding[],
  geo: GeoResult | null
): 'observed' | 'inferred' | 'recommended' {
  const text = textOf(fix)
  const hasDirectFinding =
    /\b(cta|call[- ]to[- ]action|button|demo)\b/.test(text) && Boolean(findById(findings, 'cta_present')) ||
    /\b(schema|json-ld|structured data)\b/.test(text) && Boolean(findById(findings, 'json_ld')) ||
    /\b(faq|question|answer|q&a)\b/.test(text) && Boolean(findById(findings, 'faq_structure')) ||
    /\b(meta description|meta title|title tag)\b/.test(text) && Boolean(findById(findings, 'meta_description'))

  if (hasDirectFinding && confidence >= 80) return 'observed'
  if (confidence >= 60) return 'inferred'
  return 'recommended'
}

function confidenceForFix(
  fix: ActionBlock['top_fixes'][number],
  findings: Finding[],
  geo: GeoResult | null
) {
  const text = textOf(fix)

  if (/\b(cta|call[- ]to[- ]action|button|demo)\b/.test(text)) {
    return confidenceFromFinding(
      findById(findings, 'cta_present'),
      65,
      'CTA recommendation inferred from messaging analysis; no direct CTA evidence was linked'
    )
  }

  if (/\b(schema|json-ld|structured data)\b/.test(text)) {
    return confidenceFromFinding(
      findById(findings, 'json_ld'),
      80,
      'Structured-data recommendation based on rendered HTML checks'
    )
  }

  if (/\b(faq|question|answer|q&a)\b/.test(text)) {
    return confidenceFromFinding(
      findById(findings, 'faq_structure'),
      80,
      'FAQ recommendation based on rendered HTML and text checks'
    )
  }

  if (/\b(meta description|meta title|title tag)\b/.test(text)) {
    return confidenceFromFinding(
      findById(findings, 'meta_description'),
      80,
      'Meta recommendation based on rendered HTML checks'
    )
  }

  if (/\b(proof|testimonial|review|logo|case stud|g2|capterra|clutch|designrush)\b/.test(text)) {
    const base = confidenceFromFinding(
      findById(findings, 'social_proof'),
      55,
      'Proof recommendation depends partly on off-site/manual verification'
    )
    if (isExternalDependency(text)) {
      return {
        confidence: Math.min(base.confidence, 55),
        confidence_basis: `${base.confidence_basis}; execution depends on an external source or platform`,
      }
    }
    return base
  }

  if (fix.category === 'ai_search') {
    if (isExternalDependency(text)) {
      return {
        confidence: geo ? 58 : 45,
        confidence_basis: geo
          ? `AI visibility evidence was measured across ${geo.queries_tested} tested queries, but execution depends on external sources`
          : 'Recommendation depends on external sources and was not directly measured',
      }
    }
    return {
      confidence: geo ? 92 : 65,
      confidence_basis: geo
        ? `AI visibility evidence was measured across ${geo.queries_tested} tested queries`
        : 'AI-search recommendation inferred from page structure; no live GEO evidence available',
    }
  }

  if (fix.category === 'copy' && /\b(headline|h1|tagline|hero title)\b/.test(text)) {
    return confidenceFromFinding(
      findById(findings, 'h1_present'),
      60,
      'Copy recommendation is a messaging judgment, not a measured conversion fact'
    )
  }

  if (fix.category === 'copy') {
    return {
      confidence: 60,
      confidence_basis: 'Copy recommendation is based on audit synthesis; no single direct evidence item proves the business impact',
    }
  }

  return {
    confidence: 65,
    confidence_basis: 'Recommendation is based on audit synthesis and should be reviewed before implementation',
  }
}

function adjustExternalFix(fix: ActionBlock['top_fixes'][number]): ActionBlock['top_fixes'][number] {
  const text = textOf(fix)
  const isWikipedia = /\b(wikipedia|wikidata)\b/i.test(text)
  const isAggregateRating = /\baggregaterating\b/i.test(text)
  if (!isExternalDependency(text) && !isAggregateRating) return fix
  if (isWikipedia) {
    return {
      ...fix,
      effort: 'hard',
      description: `${fix.description} Do not treat Wikipedia or Wikidata as a standard SEO task: only pursue if independent notability and reliable third-party sources already exist. Safer alternative: build owned entity pages and credible third-party profiles first.`,
    }
  }
  if (isAggregateRating) {
    return {
      ...fix,
      effort: fix.effort === 'easy' ? 'medium' : fix.effort,
      description: `${fix.description} Use AggregateRating only when review-source data and schema guidelines support it; otherwise use Organization, Service, FAQPage, and case-study markup.`,
    }
  }
  return {
    ...fix,
    effort: fix.effort === 'easy' ? 'medium' : fix.effort,
    description: `${fix.description} Treat this as lower-control work: prioritize owned pages and credible directories first, then request inclusion from third-party sources.`,
  }
}

/**
 * Link a fix to ONLY the evidence ids that are actually relevant to it.
 * Never fabricates an id: if no relevant evidence exists, returns a synthesis
 * fallback basis with an empty id list.
 */
function evidenceForFix(
  fix: ActionBlock['top_fixes'][number],
  findings: Finding[],
  geo: GeoResult | null
): { evidence_ids: string[]; evidence_basis: string } {
  const text = textOf(fix)

  if (fix.category === 'ai_search') {
    const ids = geo
      ? filterGeoActionEvidenceIds(fix, buildGeoActionEvidenceCatalog(geo))
      : []
    if (ids.length > 0) return { evidence_ids: ids, evidence_basis: `Based on: ${ids.join(', ')}` }
    return { evidence_ids: [], evidence_basis: NO_DIRECT_EVIDENCE }
  }

  // Resolve a finding's stable evidence id only if the finding actually exists.
  const idFor = (findingId: string): string[] => {
    const f = findById(findings, findingId)
    if (!f) return []
    return [f.evidence_id || obsIdForFinding(findingId)]
  }

  let ids: string[] = []
  if (/\b(cta|call[- ]to[- ]action|button|demo)\b/.test(text)) ids = idFor('cta_present')
  else if (/\b(schema|json-ld|structured data)\b/.test(text)) ids = idFor('json_ld')
  else if (/\b(faq|question|answer|q&a)\b/.test(text)) ids = idFor('faq_structure')
  else if (/\b(meta description|meta title|title tag)\b/.test(text)) ids = idFor('meta_description')
  else if (/\b(proof|testimonial|review|logo|case stud|g2|capterra|clutch|designrush)\b/.test(text))
    ids = idFor('social_proof')
  else if (fix.category === 'copy' && /\b(headline|h1|tagline|hero title)\b/.test(text)) ids = idFor('h1_present')
  else if (fix.category === 'copy') ids = []

  if (ids.length > 0) return { evidence_ids: ids, evidence_basis: `Based on: ${ids.join(', ')}` }
  return { evidence_ids: [], evidence_basis: NO_DIRECT_EVIDENCE }
}

export function attachActionConfidence(
  action: ActionBlock,
  findings: Finding[],
  geo: GeoResult | null
): ActionBlock {
  return {
    ...action,
    top_fixes: action.top_fixes.map((rawFix) => {
      const fix = adjustExternalFix(formatAiVisibilityFix(rawFix))
      const confidence = confidenceForFix(fix, findings, geo)
      const control = controlForFix(fix)
      const evidence = evidenceForFix(fix, findings, geo)
      return {
        ...fix,
        ...confidence,
        confidence_level: confidenceLevel(confidence.confidence),
        owner: inferFixOwner(fix),
        contributor: inferFixContributor(fix),
        implementer: inferFixImplementer(fix),
        claim_level: claimLevelForFix(fix, confidence.confidence, findings, geo),
        control,
        probability: probabilityForFix(confidence.confidence, control),
        evidence_ids: evidence.evidence_ids,
        evidence_basis: evidence.evidence_basis,
      }
    }),
  }
}
