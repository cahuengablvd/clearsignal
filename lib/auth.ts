import { cookies } from 'next/headers'

/**
 * Check if the current request has a valid admin session.
 * Uses simple cookie-based auth for MVP.
 */
export function isAdminAuthenticated(): boolean {
  const cookieStore = cookies()
  return cookieStore.get('admin_session')?.value === 'authenticated'
}
