import { cookies } from 'next/headers'
import { signToken, verifyToken } from './tokens'

export const ADMIN_COOKIE = 'admin_session'

/** Signed value stored in the admin cookie — not a forgeable static string. */
export function adminCookieValue(): string {
  return signToken('admin', 'session')
}

/** Validate a raw cookie value (use in route handlers reading NextRequest cookies). */
export function isValidAdminCookie(value: string | undefined): boolean {
  return verifyToken('admin', 'session', value)
}

/**
 * Check if the current request has a valid admin session.
 * For use in server components / route handlers via next/headers.
 */
export function isAdminAuthenticated(): boolean {
  return isValidAdminCookie(cookies().get(ADMIN_COOKIE)?.value)
}
