export type AdminSessionState = {
  authed: boolean
  loadError: string | null
}

export function adminSessionState(status: number): AdminSessionState {
  if (status === 401 || status === 403) {
    return { authed: false, loadError: null }
  }
  if (status < 200 || status >= 300) {
    return {
      authed: true,
      loadError: `Could not load audits (HTTP ${status}). Existing audits are unaffected.`,
    }
  }
  return { authed: true, loadError: null }
}
