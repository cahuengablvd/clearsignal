import crypto from 'crypto'

/**
 * HMAC-signed access tokens, scoped so a token minted for one purpose can't be
 * replayed against another (e.g. a "score" token can't unlock an "audit").
 *
 * Requires ACCESS_TOKEN_SECRET. In production a missing secret is fatal
 * (fail-closed). In development we fall back to a fixed insecure secret so the
 * app still runs locally - never rely on this in prod.
 */
function getSecret(): string {
  const secret = process.env.ACCESS_TOKEN_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ACCESS_TOKEN_SECRET is not set')
  }
  return 'dev-insecure-secret-do-not-use-in-production'
}

export function signToken(scope: string, id: string): string {
  return crypto.createHmac('sha256', getSecret()).update(`${scope}:${id}`).digest('base64url')
}

export function trySignToken(scope: string, id: string): string | null {
  try {
    return signToken(scope, id)
  } catch {
    return null
  }
}

export function verifyToken(scope: string, id: string, token: string | undefined | null): boolean {
  if (!token) return false
  let expected: string
  try {
    expected = signToken(scope, id)
  } catch {
    // Secret missing in prod -> cannot verify -> deny.
    return false
  }
  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
