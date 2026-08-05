import { describe, expect, it } from 'vitest'
import { assessScrapeQuality } from '../lib/scrape-quality'

describe('scrape input quality', () => {
  it('classifies a short browser-verification response as a challenge', () => {
    expect(assessScrapeQuality('Just a moment... Checking your browser. Ray ID: abc123')).toMatchObject({
      kind: 'challenge',
    })
  })

  it('does not flag a substantive legitimate page that mentions Cloudflare', () => {
    const page = [
      '# Security services',
      'Our engineers configure Cloudflare and explain its browser checks.',
      'Performance & security by Cloudflare is a phrase customers may see.',
      'We provide architecture reviews, migrations, incident response, and ongoing support.',
      'This page describes our services, delivery process, client outcomes, and team experience.',
    ].join('\n\n').repeat(20)

    expect(assessScrapeQuality(page)).toMatchObject({ kind: 'substantive' })
  })

  it('classifies very short content without a challenge marker as thin', () => {
    expect(assessScrapeQuality('Welcome to Acme.')).toMatchObject({ kind: 'thin' })
  })
})
