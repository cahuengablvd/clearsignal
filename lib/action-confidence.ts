import type { ActionBlock, Finding, GeoResult } from './schemas'
import { inferFixOwner } from './role-assignment'

function textOf(fix: { title: string; description: string }): string {
  return `${fix.title} ${fix.description}`.toLowerCase()
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
  return /\b(backlinks?|roundups?|publications?|journalists?|partners?|competitor article|competitor's article|youtube|reddit|clutch|designrush|g2|capterra|directories|directory|review sites?)\b/i.test(text)
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

  if (fix.category === 'copy') {
    return confidenceFromFinding(
      findById(findings, 'h1_present'),
      60,
      'Copy recommendation is a messaging judgment, not a measured conversion fact'
    )
  }

  return {
    confidence: 65,
    confidence_basis: 'Recommendation is based on audit synthesis and should be reviewed before implementation',
  }
}

function adjustExternalFix(fix: ActionBlock['top_fixes'][number]): ActionBlock['top_fixes'][number] {
  const text = textOf(fix)
  if (!isExternalDependency(text)) return fix
  return {
    ...fix,
    effort: fix.effort === 'easy' ? 'medium' : fix.effort,
    description: `${fix.description} Treat this as lower-control work: prioritize owned pages and credible directories first, then request inclusion from third-party sources.`,
  }
}

export function attachActionConfidence(
  action: ActionBlock,
  findings: Finding[],
  geo: GeoResult | null
): ActionBlock {
  return {
    ...action,
    top_fixes: action.top_fixes.map((rawFix) => {
      const fix = adjustExternalFix(rawFix)
      const confidence = confidenceForFix(fix, findings, geo)
      const control = controlForFix(fix)
      return {
        ...fix,
        ...confidence,
        confidence_level: confidenceLevel(confidence.confidence),
        owner: inferFixOwner(fix),
        control,
        probability: probabilityForFix(confidence.confidence, control),
      }
    }),
  }
}
