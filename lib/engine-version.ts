type StoredGenerationMeta = { meta?: { engine_version?: string } } | null

/**
 * The engine version of the most recently generated report. Compared against
 * each row so a report produced by an older worker is visible without opening
 * the Trigger dashboard. Ordered by generation time, not by version string:
 * `20260812.10` sorts before `20260812.2` lexicographically.
 */
export function latestObservedEngineVersion(
  audits: { report?: unknown; last_generated_at?: string | null }[]
): string | null {
  let newest: { at: string; version: string } | null = null
  for (const audit of audits) {
    const version = (audit.report as StoredGenerationMeta)?.meta?.engine_version
    const at = audit.last_generated_at
    if (!version || !at) continue
    if (!newest || at > newest.at) newest = { at, version }
  }
  return newest?.version || null
}
