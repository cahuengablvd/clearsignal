import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SCORE_SYSTEM, scoreUserPrompt } from '../lib/prompts'
import { ClearSignalScoreSchema } from '../lib/schemas'

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('score-derived intake draft', () => {
  it('requires a one-sentence business description in the existing score response', () => {
    const score = ClearSignalScoreSchema.parse({
      icp: 7,
      headline: 6,
      cta: 5,
      trust: 4,
      ai_search: 3,
      top_insight: 'Clarify the audience.',
      business_description_draft: 'Acme serves small retailers with inventory planning software.',
    })
    expect(score.business_description_draft).toMatch(/retailers/i)
    expect(() => ClearSignalScoreSchema.parse({ ...score, business_description_draft: undefined })).toThrow()
    expect(() => ClearSignalScoreSchema.parse({ ...score, business_description_draft: 'First sentence. Second sentence.' })).toThrow()
  })

  it('asks for the draft in the same score call and exact JSON shape', () => {
    expect(SCORE_SYSTEM).toContain('who the business serves and what it sells')
    expect(scoreUserPrompt('homepage')).toContain('business_description_draft')
  })

  it('exposes and consumes the persisted draft without a checkout scrape', () => {
    const api = source('app/api/score/[id]/route.ts')
    const checkout = source('app/checkout/page.tsx')
    expect(api).toContain('business_description_draft')
    expect(checkout).toContain('data.business_description_draft')
    expect(checkout).toContain('We read your site')
    expect(checkout).toContain('We have not read your site yet')
  })

  it('shows both homepage-read states to the operator', () => {
    const admin = source('app/admin/page.tsx')
    expect(admin).toContain('Homepage read successfully')
    expect(admin).toContain('Could not read the homepage')
  })
})
