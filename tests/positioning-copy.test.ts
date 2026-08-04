import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function source(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

describe('recommendation-led positioning copy', () => {
  it('explains the evidence chain without mixing category vocabularies on a surface', () => {
    const home = source('app/page.tsx')

    expect(home).toContain(
      'ClearSignal tests real buyer questions across ChatGPT, Claude and Perplexity, shows which brands appear in the tested answers, and compares the cited sources and website evidence surrounding those results. Every full report is reviewed by a person before delivery.'
    )
    expect(home).toContain(
      'SEO helps pages become discoverable in search. ClearSignal examines a different, complementary question:'
    )
    expect(home).toContain(
      'ClearSignal diagnoses the AI visibility and evidence problem; your agency owns the implementation.'
    )
    expect(home).not.toContain('White-label and multi-client workflows')

    for (const path of [
      'app/page.tsx',
      'app/layout.tsx',
      'app/checkout/page.tsx',
      'app/score/[id]/page.tsx',
    ]) {
      const publicSurface = source(path)
      expect(publicSurface, path).not.toMatch(/recommendation visibility/i)
    }
  })
})
