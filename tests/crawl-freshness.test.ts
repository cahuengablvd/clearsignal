import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ scrapeUrl: vi.fn() }))

vi.mock('@mendable/firecrawl-js', () => ({
  default: class FirecrawlApp {
    v1 = { scrapeUrl: mocks.scrapeUrl }
  },
}))

import { FRESH_SCRAPE_MAX_AGE_MS, scrapePage, TargetCrawlError, TARGET_SCRAPE_RETRY_TIMEOUT_MS, TARGET_SCRAPE_TIMEOUT_MS } from '../lib/firecrawl'
import { buildDataLimitations } from '../lib/audit-runner'

describe('audit crawl freshness', () => {
  beforeEach(() => {
    mocks.scrapeUrl.mockReset()
  })

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
      timeout: TARGET_SCRAPE_TIMEOUT_MS,
    })
    expect(page).toMatchObject({
      cacheState: 'hit',
      cachedAt: '2026-08-10T17:16:00.000Z',
    })
  })

  it('keeps a normal target scrape to one full-fidelity request', async () => {
    mocks.scrapeUrl.mockResolvedValueOnce({ success: true, markdown: '# Example', rawHtml: '<html></html>' })

    await scrapePage('https://example.com')

    expect(mocks.scrapeUrl).toHaveBeenCalledTimes(1)
  })

  it('retries a Firecrawl 408 once with the same evidence formats and bounded timeout', async () => {
    mocks.scrapeUrl
      .mockRejectedValueOnce({ statusCode: 408, message: 'SCRAPE_TIMEOUT' })
      .mockResolvedValueOnce({ success: true, markdown: '# Final', rawHtml: '<html><head></head><body>Final</body></html>', metadata: { sourceURL: 'https://example.com/final' } })

    const page = await scrapePage('https://example.com')

    expect(mocks.scrapeUrl).toHaveBeenNthCalledWith(1, 'https://example.com', {
      formats: ['markdown', 'rawHtml'], maxAge: FRESH_SCRAPE_MAX_AGE_MS, timeout: TARGET_SCRAPE_TIMEOUT_MS,
    })
    expect(mocks.scrapeUrl).toHaveBeenNthCalledWith(2, 'https://example.com', {
      formats: ['markdown', 'rawHtml'], maxAge: FRESH_SCRAPE_MAX_AGE_MS, timeout: TARGET_SCRAPE_RETRY_TIMEOUT_MS,
    })
    expect(page).toMatchObject({ markdown: '# Final', html: expect.stringContaining('<head>'), finalUrl: 'https://example.com/final' })
  })

  it('throws a deterministic target-crawl failure retaining the Firecrawl timeout after the bounded retry also fails', async () => {
    mocks.scrapeUrl
      .mockRejectedValueOnce({ status: 408, message: 'SCRAPE_TIMEOUT' })
      .mockRejectedValueOnce({ status: 408, message: 'SCRAPE_TIMEOUT' })

    await expect(scrapePage('https://example.com')).rejects.toMatchObject({
      name: 'TargetCrawlError',
      message: expect.stringContaining('HTTP 408'),
      attempts: 2,
    })
    expect(mocks.scrapeUrl).toHaveBeenCalledTimes(2)
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
