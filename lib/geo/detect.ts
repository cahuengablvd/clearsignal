/**
 * Deterministic brand / competitor detection over answer-engine responses.
 *
 * This is the credibility core of ClearSignal: whether a brand is mentioned or
 * cited is decided by string/domain matching against the raw engine output, NOT
 * by an LLM's judgement. The LLM only explains gaps and writes recommendations
 * downstream. Everything here is reproducible from the saved evidence.
 */

/** Registrable-ish domain: strip protocol, path, www, and any subdomain. */
export function registrableDomain(input: string): string {
  let host = input.trim().toLowerCase()
  try {
    if (host.includes('://')) host = new URL(host).hostname
    else if (host.includes('/')) host = new URL('https://' + host).hostname
  } catch {
    // fall through with raw string
  }
  host = host.replace(/^www\./, '')
  const parts = host.split('.')
  if (parts.length > 2) {
    // Keep last two labels (good enough for .com/.io/.ai; misses some ccTLDs).
    return parts.slice(-2).join('.')
  }
  return host
}

/** Second-level label, e.g. "acme" from "acme.com" or a bare name. */
export function sld(input: string): string {
  const dom = registrableDomain(input)
  return dom.split('.')[0]
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function addToken(tokens: Set<string>, value: string | null | undefined): void {
  const v = (value || '').trim().toLowerCase()
  if (v) tokens.add(v)
}

function addCompoundAliases(tokens: Set<string>, value: string): void {
  const raw = value.trim().toLowerCase()
  if (!raw) return

  const normalized = raw.replace(/[_\s]+/g, '-').replace(/-+/g, '-')
  const parts = normalized.split('-').filter(Boolean)
  if (parts.length >= 2) {
    addToken(tokens, parts.join(' '))
    addToken(tokens, parts.join('-'))
    addToken(tokens, parts.join(''))
    if (parts[0].length === 2) {
      addToken(tokens, `${parts[0][0]}-${parts[0][1]} ${parts.slice(1).join(' ')}`)
      addToken(tokens, `${parts[0][0]}-${parts[0][1]}-${parts.slice(1).join('-')}`)
    }
    if (parts.length === 2 && parts[1].length > 1) {
      addToken(tokens, `${parts[0]}-${parts[1][0]} ${parts[1].slice(1)}`)
      addToken(tokens, `${parts[0]} ${parts[1][0]}-${parts[1].slice(1)}`)
    }
  }

  const camelish = raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([a-z]+)(riga|moving|production|studio|atelier|gallery)$/i, '$1 $2')
    .toLowerCase()
    .trim()
  const camelParts = camelish.split(/\s+/).filter(Boolean)
  if (camelParts.length >= 2 && camelish !== raw) {
    addToken(tokens, camelParts.join(' '))
    addToken(tokens, camelParts.join('-'))
    addToken(tokens, camelParts.join(''))
  }
}

/**
 * Lowercase match variants for a brand or competitor identified by a name
 * and/or URL. Returns both a domain string (for citation matching) and a set
 * of word-ish tokens (for answer-text matching).
 */
export function buildVariants(opts: { name?: string; url?: string }): {
  domain: string | null
  tokens: string[]
} {
  const tokens = new Set<string>()
  let domain: string | null = null

  if (opts.url) {
    domain = registrableDomain(opts.url)
    addToken(tokens, domain)
    addToken(tokens, sld(opts.url))
    addCompoundAliases(tokens, sld(opts.url))
  }
  if (opts.name) {
    const n = opts.name.trim().toLowerCase()
    if (n) {
      addToken(tokens, n)
      addCompoundAliases(tokens, opts.name)
      // If the name looks like a domain, also add its SLD.
      if (n.includes('.')) {
        addToken(tokens, sld(n))
        addCompoundAliases(tokens, sld(n))
        if (!domain) domain = registrableDomain(n)
      }
    }
  }
  // Drop empties and very short tokens that would over-match.
  const cleaned = [...tokens].filter((t) => t && t.length >= 2)
  return { domain, tokens: cleaned }
}

/** True if any token appears as a whole word (or exact domain) in text. */
export function textMentions(text: string, tokens: string[]): boolean {
  return firstMentionIndex(text, tokens) >= 0
}

/** Index of the earliest token occurrence in text, or -1 if none. */
export function firstMentionIndex(text: string, tokens: string[]): number {
  const lower = text.toLowerCase()
  let best = -1
  for (const t of tokens) {
    // Word-boundary-ish: domains contain dots/hyphens, so use lookarounds on
    // alphanumerics rather than \b (which treats '.' as a boundary).
    const re = new RegExp(`(?<![a-z0-9])${escapeRegex(t)}(?![a-z0-9])`, 'i')
    const m = re.exec(lower)
    if (m && (best === -1 || m.index < best)) best = m.index
  }
  return best
}

/** True if any citation URL is on the given registrable domain. */
export function citationsInclude(citations: string[], domain: string | null): boolean {
  if (!domain) return false
  return citations.some((c) => registrableDomain(c) === domain)
}

/** Distinct registrable domains across citations (hostnames only). */
export function citedDomains(citations: string[]): string[] {
  const seen = new Set<string>()
  for (const c of citations) {
    const d = registrableDomain(c)
    if (d) seen.add(d)
  }
  return [...seen]
}
