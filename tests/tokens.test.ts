import { afterEach, describe, expect, it } from 'vitest'
import { signToken, verifyToken } from '../lib/tokens'

const previousSecret = process.env.ACCESS_TOKEN_SECRET

afterEach(() => {
  if (previousSecret === undefined) delete process.env.ACCESS_TOKEN_SECRET
  else process.env.ACCESS_TOKEN_SECRET = previousSecret
})

describe('report access tokens', () => {
  it('uses a full HMAC-SHA256 base64url token', () => {
    process.env.ACCESS_TOKEN_SECRET = 'test-secret-with-enough-entropy-for-unit-tests'
    const token = signToken('audit', 'audit-123')

    expect(token).toHaveLength(43)
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(verifyToken('audit', 'audit-123', token)).toBe(true)
  })

  it('cannot be replayed for another audit or scope', () => {
    process.env.ACCESS_TOKEN_SECRET = 'test-secret-with-enough-entropy-for-unit-tests'
    const token = signToken('audit', 'audit-123')

    expect(verifyToken('audit', 'audit-456', token)).toBe(false)
    expect(verifyToken('score', 'audit-123', token)).toBe(false)
    expect(verifyToken('audit', 'audit-123', `${token.slice(0, -1)}x`)).toBe(false)
  })
})
