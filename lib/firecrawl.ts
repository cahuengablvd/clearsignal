import FirecrawlApp from '@mendable/firecrawl-js'

let _firecrawl: FirecrawlApp | null = null

// Audits are sold as point-in-time evidence, so they must not silently reuse
// Firecrawl's stored page copy. Keep this explicit at every scrape call.
export const FRESH_SCRAPE_MAX_AGE_MS = 0
// Firecrawl documents 60 seconds as the scrape default. State it explicitly
// for the normal path, then give a single 408 retry a larger, still bounded
// window without dropping raw HTML required by deterministic checks.
export const TARGET_SCRAPE_TIMEOUT_MS = 60_000
export const TARGET_SCRAPE_RETRY_TIMEOUT_MS = 120_000

export type ScrapedPage = {
  markdown: string
  html: string
  cacheState?: 'hit' | 'miss'
  cachedAt?: string
  finalUrl?: string
  attempts: number
}

export class TargetCrawlError extends Error {
  readonly attempts = 2

  constructor(url: string, cause: unknown) {
    const status = firecrawlStatus(cause)
    const detail = cause instanceof Error ? cause.message : String(cause)
    super(`Firecrawl target crawl exhausted its bounded retry for ${url}${status ? ` (HTTP ${status})` : ''}: ${detail}`)
    this.name = 'TargetCrawlError'
  }
}

function firecrawlStatus(err: unknown): number | undefined {
  const candidate = err as { statusCode?: unknown; status?: unknown; response?: { status?: unknown } }
  const status = candidate.statusCode ?? candidate.status ?? candidate.response?.status
  return typeof status === 'number' ? status : undefined
}

function pageFromResult(result: any, attempts: number): ScrapedPage | null {
  if (!result.success || !result.markdown) return null
  return {
    markdown: result.markdown,
    html: result.rawHtml || result.html || '',
    cacheState: result.metadata?.cacheState,
    cachedAt: result.metadata?.cachedAt,
    finalUrl: result.metadata?.sourceURL || result.metadata?.sourceUrl || result.metadata?.url,
    attempts,
  }
}

function getFirecrawl() {
  if (!_firecrawl) {
    _firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! })
  }
  return _firecrawl
}

export async function scrapeUrl(
  url: string,
  options: { allowHttpFallback?: boolean } = {}
): Promise<string | null> {
  try {
    const result = await getFirecrawl().v1.scrapeUrl(url, {
      formats: ['markdown'],
      maxAge: FRESH_SCRAPE_MAX_AGE_MS,
    })
    if (result.success && result.markdown) {
      return result.markdown
    }
  } catch (err) {
    console.error(`Firecrawl scrape failed for ${url}:`, err)
  }

  // Bare inputs default to HTTPS. Retry HTTP only when the caller records that
  // the user omitted the scheme; an explicitly typed HTTPS URL is never downgraded.
  if (options.allowHttpFallback && url.startsWith('https://')) {
    const fallbackUrl = `http://${url.slice('https://'.length)}`
    try {
      const result = await getFirecrawl().v1.scrapeUrl(fallbackUrl, {
        formats: ['markdown'],
        maxAge: FRESH_SCRAPE_MAX_AGE_MS,
      })
      if (result.success && result.markdown) return result.markdown
    } catch (err) {
      console.error(`Firecrawl HTTP fallback failed for ${fallbackUrl}:`, err)
    }
  }

  return null
}

/**
 * Scrape markdown plus the raw document HTML. Firecrawl's `html` format is
 * cleaned main content and intentionally omits <head>; rawHtml is required
 * for head-level Trust Layer checks such as meta, JSON-LD and canonical tags.
 */
export async function scrapePage(url: string): Promise<ScrapedPage | null> {
  try {
    const result = await getFirecrawl().v1.scrapeUrl(url, {
      formats: ['markdown', 'rawHtml'],
      maxAge: FRESH_SCRAPE_MAX_AGE_MS,
      timeout: TARGET_SCRAPE_TIMEOUT_MS,
    })
    return pageFromResult(result, 1)
  } catch (err) {
    console.error(`Firecrawl scrape failed for ${url}:`, err)
    if (firecrawlStatus(err) !== 408) return null

    console.warn(`Firecrawl target scrape timed out for ${url}; retrying once with ${TARGET_SCRAPE_RETRY_TIMEOUT_MS}ms timeout and full evidence formats.`)
    try {
      const result = await getFirecrawl().v1.scrapeUrl(url, {
        formats: ['markdown', 'rawHtml'],
        maxAge: FRESH_SCRAPE_MAX_AGE_MS,
        timeout: TARGET_SCRAPE_RETRY_TIMEOUT_MS,
      })
      return pageFromResult(result, 2)
    } catch (retryError) {
      console.error(`Firecrawl target retry failed for ${url}:`, retryError)
      throw new TargetCrawlError(url, retryError)
    }
  }
}
