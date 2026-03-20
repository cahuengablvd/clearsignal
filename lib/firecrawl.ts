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
