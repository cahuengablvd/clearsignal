/**
 * Pre-save / pre-PDF deterministic validation pass.
 *
 * Runs AFTER the recursive sanitizer and evidence linking, right before the
 * report is persisted. It catches contradictions and dangerous artifacts that
 * survive earlier layers, repairs them deterministically where possible, and
 * otherwise degrades the offending text to a neutral fallback. It never throws
 * for content problems - a single bad field must degrade, not fail the audit.
 *
 * Pure + deterministic: no LLM, fully unit-testable.
 */
import { sanitizeUnsupportedCommercialClaims } from './sanitize'
import { assembleMaterials } from './materials'
import { repairUnsupportedMovingClaimSentence, unsupportedMovingClaims } from './industry-profiles/moving'
import { BROKEN_TEXT_REPAIRS, INTERNAL_CLIENT_ARTIFACTS } from './trust-phrases'
import { buildVerifiedFactsLayer, factAllowed } from './verified-facts'
import type { BusinessContext, ClearSignalReport, Finding } from './schemas'

export type ReportValidation = {
  report: ClearSignalReport
  warnings: string[]
  errors: string[]
}

// Raw / factual fields the validator must never rewrite (same spirit as the
// sanitizer's skip list).
const RAW_KEYS = new Set([
  'url',
  'generated_at',
  'json_ld',
  'citations',
  'answer_excerpt',
  'html_snippet',
  'extracted_text',
  'current_headline',
  'engine',
  'query',
  'cited_source',
  'checked_at',
  'brand',
  'brand_domain',
  'domain',
  'canonical_brand',
  'alternative_brand_forms',
  'evidence_id',
  'evidence_ids',
  'icp_description',
  'competitors',
])
const RAW_PREFIXES = ['meta.', 'geo.evidence.', 'technical_findings.']

function isRawPath(path: string[], key?: string): boolean {
  if (key && RAW_KEYS.has(key)) return true
  const joined = path.join('.')
  return RAW_PREFIXES.some((p) => joined.startsWith(p))
}

function findingStatus(report: ClearSignalReport, id: string): string | undefined {
  const findings = (report.technical_findings as Finding[] | null | undefined) || []
  return findings.find((f) => f.id === id)?.status
}

// Clipped role labels that may end up in stored data.
const CLIPPED_ROLE: Record<string, string> = {
  Develope: 'Developer',
  Develop: 'Developer',
  Copy: 'Copywriter',
  Copywrite: 'Copywriter',
  Foun: 'Founder / marketing',
}

const NO_DIRECT_EVIDENCE = 'Based on audit synthesis; no single direct evidence item.'

/** Deep clone via JSON round-trip (report is always JSON-serializable). */
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function isPublishablePath(path: string[]): boolean {
  const joined = path.join('.')
  return joined.startsWith('ready_materials.') || joined.startsWith('action.outreach_messages.')
}

function repairUnsupportedMovingClaimSentences(text: string, ctx?: BusinessContext): string {
  if (!text || !ctx) return text
  return (text.match(/[^.!?]+[.!?]?|\s+/g) || [text])
    .map((part) => {
      if (/^\s+$/.test(part)) return part
      return repairUnsupportedMovingClaimSentence(part, ctx)
    })
    .join('')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function removeUnsupportedMovingClaimSentences(text: string, ctx?: BusinessContext): string {
  if (!text || !ctx) return text
  return (text.match(/[^.!?]+[.!?]?|\s+/g) || [text])
    .filter((part) => /^\s+$/.test(part) || unsupportedMovingClaims(part, ctx).length === 0)
    .join('')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function cleanupClientPhrasing(text: string): string {
  return normalizeEncodingArtifacts(text)
    .replace(/([a-z0-9])\.Ask\b/gi, '$1. Ask')
    .replace(/\bAsk the team about ([^.?!]+?) for this move[.?!]?/gi, 'Contact AZ Moving to discuss $1 for your move.')
    .replace(/Contact the business to confirm\s+Contact the business to confirm/gi, 'Confirm')
    .replace(/\b(status|details)\.\s*\1\.\s*\1\b/gi, '$1')
    .replace(/\bConfirm [^.?!]+ before publishing this wording[.?!]?/gi, '')
    .replace(/\bContact the business to confirm\s+([^.!?]{1,180}?)\s+before booking[.!?]?/gi, 'Ask the team about $1 for this move.')
    .replace(/\bContact the business to confirm\s+([^.!?]{1,180}?)[.!?]/gi, 'Ask the team about $1.')
    .replace(/\b([^.!?]{1,140}?)\s+should be confirmed with the business\b/gi, 'Ask the team about $1')
    .replace(/\bcontact the team before booking\b/gi, 'ask the team for details')
    .replace(/\bbefore booking\b/gi, 'for this move')
    .replace(/\bGet My Free Quote in\s*$/gi, 'Get My Free Quote')
    .replace(/\bOr call us now\s*:?\s*$/gi, '')
    .replace(/\bwe'?ll be in touch as soon as possible\s+(?:-|--)?\s*usually within\s*[.?!]?/gi, "We'll be in touch as soon as possible.")
    .replace(/['"]Serving Toronto and the GTA since['"]/gi, 'Serving Toronto and the GTA')
    .replace(/['"]\+\s*moves completed['"]/gi, 'completed-move proof')
    .replace(/\bserving Toronto and the GTA since\s*['"]?\s*$/gi, 'Serving Toronto and the GTA')
    .replace(/\+\s*moves completed\b/gi, 'completed moves')
    .replace(/['"]?\s*on HomeStars\s*(?:--|-)\s*reviews['"]?/gi, 'HomeStars reviews')
    .replace(/\bHey\s+@\s*(?:--|-)\s*/gi, 'Hello, ')
    .replace(/\bReplace '' with real sender identity[.?!]?/gi, '')
    .replace(/\s+\|\s*get a quote\s*$/gi, '')
    .replace(/[\u0432][\u0402][\u201c\u201d]/g, ' - ')
    .replace(/\.(?=Confirm\b)/g, '. ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s*[.,;:!?]\s*/, '')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function fallbackForBrokenSentence(path: string[], sentence: string): string {
  const joined = path.join('.')
  if (/clarity\.cta\.suggested_rewrite|ready_materials\.cta_variants/.test(joined)) {
    return /moving|quote/i.test(sentence) ? 'Request a Moving Quote.' : 'Request a Quote.'
  }
  if (/action\.outreach_messages\.|implementation_briefs\./.test(joined)) return ''
  return ''
}

function repairBrokenSentenceFragments(text: string, path: string[]): string {
  const fragments = text.match(/[^.!?]+[.!?]?|\s+/g) || [text]
  const repaired = fragments.map((part) => {
    if (/^\s+$/.test(part)) return part
    const trimmed = part.trim()
    const broken =
      /\b(?:in|within|since|at|@|with|for|to|by|of|or|and)\s*[:;,.!?]?$/i.test(trimmed) ||
      /\busually within\s*[.?!]?$/i.test(trimmed) ||
      /['"]\s*$/.test(trimmed) ||
      /\b\+\s*moves completed\b/i.test(trimmed) ||
      /\bon HomeStars\s*(?:--|-)\s*reviews\b/i.test(trimmed)
    if (!broken) return part
    const fallback = fallbackForBrokenSentence(path, trimmed)
    return fallback ? `${part.match(/^\s*/)?.[0] || ''}${fallback}` : ''
  }).join('')
  return repaired
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function repairWrongDomainMentions(text: string, domain?: string): string {
  if (!domain) return text
  const normalized = domain.replace(/^www\./i, '').toLowerCase()
  const parts = normalized.split('.')
  const sld = parts[0]
  const tld = parts.slice(1).join('\\.')
  if (!sld || !tld) return text
  const escaped = sld.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(`\\b${escaped}\\.(?!${tld}\\b)[a-z]{2,}\\b`, 'gi'), normalized)
}

function normalizeEncodingArtifacts(text: string): string {
  return text
    .replace(/[\u0432][\u0402][\u2122]/g, "'")
    .replace(/[\u0432][\u0402][\u201c\u201d\u2013\u2014]/g, ' - ')
    .replace(/[\u0432][\u0402]./g, ' - ')
    .replace(/\u0412\u00b7/g, ' - ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
}

export function validateReport(input: ClearSignalReport): ReportValidation {
  const report = clone(input)
  const warnings: string[] = []
  const errors: string[] = []
  const warn = (m: string) => warnings.push(m)
  const businessContext = report.meta.business_context as BusinessContext | undefined
  const brand = (report.meta.canonical_brand || '').trim()
  const domain = report.meta.domain
  report.meta.verified_facts_layer = buildVerifiedFactsLayer({
    businessContext,
    observedBusinessContext: report.meta.observed_business_context,
  })

  const ctaStatus = findingStatus(report, 'cta_present')
  const faqStatus = findingStatus(report, 'faq_structure')

  // --- per-string repairs over human-facing prose ---
  const repair = (text: string, path: string[]): string => {
    if (!text) return text
    let out = text
    const key = path[path.length - 1]
    const inCompetitor = path.join('.').startsWith('gap.competitor_analysis.')

    // (5) Clipped role labels in stored data.
    if ((key === 'owner' || key === 'contributor' || key === 'implementer' || key === 'role') && CLIPPED_ROLE[out]) {
      warn(`role: repaired clipped label "${out}" -> "${CLIPPED_ROLE[out]}"`)
      return CLIPPED_ROLE[out]
    }

    // (5) Known broken / leaked-internal strings.
    for (const [re, replacement] of BROKEN_TEXT_REPAIRS) {
      const next = out.replace(re, replacement)
      if (next !== out) {
        warn('text: repaired broken internal phrasing')
        out = next
      }
    }

    if (/implementation_briefs\./.test(path.join('.'))) {
      const next = out.replace(
        /\b[^.!?]*(?:AggregateRating|review-rating|review schema)[^.!?]*[.!?]?/gi,
        'Use Organization, Service, LocalBusiness/MovingCompany, or FAQPage schema unless verified review-source data is supplied.'
      )
      if (next !== out) {
        warn('brief: replaced unsupported review-rating schema instruction')
        out = next
      }
    }

    // (3b) Sample-bound absolute "No presence on X" absence claims: name the
    // brand and scope it to the tested responses instead of asserting absence.
    {
      const subject = brand || 'the brand'
      const next = out
        .replace(/\bno\s+presence\s+on\b/gi, `No ${subject} presence was observed among the tested responses on`)
        .replace(/\bnot\s+listed\s+on\s+([^.;!?]{2,80})(?=[.;!?]|$)/gi, `No ${subject} listing on $1 appeared among the sources surfaced in the tested responses`)
        .replace(/\bno\s+google\s+business\s+profile\b/gi, 'A Google Business Profile was not confirmed in the reviewed sources')
        .replace(/\bno\s+(?:dedicated\s+)?([a-z][a-z -]{2,50}?\s+(?:moving|service))\s+page\b/gi, 'A dedicated $1 page was not confirmed in the crawled pages reviewed for this audit')
        .replace(/\bno\s+specialty\s+service\s+pages\b/gi, 'Specialty service pages were not confirmed in the crawled pages reviewed for this audit')
        .replace(
          /\b(?:create|claim|build|add|set up)\s+(?:a\s+)?thumbtack\s+(?:profile|listing|page)\b[^.?!]*/gi,
          'Consider validating whether Thumbtack generates meaningful Toronto-area demand before investing in a profile'
        )
        .replace(
          /\b(?:no|missing)\s+service\s+page\b[^.?!]*\blink(?:ed)?\s+in\s+navigation\b/gi,
          'A service page appears to be linked in navigation, but its crawlable content was not confirmed in this audit'
        )
      if (next !== out) {
        warn('absence: bounded an external absence claim to tested/reviewed sources')
        out = next
      }
    }

    // (3c) Remove proven causality when the audit only has public-page and
    // answer-engine evidence, not analytics/CRM data.
    {
      const next = out
        .replace(/\bthe primary driver is\b/gi, 'likely contributing factors include')
        .replace(/\bthe core issue is\b/gi, 'likely contributing factors include')
        .replace(/\bthe core reason is\b/gi, 'likely contributing factors include')
        .replace(/\bthis absence is caused by\b/gi, 'this observed absence may be associated with')
        .replace(/\bai skips you because\b/gi, 'potential factors limiting AI visibility include')
        .replace(/\bwhere\s+([A-Za-z0-9 ._-]{1,80})\s+has no detectable presence\b/gi, 'where $1 was not observed in the tested responses')
        .replace(/\bdrive significant AI answer inclusion\b/gi, 'may contribute to AI answer inclusion in this sample')
        .replace(/\bdirectly feeds AI answer content\b/gi, 'appears in AI answer source material')
        .replace(/\bget a quote in minutes\b/gi, 'get a quote')
        .replace(/\bYou can reach us directly at\s+or\s+book online at\b[.]?/gi, 'Contact the business directly to request a quote.')
        .replace(/\bI noticed you're based in\s*(?:[\u0432][\u0402][\u201d]|-)?\s*/gi, '')
        .replace(/\bvisit\s*[.]$/gi, 'visit the website.')
        .replace(/\bor call us now at\s*$/gi, '')
        .replace(/\bGet a Free Quote in\s*(?:[\u0432][\u0402][\u201d]|-)\s*/gi, 'Get a Free Quote')
      if (next !== out) {
        warn('causality: softened an unsupported causal claim')
        out = next
      }
    }

    // (1/3) Strip ANY bracketed internal placeholder / meta-instruction from
    // client-facing copy: "[Example only ...]", "[Replace with ...]",
    // "[insert ...]", "[Name]", "[Your name]", "[gallery URL]", and unclosed
    // "[..." fragments. A client must never see a bracketed editorial note.
    {
      const next = out
        .replace(/\s*\[[^\]\n]*\]/g, '') // complete brackets
        .replace(/\s*\[[^\]\n]{0,160}$/g, '') // trailing unclosed bracket
        .replace(/\(\s*\)/g, '')
        .replace(/\b(?:by|of|with|to|for)\s+(?=[.,;:)]|$)/gi, '')
        .replace(/\s+([.,;:!?])/g, '$1')
        .replace(/\s{2,}/g, ' ')
        .trim()
      if (next !== out) {
        warn(
          inCompetitor
            ? 'competitor_analysis: removed bracketed placeholder from competitor facts'
            : 'placeholder: removed bracketed internal placeholder from client copy'
        )
        out = next
      }
    }

    if (isPublishablePath(path)) {
      const commercialSafe = sanitizeUnsupportedCommercialClaims(out, businessContext)
      if (commercialSafe !== out) {
        warn('commercial_claim: softened an unsupported commercial claim')
        out = commercialSafe
        for (const [re, replacement] of BROKEN_TEXT_REPAIRS) {
          out = out.replace(re, replacement)
        }
      }
      const claimSafe = path.join('.').startsWith('action.outreach_messages.')
        ? removeUnsupportedMovingClaimSentences(out, businessContext)
        : repairUnsupportedMovingClaimSentences(out, businessContext)
      if (claimSafe !== out) {
        warn('commercial_claim: replaced an unsupported moving claim at sentence level')
        out = claimSafe
      }
    }
    out = cleanupClientPhrasing(out)
    out = repairBrokenSentenceFragments(out, path)
    out = repairWrongDomainMentions(out, domain)

    // (1) CTA contradiction.
    if (ctaStatus === 'present') {
      const next = out.replace(
        /\bno\s+(?:primary\s+|hero\s+)?cta\b[^.?!]*?\b(?:detected|found|present|visible)\b/gi,
        (m) => (/hero|above[- ]the[- ]fold|\bfold\b/i.test(m) ? m : `${m} in the hero/above-the-fold area`)
      )
      if (next !== out) {
        warn('cta: a "no CTA" statement was qualified to hero/above-the-fold (CTA detected present)')
        out = next
      }
    } else if (ctaStatus === 'unknown') {
      const next = out
        .replace(
          /\b(?:the\s+|a\s+)?(?:primary\s+|hero\s+)?cta\s+is\s+(?:clearly\s+)?present\b/gi,
          'a contact link is present, but the primary hero CTA is not confirmed'
        )
        .replace(
          /\b(?:the\s+page\s+)?has\s+a\s+(?:clear\s+|strong\s+)?(?:primary\s+)?cta\b/gi,
          'the page has a contact link, but the primary hero CTA is not confirmed'
        )
      if (next !== out) {
        warn('cta: softened an unconfirmed "CTA present" assertion (CTA not confirmed)')
        out = next
      }
    }

    // (2) FAQ contradiction.
    if (faqStatus === 'present') {
      const next = out.replace(
        /\bno\s+(?:faq|q&a|q ?and ?a|frequently asked questions)\b[^.?!]*?(?:\s+(?:was|were|is|are))?\s*(?:detected|found|present|visible)\b/gi,
        'an FAQ/Q&A structure is present'
      )
      if (next !== out) {
        warn('faq: corrected a "no FAQ" statement (FAQ structure detected present)')
        out = next
      }
    } else if (faqStatus === 'unknown') {
      const next = out.replace(
        /\b(?:the\s+page\s+)?(?:has\s+(?:an?\s+)?|includes\s+(?:an?\s+)?|contains\s+(?:an?\s+)?)?faq(?:\s+structure)?\s+is\s+present\b/gi,
        'FAQ-like content may be present but is not confirmed'
      )
      if (next !== out) {
        warn('faq: softened an unconfirmed "FAQ present" assertion (FAQ not confirmed)')
        out = next
      }
    }

    return out
  }

  const walked = mapProse(report, repair) as ClearSignalReport
  rebuildReadyMaterials(walked, warn)
  validatePublishableFacts(walked, errors)
  validateGeoCounts(walked, errors)
  repairGeoNarrativeCounts(walked, warn)

  // --- (4) evidence relevance over action.top_fixes ---
  if (walked.action && Array.isArray(walked.action.top_fixes)) {
    walked.action.top_fixes = walked.action.top_fixes.map((fix) => {
      let ids = Array.isArray(fix.evidence_ids) ? [...fix.evidence_ids] : []
      let mutatedIds = false

      // AI/entity fixes must never be grounded in meta_description.
      if (fix.category === 'ai_search' && ids.includes('OBS-META-001')) {
        ids = ids.filter((id) => id !== 'OBS-META-001')
        mutatedIds = true
        warn(`evidence: removed OBS-META-001 from an AI-visibility fix (#${fix.id})`)
      }

      let evidence_basis = fix.evidence_basis
      if (ids.length > 0) {
        // Basis must reference every linked id (and no removed one); otherwise
        // realign deterministically.
        const aligned =
          !mutatedIds &&
          typeof evidence_basis === 'string' &&
          ids.every((id) => evidence_basis!.includes(id))
        if (!aligned) {
          evidence_basis = `Based on: ${ids.join(', ')}`
          warn(`evidence: realigned evidence_basis to linked ids (#${fix.id})`)
        }
      } else if (evidence_basis !== NO_DIRECT_EVIDENCE) {
        // No ids -> the fallback must be explicit.
        evidence_basis = NO_DIRECT_EVIDENCE
        warn(`evidence: applied explicit synthesis fallback (#${fix.id})`)
      }

      return { ...fix, evidence_ids: ids, evidence_basis }
    })
  }

  // Structural usability (never throws; caller decides).
  if (!walked.action || !walked.clarity) {
    errors.push('report is missing required sections (action/clarity)')
  }
  for (const artifact of collectClientArtifacts(walked)) {
    errors.push(artifact)
  }

  return { report: walked, warnings, errors }
}

function rebuildReadyMaterials(report: ClearSignalReport, warn: (m: string) => void): void {
  if (!report.ready_materials) return
  const brand = report.meta.canonical_brand || report.geo?.brand || ''
  const url = report.meta.url || ''
  const rebuilt = assembleMaterials(brand, url, report.ready_materials, {
    businessContext: report.meta.business_context,
    observedBusinessContext: report.meta.observed_business_context,
    verifiedFacts: report.meta.verified_facts_layer,
  })
  if (JSON.stringify(rebuilt) !== JSON.stringify(report.ready_materials)) {
    report.ready_materials = rebuilt
    warn('ready_materials: rebuilt publishable materials from verified/observed facts')
  }
}

function validatePublishableFacts(report: ClearSignalReport, errors: string[]): void {
  const materials = report.ready_materials
  if (!materials) return
  const facts = report.meta.verified_facts_layer || []
  const text = [
    materials.meta_title,
    materials.meta_description,
    ...materials.cta_variants,
    ...materials.faq.flatMap((f) => [f.question, f.answer]),
    materials.json_ld,
  ].join(' ')

  const checks: Array<[RegExp, RegExp, string]> = [
    [/\b(same[- ]day|within\s+\d+\s+(?:minutes?|hours?|business days?))\b/i, /\b(response time|same[- ]day|within\s+\d+\s+(?:minutes?|hours?|business days?))\b/i, 'publishable_copy: unsupported response-time claim'],
    [/\b(no hidden fees|flat rate|fixed price|price guarantee)\b/i, /\b(pricing|price|no hidden fees|quote wording)\b/i, 'publishable_copy: unsupported pricing claim'],
    [/\b(fully insured|licensed and insured|insured movers?|insurance coverage)\b/i, /\b(insurance|insured)\b/i, 'publishable_copy: unsupported insurance claim'],
    [/\bWSIB\b/i, /\bWSIB\b/i, 'publishable_copy: unsupported WSIB claim'],
    [/\bCVOR\b/i, /\bCVOR\b/i, 'publishable_copy: unsupported CVOR claim'],
    [/\bHomeStars(?:[- ]rated| rating| star score| score)?\b/i, /\bHomeStars\b/i, 'publishable_copy: unsupported HomeStars claim'],
    [/\b(condo moves?|elevator reservations?|building management)\b/i, /\b(condo|elevator)\b/i, 'publishable_copy: unsupported condo/elevator claim'],
  ]

  for (const [claimPattern, factPattern, message] of checks) {
    if (claimPattern.test(text) && !factAllowed(facts, factPattern, 'ready_copy')) {
      errors.push(message)
    }
  }
}

function validateGeoCounts(report: ClearSignalReport, errors: string[]): void {
  const geo = report.geo
  const counts = geo?.test_counts
  if (!geo || !counts) return

  const expected = counts.configured_queries * counts.configured_engines
  if (counts.expected_combinations !== expected) {
    errors.push(
      `geo_counts: expected_combinations ${counts.expected_combinations} does not equal configured_queries * configured_engines (${expected})`
    )
  }

  const accounted =
    counts.successful_combinations + counts.failed_combinations + counts.skipped_combinations
  if (accounted !== counts.expected_combinations) {
    errors.push(
      `geo_counts: successful + failed + skipped (${accounted}) does not equal expected_combinations (${counts.expected_combinations})`
    )
  }

  if (geo.evidence.length !== counts.successful_combinations) {
    errors.push(
      `geo_counts: evidence length ${geo.evidence.length} does not equal successful_combinations ${counts.successful_combinations}`
    )
  }

  const mentioned = geo.evidence.filter((e) => e.brand_mentioned).length
  const cited = geo.evidence.filter((e) => e.brand_cited).length
  if (mentioned > counts.successful_combinations) {
    errors.push('geo_counts: mentioned combinations exceed successful combinations')
  }
  if (cited > counts.successful_combinations) {
    errors.push('geo_counts: cited combinations exceed successful combinations')
  }
}

function repairGeoNarrativeCounts(report: ClearSignalReport, warn: (m: string) => void): void {
  const geo = report.geo
  if (!geo?.test_counts || !geo.summary) return
  const successful = geo.test_counts.successful_combinations
  const mentioned = geo.evidence.filter((e) => e.brand_mentioned).length
  const cited = geo.evidence.filter((e) => e.brand_cited).length
  const engines = geo.engines_tested.length ? geo.engines_tested : [...new Set(geo.evidence.map((e) => e.engine))]
  const engineText = engines
    .map((e) => {
      const normalized = e.toLowerCase()
      if (normalized === 'openai') return 'OpenAI'
      if (normalized === 'perplexity') return 'Perplexity'
      if (normalized === 'claude') return 'Claude'
      return e.charAt(0).toUpperCase() + e.slice(1)
    })
    .join(', ')
  const staleCount = /\b\d+\s+of\s+\d+\s+tested engine-query combinations/i.test(geo.summary)
  const staleEngineList = /Perplexity and OpenAI/i.test(geo.summary) && engines.some((e) => e.toLowerCase() === 'claude')
  const forbiddenCause = /the core reason|the primary driver|AI engines skip/i.test(geo.summary)
  if (!staleCount && !staleEngineList && !forbiddenCause) return

  geo.summary = `${geo.brand} was named in ${mentioned} of ${successful} successfully tested engine-query combinations across ${engineText}. The reused evidence produced an AI visibility score of ${geo.ai_visibility_score}/100, with ${geo.mention_rate}% mention rate and ${geo.citation_rate}% citation rate. Likely contributing factors include limited owned-page answer density, limited citations of ${geo.brand_domain}, and stronger third-party source visibility for competitors in the tested responses.`
  geo.missing_signals = [
    mentioned === 0
      ? `${geo.brand} was not mentioned in any successfully tested engine-query combinations.`
      : `${geo.brand} was mentioned in ${mentioned} of ${successful} successfully tested engine-query combinations.`,
    cited === 0
      ? `${geo.brand_domain} was not cited in the successfully tested responses.`
      : `${geo.brand_domain} was cited in ${cited} of ${successful} successfully tested responses.`,
  ]
  warn('geo: rebuilt stale or causal GEO narrative from stored evidence counts')
}

type Repair = (text: string, path: string[]) => string

/** Recursively apply a repair to every human-facing string, skipping raw fields. */
function mapProse(value: unknown, repair: Repair, path: string[] = []): unknown {
  if (typeof value === 'string') {
    const key = path[path.length - 1]
    const normalized = normalizeEncodingArtifacts(value)
    return isRawPath(path, key) ? normalized : repair(normalized, path)
  }
  if (Array.isArray(value)) {
    return value.map((v, i) => mapProse(v, repair, [...path, String(i)]))
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = mapProse(v, repair, [...path, k])
    }
    return out
  }
  return value
}

function collectClientArtifacts(value: unknown, path: string[] = []): string[] {
  const out: string[] = []
  if (typeof value === 'string') {
    const key = path[path.length - 1]
    if (isRawPath(path, key)) return out
    for (const [re, label] of INTERNAL_CLIENT_ARTIFACTS) {
      if (re.test(value)) out.push(`artifact: ${label} at ${path.join('.') || '<root>'}`)
    }
    return out
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => out.push(...collectClientArtifacts(v, [...path, String(i)])))
    return out
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (!isRawPath([...path, k], k)) out.push(...collectClientArtifacts(v, [...path, k]))
    }
  }
  return out
}
