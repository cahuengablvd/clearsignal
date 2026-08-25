/** True when a deterministic preview rejection still carries operator diagnostics. */
export function hasInsufficientQueryPlan(data: unknown): data is {
  status: 'query_plan_insufficient'
  plan: unknown
} {
  if (!data || typeof data !== 'object') return false
  const value = data as { status?: unknown; plan?: unknown }
  return value.status === 'query_plan_insufficient' && !!value.plan
}
