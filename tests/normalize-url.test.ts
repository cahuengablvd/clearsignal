import { describe, expect, it } from 'vitest'
import { normalizeWebsiteUrl } from '../lib/normalize-url'
import { CheckoutIntakeSchema, competitorUrlSchema } from '../lib/schemas'

describe('normalizeWebsiteUrl', () => {
  it.each([
    ['example.com', 'https://example.com/'],
    ['www.example.com/', 'https://www.example.com/'],
    ['EXAMPLE.COM', 'https://example.com/'],
    ['HTTP://Example.com', 'http://example.com/'],
    ['example.com/path?x=1', 'https://example.com/path?x=1'],
    ['example.co.uk', 'https://example.co.uk/'],
    [' example.com ', 'https://example.com/'],
    ['example.com/EN/Pricing', 'https://example.com/EN/Pricing'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeWebsiteUrl(input)).toBe(expected)
  })

  it.each([
    'example',
    '\u043d\u0435 \u0443\u0440\u043b',
    'ftp://example.com',
    'javascript:alert(1)',
    'localhost:3000',
    'http://192.168.0.1',
    '',
    'https://-example.com',
    'https://example.com.',
  ])('rejects %s', (input) => {
    expect(normalizeWebsiteUrl(input)).toBeNull()
  })
})

describe('website schemas', () => {
  it('normalizes bare checkout and competitor domains', () => {
    const result = CheckoutIntakeSchema.parse({
      email: 'lead@example.com',
      url: 'EXAMPLE.COM',
      competitor_1: 'competitor.com',
      competitor_2: '',
      competitor_3: '',
      icp_description: 'Small businesses buying inventory planning software.',
    })

    expect(result.url).toBe('https://example.com/')
    expect(result.competitor_1).toBe('https://competitor.com/')
  })

  it('keeps an empty optional competitor', () => {
    expect(competitorUrlSchema.parse('')).toBe('')
  })

  it('rejects an empty required homepage', () => {
    expect(CheckoutIntakeSchema.safeParse({
      email: 'lead@example.com',
      url: '',
      competitor_1: '',
      competitor_2: '',
      competitor_3: '',
    }).success).toBe(false)
  })
})
