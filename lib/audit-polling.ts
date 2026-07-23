export const TERMINAL_AUDIT_STATUSES = new Set([
  'awaiting_review',
  'done',
  'delivered',
  'delivery_failed',
  'failed',
  'failed-validation',
])

export type PollableAudit = {
  id: string
  audit_status: string
}

export function isTerminalAuditStatus(status: string): boolean {
  return TERMINAL_AUDIT_STATUSES.has(status)
}

export async function pollAuditStatus<T extends PollableAudit>(
  auditId: string,
  refresh: () => Promise<T[]>,
  options: {
    intervalMs?: number
    timeoutMs?: number
    sleep?: (ms: number) => Promise<void>
    now?: () => number
  } = {}
): Promise<T | null> {
  const intervalMs = options.intervalMs ?? 5000
  const timeoutMs = options.timeoutMs ?? 30 * 60 * 1000
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)))
  const now = options.now ?? Date.now
  const deadline = now() + timeoutMs

  while (now() < deadline) {
    await sleep(intervalMs)
    const audits = await refresh()
    const audit = audits.find((item) => item.id === auditId)
    if (audit && isTerminalAuditStatus(audit.audit_status)) return audit
  }
  return null
}
