/**
 * Deterministic, evidence-backed structural findings (Trust Layer #3/#7).
 *
 * Each check inspects the BROWSER-RENDERED HTML (Firecrawl renders pages) and
 * returns a typed Finding whose confidence is computed from HOW it was
 * verified - never asked of an LLM. Confidence bands:
 *   95-100  exact element found in rendered HTML
 *   80-94   verifiable absence / single reliable method
 *   50-79   indirect signal or ambiguous classification
 *   <50     could not verify reliably -> manual_verification
 *
 * "Not found" never asserts "broken" - it downgrades to manual_verification so
 * a crawler limitation is not reported as a site defect.
 */
import type { Finding } from './schemas'

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n) + '...' : t
}

function firstMatch(re: RegExp, text: string): RegExpExecArray | null {
  re.lastIndex = 0
  return re.exec(text)
}

function attr(el: string, name: string): string {
  const m = new RegExp(`\\b${name}=["']([^"']*)["']`, 'i').exec(el)
  return m ? m[1].trim() : ''
}

function stripTags(fragment: string): string {
  return fragment
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function ctaLabel(el: string, inner = ''): string {
  return stripTags(inner) || attr(el, 'aria-label') || attr(el, 'title') || attr(el, 'value')
}

function hasActionableHref(el: string): boolean {
  const href = attr(el, 'href')
  if (!href) return false
  return !/^(?:#|javascript:void\(0\)|javascript:;?)$/i.test(href)
}

function isCtaText(text: string): boolean {
  return /\b(get started|sign up|start free|book a demo|book demo|request a demo|get a demo|try (?:it )?free|contact sales|get quote|get a quote|request quote|free quote|book now|schedule|call now)\b/i.test(
    text
  )
}

function findPrimaryCta(html: string): { match: string; label: string } | null {
  const candidates = [
    /<button\b[^>]*>([\s\S]*?)<\/button>/gi,
    /<input\b[^>]*type=["'](?:submit|button)["'][^>]*>/gi,
    /<a\b[^>]*class=["'][^"']*(?:btn|button|cta)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi,
    /<a\b[^>]*>([\s\S]*?)<\/a>/gi,
  ]
  for (const re of candidates) {
    let m: RegExpExecArray | null
    while ((m = re.exec(html))) {
      const el = m[0]
      const label = ctaLabel(el, m[1] || '')
      const isAnchor = /^<a\b/i.test(el)
      const isButton = /^<(?:button|input)\b/i.test(el)
      if (!label || !isCtaText(label)) continue
      if (isAnchor && !hasActionableHref(el)) continue
      if (isButton || isAnchor) return { match: el, label }
    }
  }
  return null
}

function findGraphicalCtaLike(html: string): RegExpExecArray | null {
  return firstMatch(/<(?:button|a)\b[^>]*>(?:\s*<svg\b[\s\S]*?<\/svg>\s*)+<\/(?:button|a)>/i, html)
}

/** Short, stable evidence-id slug per finding type (for OBS-* cross-references). */
const OBS_SLUG: Record<string, string> = {
  cta_present: 'CTA',
  h1_present: 'H1',
  json_ld: 'SCHEMA',
  meta_description: 'META',
  social_proof: 'PROOF',
  faq_structure: 'FAQ',
}

/** Stable evidence id for a technical finding, e.g. "OBS-CTA-001". */
export function obsIdForFinding(findingId: string): string {
  const slug = OBS_SLUG[findingId] || findingId.toUpperCase().replace(/[^A-Z0-9]+/g, '-')
  return `OBS-${slug}-001`
}

export function computeTechnicalFindings(input: {
  url: string
  html: string
  markdown: string
}): Finding[] {
  const { url, html, markdown } = input
  const hasCapturedHead = /<head\b[^>]*>/i.test(html)
  const checkedAt = new Date().toISOString()
  const findings: Finding[] = []
  const ev = (extracted?: string | null, snippet?: string | null) => ({
    url,
    checked_at: checkedAt,
    extracted_text: extracted ?? null,
    html_snippet: snippet ? clip(snippet, 220) : null,
  })

  // 1. Primary CTA -------------------------------------------------------------
  const primaryCtaMatch = findPrimaryCta(html)
  const contactLinkMatch = firstMatch(/<a\b[^>]*href=["'][^"']+["'][^>]*>\s*(contact us|contact)\s*<\/a>/i, html)
  const graphicalCtaLike = findGraphicalCtaLike(html)
  if (primaryCtaMatch) {
    findings.push({
      id: 'cta_present',
      label: 'Primary call-to-action',
      classification: 'detected',
      status: 'present',
      confidence: 96,
      confidence_basis: 'Matched an actionable CTA element with visible or accessible CTA text in the rendered HTML',
      detail: 'A primary CTA element is present.',
      evidence: ev(clip(primaryCtaMatch.label, 120), primaryCtaMatch.match),
    })
  } else if (graphicalCtaLike) {
    findings.push({
      id: 'cta_present',
      label: 'Primary call-to-action',
      classification: 'manual_verification',
      status: 'unknown',
      confidence: 45,
      confidence_basis: 'A graphical button/link was found, but no CTA text, href, submit behavior, or accessible label confirmed it as a primary CTA',
      detail: 'Graphical CTA-like element detected; verify manually whether it is an actionable primary CTA.',
      evidence: ev(null, graphicalCtaLike[0]),
    })
  } else if (contactLinkMatch) {
    findings.push({
      id: 'cta_present',
      label: 'Primary call-to-action',
      classification: 'manual_verification',
      status: 'unknown',
      confidence: 55,
      confidence_basis: 'A generic contact link was found, but no primary conversion CTA was confirmed in rendered HTML',
      detail: 'Contact link detected; verify whether a primary hero CTA is visible above the fold.',
      evidence: ev(clip(contactLinkMatch[1] || contactLinkMatch[0], 120), contactLinkMatch[0]),
    })
  } else {
    findings.push({
      id: 'cta_present',
      label: 'Primary call-to-action',
      classification: 'manual_verification',
      status: 'unknown',
      confidence: 40,
      confidence_basis: 'No <button> or CTA-styled link found in rendered HTML (may be an image or JS-rendered)',
      detail: 'Could not confirm a primary CTA from the HTML - verify manually.',
      evidence: ev(),
    })
  }

  // 2. H1 headline -------------------------------------------------------------
  const h1 = firstMatch(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i, html)
  if (h1) {
    const text = clip(h1[1].replace(/<[^>]+>/g, ' '), 160)
    findings.push({
      id: 'h1_present',
      label: 'Headline (H1)',
      classification: 'detected',
      status: 'present',
      confidence: 98,
      confidence_basis: 'Matched a single <h1> element in the rendered HTML',
      detail: text || 'An H1 headline is present.',
      evidence: ev(text, h1[0]),
    })
  } else {
    findings.push({
      id: 'h1_present',
      label: 'Headline (H1)',
      classification: 'manual_verification',
      status: 'unknown',
      confidence: 45,
      confidence_basis: 'No <h1> element found in rendered HTML',
      detail: 'No H1 detected - verify the page has a real headline element.',
      evidence: ev(),
    })
  }

  // 3. Structured data (JSON-LD) ----------------------------------------------
  const jsonLd = firstMatch(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i, html)
  if (jsonLd) {
    let types = ''
    try {
      const parsed = JSON.parse(jsonLd[1].trim())
      const arr = Array.isArray(parsed) ? parsed : [parsed]
      types = arr.map((p) => p && p['@type']).filter(Boolean).join(', ')
    } catch {
      /* keep types empty if JSON is malformed */
    }
    findings.push({
      id: 'json_ld',
      label: 'Structured data (schema.org JSON-LD)',
      classification: 'detected',
      status: 'present',
      confidence: 99,
      confidence_basis: 'Found an application/ld+json script in the rendered HTML',
      detail: types ? `JSON-LD present (@type: ${types}).` : 'JSON-LD structured data present.',
      evidence: ev(types || null, jsonLd[0]),
    })
  } else if (!hasCapturedHead) {
    findings.push({
      id: 'json_ld',
      label: 'Structured data (schema.org JSON-LD)',
      classification: 'manual_verification',
      status: 'unknown',
      confidence: 40,
      confidence_basis: 'The crawl did not capture a <head> element, so structured data could not be verified',
      detail: 'The document head was not captured; verify structured data manually.',
      evidence: ev(),
    })
  } else {
    findings.push({
      id: 'json_ld',
      label: 'Structured data (schema.org JSON-LD)',
      classification: 'detected',
      status: 'absent',
      confidence: 88,
      confidence_basis: 'No application/ld+json script present in the rendered HTML',
      detail: 'No JSON-LD structured data found - AI engines have fewer entity signals to cite.',
      evidence: ev(),
    })
  }

  // 4. Meta description --------------------------------------------------------
  const metaDesc =
    firstMatch(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i, html) ||
    firstMatch(/<meta\b[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i, html)
  if (metaDesc && metaDesc[1].trim()) {
    findings.push({
      id: 'meta_description',
      label: 'Meta description',
      classification: 'detected',
      status: 'present',
      confidence: 97,
      confidence_basis: 'Matched <meta name="description"> with content',
      detail: clip(metaDesc[1], 160),
      evidence: ev(clip(metaDesc[1], 160), metaDesc[0]),
    })
  } else if (!hasCapturedHead) {
    findings.push({
      id: 'meta_description',
      label: 'Meta description',
      classification: 'manual_verification',
      status: 'unknown',
      confidence: 40,
      confidence_basis: 'The crawl did not capture a <head> element, so the meta description could not be verified',
      detail: 'The document head was not captured; verify the meta description manually.',
      evidence: ev(),
    })
  } else {
    findings.push({
      id: 'meta_description',
      label: 'Meta description',
      classification: 'detected',
      status: 'absent',
      confidence: 85,
      confidence_basis: 'No non-empty <meta name="description"> in the rendered HTML',
      detail: 'No meta description found.',
      evidence: ev(),
    })
  }

  // 5. Social proof (indirect) -------------------------------------------------
  const proofRe = /trusted by|testimonial|case stud(?:y|ies)|customer logos?|rated|reviews?|\bg2\b|capterra/i
  if (proofRe.test(markdown) || proofRe.test(html)) {
    const m = firstMatch(proofRe, markdown) || firstMatch(proofRe, html)
    findings.push({
      id: 'social_proof',
      label: 'Social proof signals',
      classification: 'likely',
      status: 'present',
      confidence: 60,
      confidence_basis: 'Indirect keyword match (testimonials/logos/reviews) - not an exact element',
      detail: 'Some social-proof language is present; confirm it is real, named proof.',
      evidence: ev(m ? clip(m[0], 80) : null),
    })
  } else {
    findings.push({
      id: 'social_proof',
      label: 'Social proof signals',
      classification: 'manual_verification',
      status: 'unknown',
      confidence: 45,
      confidence_basis: 'No proof-related keywords found; visual logos may not be detectable from text',
      detail: 'No textual social-proof signals found - verify whether logos/testimonials exist as images.',
      evidence: ev(),
    })
  }

  // 6. FAQ / Q&A structure (indirect) -----------------------------------------
  const faqJsonLd = /"@type"\s*:\s*"FAQPage"|FAQPage/i
  const faqQuestionHeading = /<h[1-4][^>]*>[^<]*\?\s*<\/h[1-4]>/i
  const faqKeyword = /frequently asked questions|\bFAQ\b/i
  if (faqJsonLd.test(html) || faqQuestionHeading.test(html)) {
    findings.push({
      id: 'faq_structure',
      label: 'FAQ / Q&A structure',
      classification: 'detected',
      status: 'present',
      confidence: faqJsonLd.test(html) ? 92 : 84,
      confidence_basis: faqJsonLd.test(html)
        ? 'Matched FAQPage structured data in the rendered HTML'
        : 'Matched a question-style heading in the rendered HTML',
      detail: 'FAQ/Q&A structure was detected.',
      evidence: ev(),
    })
  } else if (faqKeyword.test(html) || faqKeyword.test(markdown)) {
    findings.push({
      id: 'faq_structure',
      label: 'FAQ / Q&A structure',
      classification: 'manual_verification',
      status: 'unknown',
      confidence: 55,
      confidence_basis: 'FAQ-like language was found, but no question-answer structure or FAQPage schema was confirmed',
      detail: 'Possible FAQ-like language detected - requires verification.',
      evidence: ev(),
    })
  } else {
    findings.push({
      id: 'faq_structure',
      label: 'FAQ / Q&A structure',
      classification: 'detected',
      status: 'absent',
      confidence: 80,
      confidence_basis: 'No FAQ heading or question-style headings found in the rendered HTML',
      detail: 'No FAQ/Q&A structure found - adding one helps AI engines quote direct answers.',
      evidence: ev(),
    })
  }

  return findings.map((f) => ({ ...f, evidence_id: obsIdForFinding(f.id) }))
}
