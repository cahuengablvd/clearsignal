import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  enforceRateLimits: vi.fn(),
  clientIp: vi.fn(() => '203.0.113.10'),
  emailDomain: vi.fn((email: string) => email.split('@')[1]?.toLowerCase() || email),
  createMonitoredSite: vi.fn(),
  scrapeUrl: vi.fn(),
  callClaudeJSON: vi.fn(),
  runGeoScan: vi.fn(),
  supabaseInsert: vi.fn(),
  supabaseSelect: vi.fn(),
  supabaseSingle: vi.fn(),
  supabaseFrom: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimits: mocks.enforceRateLimits,
  clientIp: mocks.clientIp,
  emailDomain: mocks.emailDomain,
}))

vi.mock('@/lib/monitoring', () => ({
  createMonitoredSite: mocks.createMonitoredSite,
}))

vi.mock('@/lib/tokens', () => ({
  signToken: vi.fn(() => 'signed-token'),
}))

vi.mock('@/lib/firecrawl', () => ({
  scrapeUrl: mocks.scrapeUrl,
}))

vi.mock('@/lib/normalize-markdown', () => ({
  normalizeMarkdown: vi.fn((text: string) => text),
}))

vi.mock('@/lib/anthropic', () => ({
  callClaudeJSON: mocks.callClaudeJSON,
}))

vi.mock('@/lib/geo', () => ({
  runGeoScan: mocks.runGeoScan,
}))

vi.mock('@/lib/schemas', async () => {
  const { z } = await import('zod')
  return {
    ClearSignalScoreSchema: { parse: (data: unknown) => data },
    competitorUrlSchema: z.string().optional().default(''),
    icpTextSchema: z.string(),
  }
})

vi.mock('@/lib/prompts', () => ({
  MODEL_SCORE: 'claude-haiku-test',
  SCORE_SYSTEM: 'score system',
  scoreUserPrompt: () => 'score prompt',
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.supabaseFrom,
  },
}))

function request(body: Record<string, unknown>) {
  return {
    json: vi.fn(async () => body),
    headers: new Headers(),
  }
}

describe('public cost-abuse guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.MONITORING_SIGNUP_ENABLED
    mocks.enforceRateLimits.mockResolvedValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 })
    mocks.createMonitoredSite.mockResolvedValue({ id: 'monitor-1' })
    mocks.scrapeUrl.mockResolvedValue('homepage copy')
    mocks.callClaudeJSON.mockResolvedValue({ score: 80, top_insight: 'Good baseline' })
    mocks.runGeoScan.mockResolvedValue(null)
    mocks.supabaseSingle.mockResolvedValue({ data: { id: 'score-1' }, error: null })
    mocks.supabaseSelect.mockReturnValue({ single: mocks.supabaseSingle })
    mocks.supabaseInsert.mockReturnValue({ select: mocks.supabaseSelect })
    mocks.supabaseFrom.mockReturnValue({ insert: mocks.supabaseInsert })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.MONITORING_SIGNUP_ENABLED
  })

  it('keeps public monitoring signup disabled unless explicitly enabled', async () => {
    const { POST } = await import('../app/api/monitoring/route')

    const res = await POST(request({
      email: 'lead@example.com',
      url: 'https://example.com',
    }) as never)
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body).toEqual({ error: 'Monitoring signup is not enabled' })
    expect(mocks.enforceRateLimits).not.toHaveBeenCalled()
    expect(mocks.createMonitoredSite).not.toHaveBeenCalled()
  })

  it('applies a global daily monitoring signup cap when signup is enabled', async () => {
    process.env.MONITORING_SIGNUP_ENABLED = 'true'
    const { POST } = await import('../app/api/monitoring/route')

    const res = await POST(request({
      email: 'lead@example.com',
      url: 'https://example.com',
    }) as never)

    expect(res.status).toBe(200)
    expect(mocks.enforceRateLimits).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ key: 'monitor:global:daily' }),
    ]))
    expect(mocks.createMonitoredSite).toHaveBeenCalled()
  })

  it('blocks free score at the global daily cap before paid vendor calls', async () => {
    mocks.enforceRateLimits.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 })
    const { POST } = await import('../app/api/score/route')

    const res = await POST(request({
      email: 'lead@example.com',
      url: 'https://example.com',
      competitor_1: '',
      icp_description: 'Local service buyer',
    }) as never)

    expect(res.status).toBe(429)
    expect(mocks.enforceRateLimits).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ key: 'score:global:daily' }),
    ]))
    expect(mocks.scrapeUrl).not.toHaveBeenCalled()
    expect(mocks.callClaudeJSON).not.toHaveBeenCalled()
    expect(mocks.runGeoScan).not.toHaveBeenCalled()
  })
})
