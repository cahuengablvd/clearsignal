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

export function computeTechnicalFindings(input: {
  url: string
  html: string
  markdown: string
}): Finding[] {
  const { url, html, markdown } = input
  const checkedAt = new Date().toISOString()
  const findings: Finding[] = []
  const ev = (extracted?: string | null, snippet?: string | null) => ({
    url,
    checked_at: checkedAt,
    extracted_text: extracted ?? null,
    html_snippet: snippet ? clip(snippet, 220) : null,
  })

  // 1. Primary CTA -------------------------------------------------------------
  const ctaMatch =
    firstMatch(/<button\b[^>]*>([\s\S]*?)<\/button>/i, html) ||
    firstMatch(/<a\b[^>]*class=["'][^"']*(?:btn|button|cta)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i, html) ||
    firstMatch(/<a\b[^>]*>\s*(get started|sign up|start free|book a demo|book demo|request a demo|get a demo|try (?:it )?free|contact sales)\s*<\/a>/i, html)
  if (ctaMatch) {
    findings.push({
      id: 'cta_present',
      label: 'Primary call-to-action',
      classification: 'detected',
      status: 'present',
      confidence: 96,
      confidence_basis: 'Matched a button/CTA element in the rendered HTML',
      detail: 'A primary CTA element is present.',
      evidence: ev(clip(ctaMatch[1] || ctaMatch[0], 120), ctaMatch[0]),
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
  const faqRe = /frequently asked questions|<h[1-4][^>]*>[^<]*\?\s*<\/h[1-4]>|\bFAQ\b/i
  if (faqRe.test(html) || /frequently asked questions|\bFAQ\b/i.test(markdown)) {
    findings.push({
      id: 'faq_structure',
      label: 'FAQ / Q&A structure',
      classification: 'likely',
      status: 'present',
      confidence: 62,
      confidence_basis: 'Indirect match for FAQ heading/question structure',
      detail: 'FAQ-style content appears present; good for answer-engine citation.',
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

  return findings
}
