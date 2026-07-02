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
import { canClaimCredential, canClaimServiceAvailability } from './business-context'
import { buildJsonLd } from './materials'
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

// Known broken / leaked-internal strings -> clean client wording.
const BROKEN_STRINGS: Array<[RegExp, string]> = [
  [
    /eligible independent third-party source or eligible entity database entity creation/gi,
    'Wikipedia-style entity listings (pursue only once the brand has enough independent coverage to qualify)',
  ],
  [/eligible independent third-party source/gi, 'an independent third-party profile'],
  [/eligible entity database/gi, 'an entity database'],
  // "No AggregateRating markup" used to become "No valid review schema only if
  // first-party guidelines and source data support it markup".
  [/valid review schema only if first-party guidelines and source data support it/gi, 'review-rating'],
  // Broken commercial-claim fragments (the commercial sanitizer ran over text
  // that contained a domain or odd phrasing).
  [
    /\bexpecting an immediate pricing should be confirmed with the business\b/gi,
    'expecting an immediate response after pricing is confirmed with the business',
  ],
  [
    /\bmedium,\s*pricing should be confirmed with the business\b/gi,
    'medium priority; pricing should be confirmed with the business',
  ],
  [
    /\bno\s+([^.;!?]{1,80}?)\s+mentions were found among sources cited in the tested responses\.com\b/gi,
    'No $1 mentions were found among sources cited in the tested responses',
  ],
  [
    /\b([A-Z][A-Za-z0-9 .&-]{1,80})\s+were cited in of combinations\b/g,
    '$1 were cited in some tested combinations',
  ],
  [
    /\bstar score on homestars\b(?:\s*(?:based on reviews|from|based on)\b[^.?!]*)?/gi,
    'HomeStars Star Score',
  ],
  [
    /\bHomeStars rating details were not independently confirmed in this audit\b/gi,
    'HomeStars Star Score',
  ],
  [
    /\bno visible pricing should be confirmed with the business\b/gi,
    'No visible pricing was confirmed in the crawled content',
  ],
  [/\bpricing should be confirmed with the business\b/gi, 'Pricing was not confirmed in this audit.'],
  [/\binsurance details should be confirmed with the business\b/gi, 'Ask the team about insurance details for this move.'],
  [/\b(WSIB|CVOR) status\.\s*status\.\s*status should be confirmed with the business\b/gi, 'Ask the team about $1 status for this move.'],
  [/\bWSIB status should be confirmed with the business\b/gi, 'Ask the team about WSIB status for this move.'],
  [/\bCVOR status should be confirmed with the business\b/gi, 'Ask the team about CVOR status for this move.'],
  [/\bHomeStars details should be confirmed with the business\b/gi, 'Ask the team about third-party rating details for this move.'],
  [/\bpiano moving availability should be confirmed with the business\b/gi, 'Ask the team about piano-moving availability for this move.'],
  [/\bstorage availability should be confirmed with the business\b/gi, 'Ask the team about storage availability for this move.'],
  [/\blast-minute availability should be confirmed with the business\b/gi, 'Ask the team about last-minute availability for this move.'],
  [/\bsingle-item moving availability should be confirmed with the business\b/gi, 'Ask the team about single-item moving availability for this move.'],
  [/\bservice coverage outside the primary market should be confirmed with the business\b/gi, 'Ask the team about service coverage outside the primary market for this move.'],
  [
    /\bContact the business to confirm\s+([^.!?]{1,180}?)\s+before booking[.!?]?/gi,
    'Ask the team about $1 for this move.',
  ],
  [
    /\bContact the business to confirm\s+([^.!?]{1,180}?)[.!?]/gi,
    'Ask the team about $1.',
  ],
  [
    /\bcustomer referral rate\b(?!\s+was not independently confirmed)(?:\s*(?:from|based on|of)\b[^.?!]*)?/gi,
    'Customer referral rate was not independently confirmed in this audit',
  ],
  // "...confirmed with the business.lv is absent..." (greedy match crossed a domain dot)
  [/(confirmed with the business)\.[a-z]{2,4}\b[^.?!]*[.?!]?/gi, '$1.'],
  // "whether Contact the business to confirm availability..." (capitalized verb mid-sentence)
  [
    /\b(whether|if|that)\s+Contact the business to confirm availability(?:\s+for specific items)?/gi,
    '$1 availability for specific items should be confirmed with the business',
  ],
  // Duplicated phrases from a non-idempotent pass.
  [/\bauthenticity or authenticity\b/gi, 'authenticity'],
  [/(should be confirmed with the business)(?:\s+\1)+/gi, '$1'],
  [/(to confirm availability for specific items)(?:\s+\1)+/gi, '$1'],
]

// Clipped role labels that may end up in stored data.
const CLIPPED_ROLE: Record<string, string> = {
  Develope: 'Developer',
  Develop: 'Developer',
  Copy: 'Copywriter',
  Copywrite: 'Copywriter',
  Foun: 'Founder / marketing',
}

const NO_DIRECT_EVIDENCE = 'Based on audit synthesis; no single direct evidence item.'

const CLIENT_ARTIFACTS: Array<[RegExp, string]> = [
  [/\btested responses\.com\b/i, 'stray .com appended to prose'],
  [/\b(?:from|based on reviews|based on|score|rate)\s*[.?!]$/i, 'dangling unfinished metric phrase'],
  [/\b(?:confidence|score|rate|reviews?)\s*[:=]?\s*%/i, 'missing numeric value before percent'],
  [/\[[^\]]{1,160}\]/i, 'bracketed placeholder or internal instruction'],
  [/\bbefore publishing this wording\b/i, 'internal publishability instruction leaked into prose'],
  [/\b(?:Develope|Copywrite|Impleme)\b/i, 'clipped role label'],
  [/(should be confirmed with the business)(?:\s+\1)+/i, 'repeated safe commercial phrase'],
  [/Contact the business to confirm\s+Contact the business to confirm/i, 'repeated contact-confirmation phrase'],
  [/\bContact the business to confirm\b/i, 'operator-confirmation instruction leaked into client copy'],
  [/\bbefore booking\b/i, 'booking-time verification instruction leaked into client copy'],
  [/[\u0432][\u0402][\u201c\u201d]/i, 'mojibake dash leaked into client copy'],
  [/\b(status|details)\.\s*\1\.\s*\1\b/i, 'repeated status/details fragment'],
  [/\bshould be confirmed with the business\b/i, 'internal commercial policy phrase leaked into prose'],
  [/\bvalid review schema only if first-party guidelines\b/i, 'internal review-schema policy leaked into prose'],
]

/** Deep clone via JSON round-trip (report is always JSON-serializable). */
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] || 'details'
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function unsupportedMovingClaims(sentence: string, ctx?: BusinessContext): string[] {
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

function isRecommendationSentence(sentence: string): boolean {
  return /^\s*(?:add|display|include|show|list|render|surface|publish|create|claim|optimi[sz]e|mark up|ensure|use|verify|confirm|consider|do not|avoid|keep|replace|rewrite|build|develop|seek|pursue)\b/i.test(sentence)
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
      if (isRecommendationSentence(part)) return part
      const claims = unsupportedMovingClaims(part, ctx)
      if (claims.length === 0) return part
      return `Ask the team about ${joinList(claims)} for this move.`
    })
    .join('')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function cleanupClientPhrasing(text: string): string {
  return normalizeEncodingArtifacts(text)
    .replace(/Contact the business to confirm\s+Contact the business to confirm/gi, 'Confirm')
    .replace(/\b(status|details)\.\s*\1\.\s*\1\b/gi, '$1')
    .replace(/\bConfirm [^.?!]+ before publishing this wording[.?!]?/gi, '')
    .replace(/\bContact the business to confirm\s+([^.!?]{1,180}?)\s+before booking[.!?]?/gi, 'Ask the team about $1 for this move.')
    .replace(/\bContact the business to confirm\s+([^.!?]{1,180}?)[.!?]/gi, 'Ask the team about $1.')
    .replace(/\b([^.!?]{1,140}?)\s+should be confirmed with the business\b/gi, 'Ask the team about $1')
    .replace(/\bcontact the team before booking\b/gi, 'ask the team for details')
    .replace(/\bbefore booking\b/gi, 'for this move')
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
    for (const [re, replacement] of BROKEN_STRINGS) {
      const next = out.replace(re, replacement)
      if (next !== out) {
        warn('text: repaired broken internal phrasing')
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
        for (const [re, replacement] of BROKEN_STRINGS) {
          out = out.replace(re, replacement)
        }
      }
      const claimSafe = repairUnsupportedMovingClaimSentences(out, businessContext)
      if (claimSafe !== out) {
        warn('commercial_claim: replaced an unsupported moving claim at sentence level')
        out = claimSafe
      }
    }
    out = cleanupClientPhrasing(out)

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
  validateGeoCounts(walked, errors)

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
  const rebuilt = buildJsonLd(brand, url, report.ready_materials.faq || [])
  if (rebuilt !== report.ready_materials.json_ld) {
    report.ready_materials.json_ld = rebuilt
    warn('ready_materials: rebuilt JSON-LD from sanitized FAQ copy')
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
    for (const [re, label] of CLIENT_ARTIFACTS) {
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
