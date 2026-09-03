import { describe, expect, it } from 'vitest'
import { citationAttachmentCounts, hasSuggestedRewrite } from '../lib/report-presentation'

describe('client report presentation', () => {
  it('keeps resolved empty citations distinct from unresolved and failed rows', () => {
    const evidence: any[] = [
      { engine: 'openai', scope: 'core', citation_attachment: 'resolved', cited_urls: [] },
      { engine: 'openai', scope: 'core', citation_attachment: 'unresolved', cited_urls: null },
      { engine: 'openai', scope: 'supplemental', citation_attachment: 'unresolved', cited_urls: null },
    ]
    expect(citationAttachmentCounts(evidence, 'openai')).toEqual({ resolved: 1, unresolved: 1 })
  })

  it('does not render an empty Suggested label', () => {
    expect(hasSuggestedRewrite(null)).toBe(false)
    expect(hasSuggestedRewrite('   ')).toBe(false)
    expect(hasSuggestedRewrite('Request a consultation')).toBe(true)
  })
})
