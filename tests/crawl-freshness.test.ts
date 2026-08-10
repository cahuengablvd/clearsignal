import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ scrapeUrl: vi.fn() }))

vi.mock('@mendable/firecrawl-js', () => ({
  default: class FirecrawlApp {
    v1 = { scrapeUrl: mocks.scrapeUrl }
  },
}))

import { FRESH_SCRAPE_MAX_AGE_MS, scrapePage } from '../lib/firecrawl'
import { buildDataLimitations } from '../lib/audit-runner'

describe('audit crawl freshness', () => {
  it('requests a fresh Firecrawl page and retains cache metadata', async () => {
    mocks.scrapeUrl.mockResolvedValue({
      success: true,
      markdown: '# Example',
      rawHtml: '<html></html>',
      metadata: {
        cacheState: 'hit',
        cachedAt: '2026-08-10T17:16:00.000Z',
      },
    })

    const page = await scrapePage('https://example.com')

    expect(mocks.scrapeUrl).toHaveBeenCalledWith('https://example.com', {
      formats: ['markdown', 'rawHtml'],
      maxAge: FRESH_SCRAPE_MAX_AGE_MS,
    })
    expect(page).toMatchObject({
      cacheState: 'hit',
      cachedAt: '2026-08-10T17:16:00.000Z',
    })
  })

  it('discloses a cached target capture but not a cache miss', () => {
    const hit = buildDataLimitations(null, false, {
      cacheState: 'hit',
      cachedAt: '2026-08-10T17:16:00.000Z',
    })
    const miss = buildDataLimitations(null, false, { cacheState: 'miss' })

    expect(hit).toContain(
      'Crawl-derived findings were served from a cached Firecrawl capture dated 2026-08-10T17:16:00.000Z; they reflect that captured snapshot rather than a fresh fetch.'
    )
    // toContain compares array members by strict equality and silently ignores
    // asymmetric matchers, so assert over the joined text instead.
    expect(miss.join('\n')).not.toMatch(/cached Firecrawl capture/i)
  })
})
