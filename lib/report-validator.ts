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
import { sanitizeGeneratedProse, sanitizeUnsupportedCommercialClaims } from './sanitize'
import { assembleMaterials, materialCategoryForContext } from './materials'
import { repairUnsupportedMovingClaimSentence, unsupportedMovingClaims } from './industry-profiles/moving'
import { allowedSchemaTypes } from './industry-profiles/schema-allowlist'
import { ASTROTURFING_PATTERNS, BROKEN_TEXT_REPAIRS, INTERNAL_CLIENT_ARTIFACTS } from './trust-phrases'
import { CLIENT_VISIBLE_REPLACEMENT_SENTENCES } from './trust/decisions'
import { buildVerifiedFactsLayer, factAllowed } from './verified-facts'
import { buildGeoSummary } from './geo'
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
// validation_warnings is operator metadata (never rendered client-side) and its
// entries quote blocked phrases verbatim - scanning it would make any report
// that once recorded a replacement_phrase error fail every later validation.
const RAW_PREFIXES = ['meta.', 'geo.evidence.', 'technical_findings.', 'validation_warnings', 'quality.']

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
const BLOCKED_CLIENT_REPAIR_PHRASES = [
  ...CLIENT_VISIBLE_REPLACEMENT_SENTENCES,
  'Potential business impact should be treated as a hypothesis until verified with analytics or operator data.',
  'Proof-related recommendations should be backed by verified source data.',
  'Rating recommendations should use verified review-source data.',
  'Use verified business data before publishing this example.',
  'Specific service commitments should be published only when the business has verified them.',
  'Response-time wording should be used only when the business has verified it.',
  'Credential claims should use current verified business details.',
  'Ask the team about service details for this move.',
  'Use source-backed proof details.',
  'Use verified review-source context.',
  'Use verified credential details.',
  'Use verified response-time wording.',
  'Add source-backed proof details.',
  'Add source-backed proof details in crawlable copy.',
  'Add verified review-source context.',
  'Add verified review-source context in crawlable copy.',
  'Add verified credential details.',
  'Add verified credential details in crawlable copy.',
  'Use response-time wording only when verified.',
  'Confirm source data before adding proof claims.',
  'Confirm review-source data before adding rating claims.',
  'Confirm credential details with the business before adding credential claims.',
  'Confirm response-time details with the business before adding response-time claims.',
  'Use verified proof points only.',
  'Use verified rating context only.',
  'Clarify this recommendation with verified proof before publishing.',
  'Clarify review proof with verified rating context.',
  'If the business can verify a response-time commitment, publish it as conditional supporting copy.',
  'If the business can verify credential details, publish them in crawlable prose.',
  'Mention response timing only if the business has verified it.',
  'Mention credentials only if the business has verified them.',
  'Contact AZ Moving to discuss third-party rating details for your move.',
  'Contact AZ Moving to discuss piano-moving availability for your move.',
]

const INTERNAL_INSTRUCTION_SENTENCE_PATTERNS = [
  /(?:^|[.!?]\s+)\s*Keep the tone\b[^.?!]*[.?!]?/gi,
  /(?:^|[.!?]\s+)\s*Do not\b[^.?!]*[.?!]?/gi,
  /(?:^|[.!?]\s+)\s*No invented outcomes\b[^.?!]*[.?!]?/gi,
  /(?:^|[.!?]\s+)\s*No revenue claims\b[^.?!]*[.?!]?/gi,
  /(?:^|[.!?]\s+)\s*No scarcity\b[^.?!]*[.?!]?/gi,
  /(?:^|[.!?]\s+)\s*Twitter\/X tone\b[^.?!]*[.?!]?/gi,
  /(?:^|[.!?]\s+)\s*The three points cited\b[^.?!]*[.?!]?/gi,
  /(?:^|[.!?]\s+)\s*Replace ['"][^'"]*['"](?:\s+and\s+['"][^'"]*['"])? before sending\b[^.?!]*[.?!]?/gi,
  /(?:^|[.!?]\s+)\s*Replace ['"][^'"]*['"] with\b[^.?!]*[.?!]?/gi,
]

const CLIENT_ARTIFACT_PATTERNS: Array<[RegExp, string]> = [
  [/\bKeep the tone\b/i, 'internal instruction'],
  [/\bDo not (?:claim|invent|add|tag)\b/i, 'internal instruction'],
  [/\bNo invented outcomes\b/i, 'internal instruction'],
  [/\bNo revenue claims\b/i, 'internal instruction'],
  [/\bTwitter\/X tone\b/i, 'internal instruction'],
  [/\bContact\s+[A-Z][A-Za-z0-9 -]{1,60}\s+to discuss\s+(?:third-party rating|credential|proof|piano-moving availability)[^.?!]*[.?!]?/i, 'replacement contact instruction'],
  [/\bFix:\s*(?:$|\n|---|Owner:|Priority score:)/i, 'empty fix'],
  [/\b(?:labelled|labeled|placeholder)\s+''\b/i, 'empty placeholder'],
  [/\be\.g\.,?\s*Use (?:MovingCompany|Organization|Service|FAQPage|LocalBusiness|ProfessionalService)[^.!?]*(?:unless verified|schema unless)/i, 'schema guidance leak'],
]

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
    .replace(
      /\bSeed brand mentions in high-traffic Reddit and Facebook communities\b/gi,
      'Participate transparently in relevant communities where the business can provide genuinely useful expertise'
    )
    .replace(
      /\be\.g\.,?\s*(Use (?:MovingCompany|Organization|Service|FAQPage|LocalBusiness|ProfessionalService|ArtGallery|VisualArtwork)[^.!?]*(?:unless verified|schema unless)[^.!?]*[.?!]?)/gi,
      '$1'
    )
    .replace(
      /\bContact\s+[A-Z][A-Za-z0-9 -]{1,60}\s+to discuss\s+(?:third-party rating|credential|proof|piano-moving availability)[^.?!]*[.?!]?\s*/gi,
      ''
    )
    .replace(
      /\bPricing was not confirmed in this audit\.?['"]?\s+Its\b/gi,
      'This cited source appears to include pricing/use-case content. Its'
    )
    .replace(
      /\bPricing was not confirmed in this audit\.?['"]?/gi,
      'This cited source appears to include pricing/use-case content.'
    )
    .replace(
      /\bFix the post-submission confirmation typo and add a response-time commitment\b/gi,
      'Fix the post-submission confirmation typo; add response-time wording only if verified'
    )
    .replace(
      /\badd a response-time commitment\b/gi,
      'add response-time wording only if the business can verify it'
    )
    .replace(
      /\bincludes a specific, non-placeholder response-time statement \(e\.g\., a defined number of hours or 'same business day'\)/gi,
      'uses response-time wording only if the business has verified it; otherwise no response-time promise is shown'
    )
    .replace(
      /\bconfirms it is fully insured\b/gi,
      'describes insurance only if verified by the business'
    )
    .replace(
      /\bToronto's Fully Insured Movers\b/gi,
      'Toronto Movers'
    )
    .replace(
      /\bfully insured Toronto-based moving company\b/gi,
      'Toronto-based moving company'
    )
    .replace(/([a-z0-9])\.Ask\b/gi, '$1. Ask')
    .replace(/Contact the business to confirm\s+Contact the business to confirm/gi, 'Confirm')
    .replace(/\b(status|details)\.\s*\1\.\s*\1\b/gi, '$1')
    .replace(/\bConfirm [^.?!]+ before publishing this wording[.?!]?/gi, '')
    .replace(/\bContact the business to confirm\s+([^.!?]{1,180}?)\s+before booking[.!?]?/gi, 'Ask the team about $1 for this move.')
    .replace(/\bContact the business to confirm\s+([^.!?]{1,180}?)[.!?]/gi, 'Ask the team about $1.')
    .replace(/\b([^.!?]{1,140}?)\s+should be confirmed with the business\b/gi, 'Ask the team about $1')
    .replace(/\bcontact the team before booking\b/gi, 'ask the team for details')
    .replace(/\bbefore booking\b/gi, 'for this move')
    .replace(/\bGet My Free Quote in\b/gi, 'Get My Free Quote')
    .replace(/\bGet a Free Quote in\s*(?:[\u0432][\u0402][\u201d]|-)\s*/gi, 'Get a Free Quote')
    .replace(/\bAdd a visible secondary CTA such as ['"]?Or call us now:?\s*['"]?\s+directly beneath the form[.?!]?/gi, '')
    .replace(/\bOr call us now\s*:?\s*/gi, '')
    .replace(/\bwe'?ll be in touch as soon as possible\s+(?:-|--)?\s*usually within\s*,?\s*[.?!]?/gi, "We'll be in touch as soon as possible.")
    .replace(/\busually within\s*,\s*(?:substituting|replace)[^.?!]*[.?!]?/gi, '')
    .replace(/['"]Serving Toronto and the GTA since['"]/gi, 'Serving Toronto and the GTA')
    .replace(/['"]\+\s*moves completed['"]/gi, 'completed-move proof')
    .replace(/\bserving Toronto and the GTA since\s*['"]?\s*$/gi, 'Serving Toronto and the GTA')
    .replace(/\+\s*moves completed\b/gi, 'completed moves')
    .replace(/['"]?\s*on HomeStars\s*(?:--|-)\s*reviews['"]?/gi, 'HomeStars reviews')
    .replace(/\bHey\s+@\s*(?:--|-|[\u2013\u2014])?\s*/gi, 'Hello, ')
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

function stripInternalInstructionSentences(text: string): string {
  if (!text) return text
  let out = text
  for (const re of INTERNAL_INSTRUCTION_SENTENCE_PATTERNS) {
    out = out.replace(re, (match) => (match.startsWith('.') || match.startsWith('!') || match.startsWith('?') ? match[0] : ''))
  }
  return out
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/^[,;:]\s*/, '')
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
    .replace(/[\u0432][\u201a][\u00ac]|\u20ac/g, 'EUR ')
    .replace(/[\u0432][\u0402][\u2122]/g, "'")
    .replace(/[\u0432][\u0402][\u201c\u201d\u2013\u2014]/g, ' - ')
    .replace(/[\u0432][\u0402]./g, ' - ')
    .replace(/\u0412\u00b7/g, ' - ')
    .replace(/\bEUR\s+(\d)/g, 'EUR $1')
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

    const withoutStandaloneRepair = stripBlockedRepairOnlySentences(out)
    if (withoutStandaloneRepair !== out) {
      warn(`text: dropped standalone replacement sentence at ${path.join('.') || '<root>'}`)
      out = withoutStandaloneRepair
    }
    const withoutBlockedRepairPhrases = stripBlockedRepairPhrases(out)
    if (withoutBlockedRepairPhrases !== out) {
      warn(`text: removed blocked replacement phrase at ${path.join('.') || '<root>'}`)
      out = withoutBlockedRepairPhrases
    }
    const withoutInternalInstructions = stripInternalInstructionSentences(out)
    if (withoutInternalInstructions !== out) {
      warn(`text: removed internal instruction sentence at ${path.join('.') || '<root>'}`)
      out = withoutInternalInstructions
    }

    if (/implementation_briefs\./.test(path.join('.'))) {
      const next = out.replace(
        /\b[^.!?]*(?:AggregateRating|review-rating|review schema)[^.!?]*[.!?]?/gi,
        schemaGuidanceForReport(report)
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
  dropReplacementOnlyBriefSteps(walked, warn)
  validateFaqSanity(walked, errors)
  dropEmptyNarrativeArrayItems(walked, warn)
  dropEmptyActionItems(walked, warn)
  validateEmptyClientFields(walked, errors)
  validatePublishableFacts(walked, errors)
  validateGeoCounts(walked, errors)
  rebuildGeoSummary(walked, warn)
  dropNarrativeMetricCounts(walked, warn)
  ensureExecutiveSummary(walked, warn)
  normalizeOutreachChannels(walked, warn)
  warnSlashJoinedReadyMaterials(walked, warn)
  validatePolicyWording(walked, errors, warnings)
  validateReadyMaterialsCategory(walked, errors)

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

      const fixText = `${fix.title || ''} ${fix.description || ''}`.toLowerCase()
      const isHeadlineFix = fix.category === 'copy' && /\b(headline|h1|tagline|hero title)\b/.test(fixText)
      if (!isHeadlineFix && ids.includes('OBS-H1-001')) {
        ids = ids.filter((id) => id !== 'OBS-H1-001')
        mutatedIds = true
        warn(`evidence: removed OBS-H1-001 from a non-headline fix (#${fix.id})`)
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
  validateActionUsability(walked, errors)
  for (const artifact of collectClientArtifacts(walked)) {
    errors.push(artifact)
  }

  return { report: walked, warnings, errors }
}

function ensureExecutiveSummary(report: ClearSignalReport, warn: (m: string) => void): void {
  if (!report.action) return
  if (typeof report.action.executive_summary === 'string' && report.action.executive_summary.trim()) return

  const brand = report.meta.canonical_brand || report.geo?.brand || 'The site'
  const fixes = Array.isArray(report.action.top_fixes)
    ? report.action.top_fixes
        .map((fix) => (typeof fix.title === 'string' ? fix.title.trim() : ''))
        .filter(Boolean)
        .slice(0, 2)
    : []
  const focus = fixes.length > 0
    ? `The highest-priority opportunities are: ${fixes.join('; ')}.`
    : 'The highest-priority opportunities are to improve crawlable proof, clarify conversion copy, and keep recommendations tied to verified source data.'

  report.action.executive_summary = `${brand} was reviewed against the crawled page, selected competitors, and tested AI responses. ${focus}`
  warn('executive_summary: rebuilt empty summary from validated action items')
}

function rebuildReadyMaterials(report: ClearSignalReport, warn: (m: string) => void): void {
  if (!report.ready_materials) return
  const brand = report.meta.canonical_brand || report.geo?.brand || ''
  const url = report.meta.url || ''
  const businessContext = report.meta.business_context
  const clean = (text: string) => sanitizeGeneratedProse(text, undefined, undefined, {
    businessContext,
    scope: 'publishable_copy',
  })
  const llm = {
    meta_title: clean(report.ready_materials.meta_title || ''),
    meta_description: clean(report.ready_materials.meta_description || ''),
    faq: (report.ready_materials.faq || []).map((f) => ({
      question: clean(f.question || ''),
      answer: clean(f.answer || ''),
    })),
    cta_variants: (report.ready_materials.cta_variants || []).map(clean).filter(Boolean),
  }
  const rebuilt = assembleMaterials(brand, url, llm, {
    businessContext: report.meta.business_context,
    observedBusinessContext: report.meta.observed_business_context,
    verifiedFacts: report.meta.verified_facts_layer,
  })
  if (JSON.stringify(rebuilt) !== JSON.stringify(report.ready_materials)) {
    report.ready_materials = rebuilt
    warn('ready_materials: rebuilt publishable materials from verified/observed facts')
  }
}

function normalizedPhrase(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isBlockedRepairPhrase(value: string): boolean {
  const normalized = normalizedPhrase(value).replace(/[.!?]+$/, '')
  return BLOCKED_CLIENT_REPAIR_PHRASES.some((phrase) => {
    const p = normalizedPhrase(phrase).replace(/[.!?]+$/, '')
    return normalized === p
  })
}

function stripBlockedRepairPhrases(text: string): string {
  if (!text) return text
  let out = text
  const phrases = [...BLOCKED_CLIENT_REPAIR_PHRASES].sort((a, b) => b.length - a.length)
  for (const phrase of phrases) {
    const core = normalizedPhrase(phrase).replace(/[.!?]+$/, '')
    if (!core) continue
    const re = new RegExp(`(^|\\s+)${escapeRegExp(core)}[.!?]?\\s*`, 'gi')
    out = out.replace(re, (_match, leading: string) => (leading ? ' ' : ''))
  }
  return out
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/^[,;:]\s*/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function stripBlockedRepairOnlySentences(text: string): string {
  if (!text) return text
  return (text.match(/[^.!?]+[.!?]?|\s+/g) || [text])
    .filter((part) => /^\s+$/.test(part) || !isBlockedRepairPhrase(part))
    .join('')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function dropReplacementOnlyBriefSteps(report: ClearSignalReport, warn: (m: string) => void): void {
  if (!Array.isArray(report.implementation_briefs)) return
  report.implementation_briefs = report.implementation_briefs.map((brief, briefIndex) => {
    const cleanList = (items: string[] | undefined, key: 'steps' | 'acceptance_criteria') => {
      if (!Array.isArray(items)) return items
      const kept = items.filter((item) => !isBlockedRepairPhrase(item))
      if (kept.length !== items.length) {
        warn(`implementation_briefs.${briefIndex}.${key}: dropped replacement-only instruction`)
      }
      return kept
    }
    return {
      ...brief,
      steps: cleanList(brief.steps, 'steps') ?? [],
      acceptance_criteria: cleanList(brief.acceptance_criteria, 'acceptance_criteria') ?? [],
    }
  })
}

function compactStringArray(items: unknown, label: string, warn: (m: string) => void): unknown {
  if (!Array.isArray(items)) return items
  const kept = items.filter((item) => typeof item !== 'string' || item.trim().length > 0)
  if (kept.length !== items.length) warn(`${label}: dropped empty item after legacy cleanup`)
  return kept
}

function dropEmptyNarrativeArrayItems(report: ClearSignalReport, warn: (m: string) => void): void {
  const r = report as unknown as Record<string, any>
  if (r.gap) {
    r.gap.where_you_win = compactStringArray(r.gap.where_you_win, 'gap.where_you_win', warn)
    r.gap.where_you_lose = compactStringArray(r.gap.where_you_lose, 'gap.where_you_lose', warn)
    if (r.gap.ai_search) {
      r.gap.ai_search.missing_signals = compactStringArray(
        r.gap.ai_search.missing_signals,
        'gap.ai_search.missing_signals',
        warn
      )
    }
  }
  if (r.geo) {
    r.geo.missing_signals = compactStringArray(r.geo.missing_signals, 'geo.missing_signals', warn)
    r.geo.recommendations = compactStringArray(r.geo.recommendations, 'geo.recommendations', warn)
  }
}

function dropEmptyActionItems(report: ClearSignalReport, warn: (m: string) => void): void {
  if (Array.isArray(report.action?.top_fixes)) {
    report.action.top_fixes = report.action.top_fixes.map((fix) => {
      const hasTitle = String(fix.title || '').trim().length > 0
      const hasDescription = String(fix.description || '').trim().length > 0
      if (!hasTitle && hasDescription) {
        warn('action.top_fixes: replaced empty title with neutral fallback')
        return { ...fix, title: 'Recommended fix' }
      }
      return fix
    })
    const before = report.action.top_fixes.length
    report.action.top_fixes = report.action.top_fixes.filter((fix) => {
      const title = String(fix.title || '').trim()
      const description = String(fix.description || '').trim()
      if (title && !description) return false
      if (!description && isBareLabel(fix.title)) return false
      return title.length > 0 && description.length > 0
    })
    if (report.action.top_fixes.length !== before) warn('action.top_fixes: dropped empty action item')
  }

  if (Array.isArray(report.implementation_briefs)) {
    report.implementation_briefs = report.implementation_briefs.map((brief, index) => {
      const steps = Array.isArray(brief.steps) ? brief.steps.filter((s) => String(s || '').trim().length > 0) : []
      const acceptanceCriteria = Array.isArray(brief.acceptance_criteria)
        ? brief.acceptance_criteria.filter((s) => String(s || '').trim().length > 0)
        : []
      if (Array.isArray(brief.steps) && steps.length !== brief.steps.length) {
        warn(`implementation_briefs.${index}.steps: dropped empty step`)
      }
      if (Array.isArray(brief.acceptance_criteria) && acceptanceCriteria.length !== brief.acceptance_criteria.length) {
        warn(`implementation_briefs.${index}.acceptance_criteria: dropped empty acceptance criterion`)
      }
      return {
        ...brief,
        steps,
        acceptance_criteria: acceptanceCriteria,
      }
    })
    const before = report.implementation_briefs.length
    report.implementation_briefs = report.implementation_briefs.filter((brief) => {
      const hasTitle = String(brief.fix_title || '').trim().length > 0
      const hasSteps = Array.isArray(brief.steps) && brief.steps.some((s) => String(s || '').trim().length > 0)
      const hasAcceptance =
        Array.isArray(brief.acceptance_criteria) &&
        brief.acceptance_criteria.some((s) => String(s || '').trim().length > 0)
      return hasTitle && (hasSteps || hasAcceptance)
    })
    if (report.implementation_briefs.length !== before) warn('implementation_briefs: dropped empty brief')
  }
}

function validateActionUsability(report: ClearSignalReport, errors: string[]): void {
  const fixes = report.action?.top_fixes
  if (Array.isArray(fixes)) {
    fixes.forEach((fix, index) => {
      if (!String(fix.title || '').trim() && !String(fix.description || '').trim()) {
        errors.push(`action.top_fixes.${index}: empty action item`)
      }
    })
  }

  if (Array.isArray(report.implementation_briefs)) {
    report.implementation_briefs.forEach((brief, index) => {
      if (!String(brief.fix_title || '').trim()) errors.push(`implementation_briefs.${index}: empty fix_title`)
      const stepCount = Array.isArray(brief.steps) ? brief.steps.filter((s) => String(s || '').trim()).length : 0
      const acceptanceCount = Array.isArray(brief.acceptance_criteria)
        ? brief.acceptance_criteria.filter((s) => String(s || '').trim()).length
        : 0
      if (stepCount === 0 && acceptanceCount === 0) {
        errors.push(`implementation_briefs.${index}: empty implementation brief`)
      }
    })
  }
}

function isEmptyLike(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return trimmed.length === 0 || /^(?:fix|problem|answer|question|title|description|rewrite|step|criteria)\s*:?\s*$/i.test(trimmed)
}

function isBareLabel(value: unknown): boolean {
  if (typeof value !== 'string') return false
  return /^(?:fix|problem|answer|question|title|description|rewrite|step|criteria)\s*:?\s*$/i.test(value.trim())
}

function validateStringField(value: unknown, path: string, errors: string[]): void {
  if (isEmptyLike(value)) errors.push(`empty_field at ${path}`)
}

function validateStringArrayFields(values: unknown, path: string, errors: string[]): void {
  if (!Array.isArray(values)) return
  values.forEach((value, index) => validateStringField(value, `${path}.${index}`, errors))
}

function validateEmptyClientFields(report: ClearSignalReport, errors: string[]): void {
  report.action?.top_fixes?.forEach((fix, index) => {
    validateStringField(fix.title, `action.top_fixes.${index}.title`, errors)
    validateStringField(fix.description, `action.top_fixes.${index}.description`, errors)
  })

  report.implementation_briefs?.forEach((brief, index) => {
    validateStringField(brief.fix_title, `implementation_briefs.${index}.fix_title`, errors)
    if (Array.isArray(brief.steps) && brief.steps.length === 0) {
      errors.push(`empty_field at implementation_briefs.${index}.steps`)
    }
    if (Array.isArray(brief.acceptance_criteria) && brief.acceptance_criteria.length === 0) {
      errors.push(`empty_field at implementation_briefs.${index}.acceptance_criteria`)
    }
    validateStringArrayFields(brief.steps, `implementation_briefs.${index}.steps`, errors)
    validateStringArrayFields(brief.acceptance_criteria, `implementation_briefs.${index}.acceptance_criteria`, errors)
  })

  const materials = report.ready_materials
  if (materials) {
    validateStringField(materials.meta_title, 'ready_materials.meta_title', errors)
    validateStringField(materials.meta_description, 'ready_materials.meta_description', errors)
    validateStringArrayFields(materials.cta_variants, 'ready_materials.cta_variants', errors)
    materials.faq?.forEach((faq, index) => {
      validateStringField(faq.question, `ready_materials.faq.${index}.question`, errors)
      validateStringField(faq.answer, `ready_materials.faq.${index}.answer`, errors)
    })
  }

  for (const key of ['headline', 'cta'] as const) {
    if (isBareLabel(report.clarity?.[key]?.suggested_rewrite)) {
      errors.push(`empty_field at clarity.${key}.suggested_rewrite`)
    }
  }
}

function normalizedSentence(value: string): string {
  return value.trim().replace(/[.!?]+$/, '').replace(/\s+/g, ' ').toLowerCase()
}

function isClientReplacementSentence(value: string): boolean {
  const normalized = normalizedSentence(value)
  return CLIENT_VISIBLE_REPLACEMENT_SENTENCES.some((sentence) => normalizedSentence(sentence) === normalized)
}

function validateFaqSanity(report: ClearSignalReport, errors: string[]): void {
  const faq = report.ready_materials?.faq
  if (!Array.isArray(faq)) return
  faq.forEach((item, index) => {
    const question = String(item.question || '').trim()
    const answer = String(item.answer || '').trim()
    const path = `ready_materials.faq.${index}.answer`
    if (answer.length > 0 && answer.length < 20) errors.push(`faq_structure at ${path}: answer too short`)
    if (answer && question && normalizedSentence(answer) === normalizedSentence(question)) {
      errors.push(`faq_structure at ${path}: answer repeats question`)
    }
    if (isClientReplacementSentence(answer)) {
      errors.push(`faq_structure at ${path}: replacement sentence leaked`)
    }
  })
}

function validatePolicyWording(report: ClearSignalReport, errors: string[], warnings: string[]): void {
  const visit = (value: unknown, path: string[] = []) => {
    if (typeof value === 'string') {
      const key = path[path.length - 1]
      if (isRawPath(path, key)) return
      for (const [pattern, label] of ASTROTURFING_PATTERNS) {
        pattern.lastIndex = 0
        if (pattern.test(value) && !hasPolicyNegationGuard(value, pattern)) {
          const message = `policy_wording at ${path.join('.') || '<root>'}: ${label}`
          if (isPublishablePath(path)) errors.push(message)
          else warnings.push(message)
        }
      }
      return
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, [...path, String(index)]))
      return
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) visit(child, [...path, key])
    }
  }
  visit(report)
}

function hasPolicyNegationGuard(value: string, pattern: RegExp): boolean {
  const re = new RegExp(pattern.source, pattern.flags.replace('g', ''))
  const match = re.exec(value)
  if (!match || match.index < 0) return false
  const before = value.slice(Math.max(0, match.index - 40), match.index)
  return /\b(?:avoid|never|not|without|do\s+not|don't)\b[\s\w,;:-]*$/i.test(before)
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

function normalizeOutreachChannels(report: ClearSignalReport, warn: (m: string) => void): void {
  const messages = report.action?.outreach_messages
  if (!Array.isArray(messages)) return

  const seen = new Set<string>()
  const unique = []
  for (const message of messages) {
    if (!message || typeof message.channel !== 'string') continue
    if (seen.has(message.channel)) {
      warn(`outreach_messages: dropped duplicate ${message.channel} message`)
      continue
    }
    seen.add(message.channel)
    unique.push(message)
  }

  if (unique.length !== messages.length) {
    report.action.outreach_messages = unique
  }
  const required = ['linkedin', 'email', 'twitter']
  const missing = required.filter((channel) => !seen.has(channel))
  if (missing.length) {
    warn(`outreach_messages: missing ${missing.join(', ')} message`)
  }
}

function warnSlashJoinedReadyMaterials(report: ClearSignalReport, warn: (m: string) => void): void {
  const materials = report.ready_materials
  if (!materials) return
  const values = [
    materials.meta_title,
    materials.meta_description,
    ...materials.cta_variants,
    ...materials.faq.flatMap((f) => [f.question, f.answer]),
  ]
  if (values.some((value) => /\b[A-Za-z][A-Za-z .-]{1,40}\s+\/\s+[A-Za-z][A-Za-z .-]{1,40}(?:\s+\/\s+[A-Za-z][A-Za-z .-]{1,40})?\b/.test(value))) {
    warn('ready_materials: location list should be rendered as prose, not slash-joined')
  }
}

function jsonLdTypes(jsonLd?: string): string[] {
  if (!jsonLd) return []
  try {
    const json = jsonLd.replace(/<\/?script[^>]*>/gi, '').trim()
    const parsed = JSON.parse(json)
    const graph = Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed]
    return graph
      .map((node) => (node && typeof node === 'object' ? (node as Record<string, unknown>)['@type'] : undefined))
      .flat()
      .filter((type): type is string => typeof type === 'string')
  } catch {
    return []
  }
}

function schemaGuidanceForReport(report: ClearSignalReport): string {
  const category = materialCategoryForContext(
    report.meta.business_context as BusinessContext | undefined,
    report.meta.observed_business_context
  )
  const types = (allowedSchemaTypes(category) || ['Organization', 'FAQPage'])
    .filter((type) => !/AggregateRating|Review/i.test(type))
    .filter((type) => category !== 'moving_service' || type !== 'LocalBusiness')
  return `Use ${types.join(', ')} schema unless verified review-source data is supplied.`
}

function schemaTypeMentions(text: string): string[] {
  const known = [
    'MovingCompany',
    'ProfessionalService',
    'LocalBusiness',
    'ArtGallery',
    'VisualArtwork',
    'Organization',
    'Service',
    'FAQPage',
    'AggregateRating',
    'Review',
    'VideoObject',
    'WebSite',
    'ItemList',
    'OfferCatalog',
  ]
  return known.filter((type) => {
    const escaped = escapeRegExp(type)
    const typeContext = new RegExp(`\\b${escaped}\\b\\s+(?:schema|markup|type)\\b`, 'i')
    const atTypeContext = new RegExp(`@type["']?\\s*:\\s*["']${escaped}["']`, 'i')
    const schemaOrgContext = new RegExp(`schema\\.org/${escaped}\\b`, 'i')
    return typeContext.test(text) || atTypeContext.test(text) || schemaOrgContext.test(text)
  })
}

function validateReadyMaterialsCategory(report: ClearSignalReport, errors: string[]): void {
  const category = materialCategoryForContext(
    report.meta.business_context as BusinessContext | undefined,
    report.meta.observed_business_context
  )
  const materials = report.ready_materials
  if (!materials) return

  const allowed = new Set(allowedSchemaTypes(category) || [])
  for (const type of jsonLdTypes(materials.json_ld)) {
    if (allowed.size > 0 && !allowed.has(type)) {
      errors.push(`schema_mismatch at ready_materials.json_ld: ${type} is not allowed for ${category}`)
    }
  }

  report.implementation_briefs?.forEach((brief, briefIndex) => {
    const fields = [
      ['fix_title', brief.fix_title],
      ...brief.steps.map((step, stepIndex) => [`steps.${stepIndex}`, step] as const),
      ...brief.acceptance_criteria.map((criterion, criterionIndex) => [`acceptance_criteria.${criterionIndex}`, criterion] as const),
    ] as Array<readonly [string, string]>
    for (const [field, value] of fields) {
      for (const type of schemaTypeMentions(value)) {
        if (allowed.size > 0 && !allowed.has(type)) {
          errors.push(`schema_mismatch at implementation_briefs.${briefIndex}.${field}: ${type} is not allowed for ${category}`)
        }
      }
    }
  })

  if (category !== 'moving_service') {
    const text = [
      materials.meta_title,
      materials.meta_description,
      ...materials.cta_variants,
      ...materials.faq.flatMap((f) => [f.question, f.answer]),
      report.action?.outreach_messages?.map((m) => m.message).join(' ') || '',
    ].join(' ')
    if (/\b(moving quote|moving services?|movers?|pickup and drop[- ]off|stairs or elevator|inventory size|residential moving|commercial moving|piano moving)\b/i.test(text)) {
      errors.push(`foreign_category_copy: moving-service wording appeared in ${category} materials`)
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

function rebuildGeoSummary(report: ClearSignalReport, warn: (m: string) => void): void {
  const geo = report.geo
  if (!geo?.test_counts) return
  const mentioned = geo.evidence.filter((e) => e.brand_mentioned).length
  const cited = geo.evidence.filter((e) => e.brand_cited).length
  const engines = geo.engines_tested.length ? geo.engines_tested : [...new Set(geo.evidence.map((e) => e.engine))]
  const reused = /reused|previous completed scan/i.test(geo.summary || '')
  const expected = buildGeoSummary({
    brand: geo.brand,
    brandDomain: geo.brand_domain,
    test_counts: geo.test_counts,
    mention_rate: geo.mention_rate,
    citation_rate: geo.citation_rate,
    ai_visibility_score: geo.ai_visibility_score,
    mentionedCombinations: mentioned,
    engines,
    evidenceReused: reused,
  })
  if (geo.summary !== expected) {
    geo.summary = expected
    warn('geo: rebuilt summary from metrics')
  }
  geo.missing_signals = [
    mentioned === 0
      ? `${geo.brand} was not mentioned in the successfully tested engine-query combinations.`
      : `${geo.brand} was mentioned in part of the successfully tested engine-query sample.`,
    cited === 0
      ? `${geo.brand_domain} was not cited in the successfully tested responses.`
      : `${geo.brand_domain} was cited in part of the successfully tested responses.`,
  ]
}

function dropMetricCountSentences(text: string): string {
  if (!text) return text
  const metricCount = /\d+\s*(%|tested|successfully|results?|combinations?|citations?|queries|engines?)/i
  const kept = text
    .match(/[^.!?]+[.!?]?|\s+/g)
    ?.filter((part) => /^\s+$/.test(part) || !metricCount.test(part))
    .join('') ?? text
  return kept
    .replace(/\b(?:and|or|but|because|so|while)\s*([.!?])/gi, '$1')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function dropNarrativeMetricCounts(report: ClearSignalReport, warn: (m: string) => void): void {
  const clean = (value: string) => {
    const next = dropMetricCountSentences(value)
    if (next !== value) warn('metrics: dropped numeric test-run sentence from narrative field')
    return next
  }

  if (report.geo) {
    if (Array.isArray(report.geo.missing_signals)) {
      report.geo.missing_signals = report.geo.missing_signals.map(clean).filter(Boolean)
    }
    if (Array.isArray(report.geo.recommendations)) {
      report.geo.recommendations = report.geo.recommendations.map(clean).filter(Boolean)
    }
  }
  if (report.gap?.ai_search) {
    if (typeof report.gap.ai_search.finding === 'string') {
      report.gap.ai_search.finding = clean(report.gap.ai_search.finding)
    }
    if (Array.isArray(report.gap.ai_search.missing_signals)) {
      report.gap.ai_search.missing_signals = report.gap.ai_search.missing_signals.map(clean).filter(Boolean)
    }
  }
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
    const joined = path.join('.')
    const isReadyJsonLd = joined.startsWith('ready_materials.json_ld')
    if (isRawPath(path, key) && !isReadyJsonLd) return out
    if (!isReadyJsonLd) {
      for (const [re, label] of INTERNAL_CLIENT_ARTIFACTS) {
        if (re.test(value)) out.push(`artifact: ${label} at ${joined || '<root>'}`)
      }
    }
    const lower = value.toLowerCase()
    for (const phrase of BLOCKED_CLIENT_REPAIR_PHRASES) {
      if (lower.includes(phrase.toLowerCase())) {
        const quote = value.length > 180 ? `${value.slice(0, 177)}...` : value
        out.push(`replacement_phrase: "${phrase}" at ${joined || '<root>'}: "${quote}"`)
      }
    }
    for (const [re, label] of CLIENT_ARTIFACT_PATTERNS) {
      if (re.test(value)) {
        const quote = value.length > 180 ? `${value.slice(0, 177)}...` : value
        out.push(`${label} at ${joined || '<root>'}: "${quote}"`)
      }
    }
    return out
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => out.push(...collectClientArtifacts(v, [...path, String(i)])))
    return out
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const childPath = [...path, k]
      const joined = childPath.join('.')
      if (!isRawPath(childPath, k) || joined.startsWith('ready_materials.json_ld')) {
        out.push(...collectClientArtifacts(v, childPath))
      }
    }
  }
  return out
}
