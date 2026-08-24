import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('scrape-quality runner guard contract', () => {
  it('guards the free score before clarity and GEO calls', () => {
    const code = source('lib/score-runner.ts')
    const guard = code.indexOf('requireUsableScrape(markdown)')
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(code.indexOf('callClaudeJSON<ClearSignalScore>'))
    expect(guard).toBeLessThan(code.indexOf('runGeoScan({'))
  })

  it('guards the paid audit before findings, competitors, GEO, or Claude stages', () => {
    const code = source('lib/audit-runner.ts')
    const guard = code.indexOf('requireUsableScrape(targetMarkdown)')
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(code.indexOf('computeTechnicalFindings({'))
    expect(guard).toBeLessThan(code.indexOf('for (const compUrl of competitorUrls)'))
    expect(guard).toBeLessThan(code.indexOf("'geo_scan'"))
  })

  it('stops an admin preview challenge before generating buyer queries', () => {
    const code = source('app/api/admin/audits/preview/route.ts')
    const guard = code.indexOf('assessScrapeQuality(category)')
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(code.indexOf('generateValidatedQueryPlan({'))
    expect(code).toContain("scrapeQuality.kind !== 'substantive'")
  })
})
