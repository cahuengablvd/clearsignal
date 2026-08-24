import { beforeEach, describe, expect, it, vi } from 'vitest'

const { queryEngine } = vi.hoisted(() => ({ queryEngine: vi.fn() }))

vi.mock('../lib/geo/engines', () => ({
  availableEngines: () => ['openai', 'claude', 'perplexity'],
  queryEngine,
}))

import { runGeoScan } from '../lib/geo'

describe('GEO summary engine coverage', () => {
  beforeEach(() => {
    queryEngine.mockReset()
    queryEngine.mockImplementation(async (engine: string, query: string) => {
      if (engine === 'claude') {
        return { engine, ok: false, answer: '', citations: [], error: 'timed out', attempts: 1 }
      }
      return {
        engine,
        ok: true,
        answer: `${`Example is relevant for ${query}. `.repeat(12)}`,
        citations: [],
        attempts: 1,
      }
    })
  })

  it('does not name an engine that produced no evidence', async () => {
    const result = await runGeoScan({
      brand: 'Example',
      url: 'https://example.com',
      providedQueries: ['Which example service should I choose?'],
      engines: ['openai', 'claude', 'perplexity'],
      discoverCompetitors: false,
      analyzeSources: false,
      narrative: false,
    })

    expect(result.engines_tested).toEqual(['openai', 'perplexity'])
    expect(result.summary).toContain('Coverage was insufficient to report an AI visibility index')
    expect(result.summary).toContain('Claude answered 0 of 1 questions')
  })
})
