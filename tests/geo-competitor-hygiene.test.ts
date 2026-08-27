import { beforeEach, describe, expect, it, vi } from 'vitest'

const { callClaudeJSON, queryEngine } = vi.hoisted(() => ({
  callClaudeJSON: vi.fn(),
  queryEngine: vi.fn(),
}))

vi.mock('../lib/anthropic', () => ({ callClaudeJSON }))
vi.mock('../lib/geo/engines', () => ({
  availableEngines: () => ['openai', 'claude', 'perplexity'],
  queryEngine,
}))

import { runGeoScan } from '../lib/geo'

describe('GEO competitor and cited-source hygiene', () => {
  beforeEach(() => {
    callClaudeJSON.mockReset()
    queryEngine.mockReset()
    queryEngine.mockResolvedValue({
      ok: true,
      answer: `${'ChatGPT, Claude, Perplexity, Gemini, Copilot, Google AI Overviews, AI Mode, com.mt, and Genuine Rival are relevant options. '.repeat(3)}`,
      citations: ['https://example.co.uk/post', 'https://news.example.com.mt/x'],
      attempts: 1,
    })
  })

  it('excludes queried answer engines from discovered competitors while retaining a genuine rival', async () => {
    callClaudeJSON.mockResolvedValue({
      competitors: [
        'ChatGPT',
        'Claude',
        'Perplexity',
        'Gemini',
        'Copilot',
        'Google-AI Overviews',
        'AI Mode',
        'com.mt',
        'Genuine Rival',
        'Genuine-Rival',
      ],
    })

    const result = await runGeoScan({
      brand: 'Target',
      url: 'https://target.example',
      providedQueries: ['Which option should I choose?'],
      engines: ['openai', 'claude', 'perplexity'],
      analyzeSources: false,
      narrative: false,
    })

    expect(result.competitor_visibility.map((competitor) => competitor.name)).toEqual(['Genuine Rival'])
    expect(result.evidence.flatMap((evidence) => evidence.competitors_mentioned)).toEqual([
      'Genuine Rival',
      'Genuine Rival',
      'Genuine Rival',
    ])
  })

  it('excludes multi-token engine aliases without hiding companies that contain other tokens', async () => {
    queryEngine.mockResolvedValue({
      ok: true,
      answer: `${'Ahrefs, Semrush, AI4Life, Perplexity Labs Consulting, and Genuine Rival are relevant options. '.repeat(3)}`,
      citations: [],
      attempts: 1,
    })
    callClaudeJSON.mockResolvedValue({
      competitors: [
        'Google AI',
        'Google AI Mode',
        'ChatGPT Search',
        'Bing Copilot',
        'Ahrefs',
        'Semrush',
        'AI4Life',
        'Perplexity Labs Consulting',
        'Genuine Rival',
      ],
    })

    const result = await runGeoScan({
      brand: 'Target',
      url: 'https://target.example',
      providedQueries: ['Which option should I choose?'],
      engines: ['openai'],
      analyzeSources: false,
      narrative: false,
    })

    expect(result.competitor_visibility).toEqual([])
    expect(result.entity_resolution?.entities.filter((entity) => entity.role === 'competitor').every((entity) => entity.state === 'unconfirmed')).toBe(true)
  })

  it('never accepts an answer engine as a competitor, including operator input', async () => {
    const result = await runGeoScan({
      brand: 'Target',
      url: 'https://target.example',
      competitors: ['ChatGPT'],
      providedQueries: ['Which option should I choose?'],
      engines: ['openai'],
      discoverCompetitors: false,
      analyzeSources: false,
      narrative: false,
    })

    expect(result.competitor_visibility).toEqual([])
    expect(result.entity_resolution?.entities.find((entity) => entity.role === 'engine')?.state).toBe('rejected')
  })

  it('does not discover an operator-confirmed brand alias as a competitor', async () => {
    queryEngine.mockResolvedValue({ ok: true, answer: 'Saudi National Bank (SNB) is a leading option. '.repeat(10), citations: [], attempts: 1 })
    callClaudeJSON.mockResolvedValue({ competitors: ['SNB', 'Genuine Rival'] })

    const result = await runGeoScan({
      brand: 'Alahli',
      brandAliases: ['Saudi National Bank', 'SNB'],
      url: 'https://alahli.com',
      providedQueries: ['Which option should I choose?'],
      engines: ['openai'],
      analyzeSources: false,
      narrative: false,
    })

    expect(result.evidence[0]?.brand_mentioned).toBe(true)
    expect(result.competitor_visibility.map((competitor) => competitor.name)).not.toContain('SNB')
  })

  it('counts registrable cited domains and never a bare public suffix', async () => {
    const result = await runGeoScan({
      brand: 'Target',
      url: 'https://target.example',
      providedQueries: ['Which option should I choose?'],
      engines: ['claude'],
      discoverCompetitors: false,
      analyzeSources: false,
      narrative: false,
    })

    expect(result.cited_domains_ranked.map((source) => source.domain)).toEqual(['example.co.uk', 'example.com.mt'])
    expect(result.cited_domains_ranked.map((source) => source.domain)).not.toEqual(expect.arrayContaining(['co.uk', 'com.mt']))
  })
})
