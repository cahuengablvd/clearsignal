export async function notify(config, event, details) {
  const url = process.env[config.notifyWebhookEnv || 'ORCHESTRATOR_NOTIFY_WEBHOOK_URL'];
  if (!url) return false;
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event, ...details }) });
    return response.ok;
  } catch { return false; }
}
