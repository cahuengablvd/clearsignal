import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ScoreProgress } from '../app/score/[id]/score-progress'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

describe('free score result states', () => {
  it('renders a resumable waiting state for a processing row', () => {
    const html = renderToStaticMarkup(
      <ScoreProgress id="score-1" token="token" status="processing" />
    )

    expect(html).toContain('Your check is running')
    expect(html).toContain('lock your phone')
  })

  it('renders the stored reason for a failed row', () => {
    const html = renderToStaticMarkup(
      <ScoreProgress
        id="score-1"
        token="token"
        status="failed"
        reason="The scan failed safely."
      />
    )

    expect(html).toContain('We could not finish the check')
    expect(html).toContain('The scan failed safely.')
  })
})
