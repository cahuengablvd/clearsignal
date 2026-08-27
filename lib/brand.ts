/**
 * Brand / entity normalization.
 *
 * The report must present ONE brand entity instead of mixing the domain-derived
 * label (e.g. "Blvdprod"), the registrable domain ("blvdprod.com"), and the real
 * company name found on the page ("BLVD Production"). This resolves a canonical
 * brand from the rendered page (JSON-LD, og:site_name, <title>, <h1>) and keeps
 * the domain-derived label as an alternative form.
 *
 * Pure + deterministic: no LLM, fully unit-testable.
 */
import { registrableDomain, sld } from './geo/detect'

export type BrandEntity = {
  canonical_brand: string
  domain: string
  alternative_brand_forms: string[]
}

/**
 * Clean the operator's semicolon-separated names without guessing whether they
 * belong to the business. That judgement belongs to the operator and review
 * gate, not the domain-stem heuristic used for page-derived candidates.
 */
export function parseBrandAliases(value: string | null | undefined): string[] {
  const seen = new Set<string>()
  const aliases: string[] = []
  for (const raw of (value || '').split(';')) {
    const alias = raw.trim()
    // Case- and punctuation-insensitive de-duplication, while preserving the
    // operator's spelling for the report header.
    const key = alias.toLocaleLowerCase().replace(/[\s\p{P}\p{S}_]+/gu, '')
    if (!key || seen.has(key)) continue
    seen.add(key)
    aliases.push(alias)
  }
  return aliases
}

/** Merge confirmed operator aliases ahead of heuristic page-derived forms. */
export function mergeBrandAliases(entity: BrandEntity, operatorAliases?: string): BrandEntity {
  const canonicalKey = normalizeToken(entity.canonical_brand)
  const alternatives = new Map<string, string>()
  const add = (value: string) => {
    const key = value.toLocaleLowerCase().replace(/[\s\p{P}\p{S}_]+/gu, '')
    if (!key || key === canonicalKey || alternatives.has(key)) return
    alternatives.set(key, value)
  }
  // Operator input wins spelling/order when it duplicates a page heuristic.
  for (const alias of parseBrandAliases(operatorAliases)) add(alias)
  for (const alias of entity.alternative_brand_forms) add(alias)
  return { ...entity, alternative_brand_forms: [...alternatives.values()] }
}

function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/** Lowercased, alphanumeric-only form for comparing two brand strings. */
function normalizeToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function firstCapture(re: RegExp, html: string): string | null {
  const m = re.exec(html)
  return m && m[1] ? m[1].trim() : null
}

function clean(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Brand-name candidates pulled from the rendered HTML, best signals first. */
function brandCandidates(html: string): string[] {
  const out: string[] = []
  if (!html) return out

  // 1. JSON-LD Organization / WebSite / LocalBusiness name (strongest signal).
  const ldBlocks =
    html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || []
  for (const block of ldBlocks) {
    const json = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim()
    try {
      const data = JSON.parse(json)
      const nodes: unknown[] = Array.isArray(data)
        ? data
        : Array.isArray((data as Record<string, unknown>)['@graph'])
          ? ((data as Record<string, unknown>)['@graph'] as unknown[])
          : [data]
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue
        const n = node as Record<string, unknown>
        if (typeof n.name !== 'string') continue
        const types = (Array.isArray(n['@type']) ? n['@type'] : [n['@type']]).map(String)
        if (types.some((t) => /Organization|WebSite|LocalBusiness|Corporation|Brand/i.test(t))) {
          out.push(n.name)
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }

  // 2. og:site_name / application-name meta.
  const og =
    firstCapture(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i, html) ||
    firstCapture(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i, html)
  if (og) out.push(og)
  const appName = firstCapture(
    /<meta[^>]+name=["']application-name["'][^>]+content=["']([^"']+)["']/i,
    html
  )
  if (appName) out.push(appName)

  // 3. <title> split on common separators (brand is usually one segment).
  const title = firstCapture(/<title[^>]*>([\s\S]*?)<\/title>/i, html)
  if (title) {
    for (const seg of clean(title).split(/\s*[|\u2013\u2014\-:\u00b7]\s*/)) {
      if (seg.trim()) out.push(seg.trim())
    }
  }

  // 4. First <h1>.
  const h1 = firstCapture(/<h1[^>]*>([\s\S]*?)<\/h1>/i, html)
  if (h1) out.push(clean(h1))

  return out.map(clean).filter(Boolean)
}

/**
 * Resolve the brand entity from the URL and (optionally) the rendered page.
 * Prefers a real brand name from the page that is related to the domain; falls
 * back to the title-cased domain label.
 */
export function resolveBrandEntity(input: {
  url: string
  html?: string
  markdown?: string
}): BrandEntity {
  const domain = registrableDomain(input.url) || ''
  const sldToken = sld(input.url) || '' // "blvdprod"
  const domainForm = titleCase(sldToken) // "Blvdprod"

  // A candidate is "related" if its normalized form shares a stem with the
  // domain token. This keeps real brand names ("BLVD Production") and drops
  // unrelated taglines ("Explainer Video Company").
  const isRelated = (candidate: string): boolean => {
    const n = normalizeToken(candidate)
    if (!n || n.length < 2) return false
    if (!sldToken) return true
    return (
      n.includes(sldToken) ||
      sldToken.includes(n) ||
      n.startsWith(sldToken) ||
      sldToken.startsWith(n)
    )
  }

  const candidates = brandCandidates(input.html || '').filter(isRelated)

  // Prefer a multi-word related candidate (real company name) over the bare
  // domain label; then any related candidate; then the domain label.
  const canonical =
    candidates.find((c) => /\s/.test(c)) || candidates[0] || domainForm || domain

  // Alternative forms: the domain label plus any other related candidate that
  // differs from the canonical brand (case/spacing-insensitive), de-duplicated.
  const canonicalKey = normalizeToken(canonical)
  const alts = new Map<string, string>()
  const addAlt = (s: string) => {
    const key = normalizeToken(s)
    if (!key || key === canonicalKey || alts.has(key)) return
    alts.set(key, s)
  }
  addAlt(domainForm)
  for (const c of candidates) addAlt(c)

  return {
    canonical_brand: (canonical || '').trim(),
    domain,
    alternative_brand_forms: Array.from(alts.values()),
  }
}
