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
        return { engine, ok: false, answer: '', citations: [], error: 'timed out' }
      }
      return {
        engine,
        ok: true,
        answer: `Example is relevant for ${query}.`,
        citations: [],
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
    expect(result.summary).toContain('across OpenAI and Perplexity')
    expect(result.summary).not.toContain('Claude')
  })
})
