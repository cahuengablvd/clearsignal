/**
 * Best-effort operational alerting.
 *
 * Posts an alert to NOTIFY_WEBHOOK_URL (Slack/Discord/webhook) for events that
 * must not fail silently - chiefly a paid audit that couldn't be enqueued or
 * generated. If NOTIFY_WEBHOOK_URL is unset, it logs a warning instead. It
 * never throws, so alerting can never break the flow it is observing.
 */
export type AlertEvent =
  | 'audit_enqueue_failed'
  | 'audit_generation_failed'
  | 'audit_recovery_failed'

export async function notify(event: AlertEvent, details: Record<string, unknown>): Promise<void> {
  const payload = {
    source: 'clearsignal',
    event,
    details,
    ts: new Date().toISOString(),
  }

  const url = process.env.NOTIFY_WEBHOOK_URL
  if (!url) {
    console.warn(`[notify] ${event} (NOTIFY_WEBHOOK_URL not set):`, JSON.stringify(details))
    return
  }

  try {
    // Send both a generic `text` (Slack/Discord-friendly) and the structured body.
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `[ClearSignal] ${event}: ${JSON.stringify(details)}`, ...payload }),
    })
  } catch (err) {
    console.error(`[notify] failed to post alert for ${event}:`, err)
  }
}
