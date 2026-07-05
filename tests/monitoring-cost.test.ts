import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runGeoScan: vi.fn(),
  from: vi.fn(),
  monitoredSelect: vi.fn(),
  monitoredEq: vi.fn(),
  monitoredSingle: vi.fn(),
  monitoredUpdate: vi.fn(),
  monitoredUpdateEq: vi.fn(),
  runsSelect: vi.fn(),
  runsEq: vi.fn(),
  runsOrder: vi.fn(),
  runsLimit: vi.fn(),
  runsMaybeSingle: vi.fn(),
  runsInsert: vi.fn(),
}))

vi.mock('../lib/geo', () => ({
  runGeoScan: mocks.runGeoScan,
}))

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { runMonitoringForSite } from '../lib/monitoring'

describe('monitoring cost guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.runGeoScan.mockResolvedValue({
      ai_visibility_score: 72,
      mention_rate: 50,
      share_of_voice: 50,
      citation_rate: 0,
      cited_domains_ranked: [],
      competitor_visibility: [],
      evidence: [],
    })

    mocks.monitoredSingle.mockResolvedValue({
      data: {
        id: 'site-1',
        brand: 'Example',
        url: 'https://example.com',
        icp_description: 'Local buyer',
        competitors: ['https://competitor.example'],
      },
      error: null,
    })
    mocks.monitoredEq
      .mockReturnValueOnce({ single: mocks.monitoredSingle })
      .mockReturnValueOnce({ error: null })
    mocks.monitoredSelect.mockReturnValue({ eq: mocks.monitoredEq })
    mocks.monitoredUpdate.mockReturnValue({ eq: mocks.monitoredEq })

    mocks.runsMaybeSingle.mockResolvedValue({ data: null, error: null })
    mocks.runsLimit.mockReturnValue({ maybeSingle: mocks.runsMaybeSingle })
    mocks.runsOrder.mockReturnValue({ limit: mocks.runsLimit })
    mocks.runsEq.mockReturnValue({ eq: mocks.runsEq, order: mocks.runsOrder })
    mocks.runsSelect.mockReturnValue({ eq: mocks.runsEq })
    mocks.runsInsert.mockResolvedValue({ error: null })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'monitored_sites') {
        return {
          select: mocks.monitoredSelect,
          update: mocks.monitoredUpdate,
        }
      }
      if (table === 'monitoring_runs') {
        return {
          select: mocks.runsSelect,
          insert: mocks.runsInsert,
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })
  })

  it('runs monitoring scans in the cheaper no-web-search/no-narrative Claude-only mode', async () => {
    await runMonitoringForSite('site-1')

    expect(mocks.runGeoScan).toHaveBeenCalledWith(expect.objectContaining({
      queryCount: 5,
      engines: ['claude'],
      narrative: false,
      webSearch: false,
    }))
  })
})
