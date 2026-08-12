type SupabaseWriteError = { message: string } | null | undefined

/**
 * Supabase write builders resolve with an error instead of rejecting. Keep the
 * decision at each call site, but make an ignored error impossible by default.
 */
export function requireSupabaseWrite(error: SupabaseWriteError, context: string): void {
  if (!error) return
  console.error(`[db-write] ${context} failed: ${error.message}`)
  throw new Error(`Database write failed (${context}): ${error.message}`)
}

/** Telemetry must never block fulfillment, but failed writes must remain visible. */
export function logSupabaseWriteFailure(error: SupabaseWriteError, context: string): void {
  if (error) console.warn(`[db-write] ${context} failed: ${error.message}`)
}
