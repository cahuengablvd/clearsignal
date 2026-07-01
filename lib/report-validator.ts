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
    /\bstar score on homestars\b(?:\s*(?:based on reviews|from|based on)\b[^.?!]*)?/gi,
    'HomeStars rating details were not independently confirmed in this audit',
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

/** Deep clone via JSON round-trip (report is always JSON-serializable). */
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
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
    if ((key === 'owner' || key === 'implementer' || key === 'role') && CLIPPED_ROLE[out]) {
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
        .replace(/\bthe core reason is\b/gi, 'likely contributing factors include')
        .replace(/\bthis absence is caused by\b/gi, 'this observed absence may be associated with')
        .replace(/\bai skips you because\b/gi, 'potential factors limiting AI visibility include')
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

    const commercialSafe = sanitizeUnsupportedCommercialClaims(out, businessContext)
    if (commercialSafe !== out) {
      warn('commercial_claim: softened an unsupported commercial claim')
      out = commercialSafe
    }

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

  return { report: walked, warnings, errors }
}

type Repair = (text: string, path: string[]) => string

/** Recursively apply a repair to every human-facing string, skipping raw fields. */
function mapProse(value: unknown, repair: Repair, path: string[] = []): unknown {
  if (typeof value === 'string') {
    const key = path[path.length - 1]
    return isRawPath(path, key) ? value : repair(value, path)
  }
  if (Array.isArray(value)) {
    return value.map((v, i) => mapProse(v, repair, [...path, String(i)]))
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = isRawPath([...path, k], k) ? v : mapProse(v, repair, [...path, k])
    }
    return out
  }
  return value
}
