/**
 * Normalize a public website URL without changing path/query casing.
 *
 * Bare domains intentionally default to HTTPS. This can fail for the rare
 * HTTP-only site; callers that know the user omitted the scheme may retry the
 * scrape once over HTTP, but must never downgrade an explicitly supplied URL.
 */
export function normalizeWebsiteUrl(raw: string): string | null {
  const compact = raw.trim().replace(/\s+/g, '')
  if (!compact) return null

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(compact)
  if (!hasScheme && /^[a-z][a-z0-9+.-]*:/i.test(compact)) return null
  const candidate = hasScheme ? compact : `https://${compact}`

  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null

    const hostname = parsed.hostname.toLowerCase()
    if (
      !hostname.includes('.') ||
      hostname.endsWith('.') ||
      hostname.startsWith('[') ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
    ) {
      return null
    }

    const labels = hostname.split('.')
    if (labels.some((label) => !label || label.startsWith('-') || label.endsWith('-'))) {
      return null
    }

    parsed.hostname = hostname
    return parsed.toString()
  } catch {
    return null
  }
}
