import { describe, expect, it } from 'vitest'
import { adminSessionState } from '../lib/admin-session'

describe('admin session render state', () => {
  it('renders the login form only for an unauthorized response', () => {
    expect(adminSessionState(401)).toEqual({ authed: false, loadError: null })
    expect(adminSessionState(403)).toEqual({ authed: false, loadError: null })
  })

  it('keeps the admin surface and shows an error for a server failure', () => {
    expect(adminSessionState(500)).toEqual({
      authed: true,
      loadError: 'Could not load audits (HTTP 500). Existing audits are unaffected.',
    })
  })
})
