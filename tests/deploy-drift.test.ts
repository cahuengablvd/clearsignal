import { afterEach, describe, expect, it, vi } from 'vitest'

const originalVercelCommit = process.env.VERCEL_GIT_COMMIT_SHA

afterEach(() => {
  if (originalVercelCommit === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA
  else process.env.VERCEL_GIT_COMMIT_SHA = originalVercelCommit
  vi.resetModules()
})

describe('generation deployment identity', () => {
  it('keeps the stored generating engine visible after a later renderer deploy', async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = 'renderer987654321'
    const { footerText } = await import('../lib/pdf-footer')

    expect(footerText(
      new Date('2026-08-12T10:00:00.000Z'),
      { engine_version: '20260810.4', engine_commit: 'worker123' }
    )).toBe(
      'ClearSignal audit | Renderer build: rendere | Generating engine: 20260810.4 (worker1) | Generated: 2026-08-12T10:00:00.000Z'
    )
  })
})
