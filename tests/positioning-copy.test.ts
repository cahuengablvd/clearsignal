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
      'ClearSignal tests real buyer questions across ChatGPT, Claude and Perplexity, shows which brands appear in the tested answers, and compares the cited sources and website evidence surrounding those results. A person reviews the evidence, factual claims and recommendations before each full report is sent.'
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

describe('public review wording', () => {
  it('does not restore expert-review language or the founder name to public copy', () => {
    for (const path of [
      'app/page.tsx',
      'app/sample/page.tsx',
      'app/score/[id]/score-pdf-view.tsx',
      'app/audit/[id]/page.tsx',
      'lib/audit-label.ts',
      'lib/resend.ts',
    ]) {
      expect(source(path), path).not.toMatch(/expert-review|expert review|expert hypothesis|Kalinko/i)
    }
  })
})

describe('public canonical URLs', () => {
  it('declares self-referencing canonicals for public pages without adding them to private reports', () => {
    const canonicals = {
      '/': source('app/layout.tsx'),
      '/sample': source('app/sample/page.tsx'),
      '/score': source('app/score/layout.tsx'),
      '/checkout': source('app/checkout/layout.tsx'),
      '/terms': source('app/terms/page.tsx'),
      '/privacy': source('app/privacy/page.tsx'),
      '/refund': source('app/refund/page.tsx'),
    }

    for (const [route, page] of Object.entries(canonicals)) {
      expect(page, route).toContain(`canonical: '${route}'`)
    }

    expect(canonicals['/']).not.toBe(canonicals['/sample'])
    expect(source('app/audit/[id]/page.tsx')).toContain('canonical: null')
    expect(source('app/score/[id]/page.tsx')).toContain('canonical: null')
  })
})
