import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('report print and delivery guidance', () => {
  it('keeps report headings with their following content and cards/tables together in print', () => {
    const css = source('app/globals.css')
    const print = css.slice(css.indexOf('@media print'))

    expect(print).toMatch(/\.audit-report h1[\s\S]*break-after:\s*avoid/)
    expect(print).toMatch(/\.audit-report \.rounded-lg\.border[\s\S]*break-inside:\s*avoid/)
    expect(print).toMatch(/\.audit-report table[\s\S]*break-inside:\s*avoid/)
  })

  it('gives client-readable JSON-LD placement and validation instructions beside the block', () => {
    const page = source('app/audit/[id]/page.tsx')
    const jsonLdCard = page.slice(page.indexOf('Schema.org JSON-LD'), page.indexOf('</Card>', page.indexOf('Schema.org JSON-LD')))

    expect(page).toContain('Draft copy for your review')
    expect(page).not.toContain('Draft copy for operator review')
    expect(jsonLdCard).toContain('&lt;head&gt;')
    expect(jsonLdCard).toContain('&lt;script type="application/ld+json"&gt;')
    expect(jsonLdCard).toContain('Use one block per page')
    expect(jsonLdCard).toContain('Google Rich Results Test')
    expect(jsonLdCard).toContain('https://search.google.com/test/rich-results')
  })

  it('renders an implementation brief without an empty acceptance-criteria section in web and print output', () => {
    const page = source('app/audit/[id]/page.tsx')

    expect(page).toContain('{b.steps.length > 0 && (')
    expect(page).toContain('{b.acceptance_criteria.length > 0 && (')
    expect(page).toContain('Acceptance criteria')
  })
})
