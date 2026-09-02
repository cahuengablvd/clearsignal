import { describe, expect, it } from 'vitest'
import { geoAnalysisUserPrompt } from '../lib/prompts'

describe('fresh GEO narrative unavailable metrics', () => {
  it('preserves unavailable composite inputs instead of presenting fabricated zeroes', () => {
    const prompt = geoAnalysisUserPrompt(
      'Target',
      'target.example',
      { ai_visibility_score: 'unavailable', mention_rate: 0, citation_rate: 'unavailable', share_of_voice: 'unavailable' },
      [],
      [],
      []
    )
    expect(prompt).toContain('AI Visibility Score: unavailable')
    expect(prompt).toContain('Citation rate: unavailable')
    expect(prompt).not.toContain('AI Visibility Score: 0/100')
  })
})
