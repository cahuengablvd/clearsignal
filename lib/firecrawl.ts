import FirecrawlApp from '@mendable/firecrawl-js'

let _firecrawl: FirecrawlApp | null = null

function getFirecrawl() {
  if (!_firecrawl) {
    _firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! })
  }
  return _firecrawl
}

export async function scrapeUrl(url: string): Promise<string | null> {
  try {
    const result = await getFirecrawl().v1.scrapeUrl(url, { formats: ['markdown'] })
    if (result.success && result.markdown) {
      return result.markdown
    }
    return null
  } catch (err) {
    console.error(`Firecrawl scrape failed for ${url}:`, err)
    return null
  }
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
