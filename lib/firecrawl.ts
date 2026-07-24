import FirecrawlApp from '@mendable/firecrawl-js'

let _firecrawl: FirecrawlApp | null = null

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
    const result = await getFirecrawl().v1.scrapeUrl(url, { formats: ['markdown'] })
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
      const result = await getFirecrawl().v1.scrapeUrl(fallbackUrl, { formats: ['markdown'] })
      if (result.success && result.markdown) return result.markdown
    } catch (err) {
      console.error(`Firecrawl HTTP fallback failed for ${fallbackUrl}:`, err)
    }
  }

  return null
}

/**
 * Scrape both markdown and rendered HTML. The HTML (browser-rendered by
 * Firecrawl) lets the Trust Layer verify structural signals deterministically.
 */
export async function scrapePage(url: string): Promise<{ markdown: string; html: string } | null> {
  try {
    const result = await getFirecrawl().v1.scrapeUrl(url, { formats: ['markdown', 'html'] })
    if (result.success && result.markdown) {
      return { markdown: result.markdown, html: result.html || '' }
    }
    return null
  } catch (err) {
    console.error(`Firecrawl scrape failed for ${url}:`, err)
    return null
  }
}
