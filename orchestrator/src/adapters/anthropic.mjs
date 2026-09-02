import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { redactText } from '../redact.mjs';

function envFileValue(path, name) {
  if (!path) return null;
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (match?.[1] === name) return match[2].trim().replace(/^['"]|['"]$/g, '');
    }
  } catch {}
  return null;
}

export async function runAnthropic({ model, prompt, artifactDir, envPath, timeoutMs = 3600000, effort = 'high' }) {
  mkdirSync(artifactDir, { recursive: true });
  const key = process.env.ORCHESTRATOR_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || envFileValue(envPath, 'ANTHROPIC_API_KEY');
  if (!key) return { status: 'AUTH_REQUIRED', failureCode: 'missing_anthropic_key' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: controller.signal,
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 8192, output_config: { effort }, messages: [{ role: 'user', content: prompt }] })
    });
    const raw = await response.text();
    writeFileSync(join(artifactDir, 'response.json'), redactText(raw), 'utf8');
    const retryAfter = response.headers.get('retry-after');
    const retryAt = retryAfter && /^\d+$/.test(retryAfter) ? new Date(Date.now() + Number(retryAfter) * 1000).toISOString() : null;
    const body = JSON.parse(raw);
    if (!response.ok) {
      const code = body?.error?.details?.error_code || body?.error?.type || `http_${response.status}`;
      if (response.status === 401 || response.status === 403) return { status: 'AUTH_REQUIRED', failureCode: code, failureSummary: body?.error?.message };
      if (code === 'enforced_spend_limit_reached' || /usage limit|spend limit/i.test(body?.error?.message || '')) return { status: 'MODEL_QUOTA_EXHAUSTED', failureCode: code, failureSummary: body?.error?.message, retryAt };
      if (response.status === 429) return { status: 'RATE_LIMITED', failureCode: code, failureSummary: body?.error?.message, retryAt };
      return { status: 'UNKNOWN_FAILURE', failureCode: code, failureSummary: body?.error?.message };
    }
    const text = body.content?.filter((item) => item.type === 'text').map((item) => item.text).join('') || '';
    const jsonText = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
    try { return { status: 'COMPLETED', output: JSON.parse(jsonText), externalRunId: response.headers.get('request-id'), usage: body.usage || {} }; }
    catch (error) { return { status: 'FAILED', failureCode: 'invalid_output', failureSummary: error.message, externalRunId: response.headers.get('request-id'), usage: body.usage || {} }; }
  } catch (error) {
    return { status: 'UNKNOWN_FAILURE', failureCode: error.name === 'AbortError' ? 'timeout' : 'network_error', failureSummary: error.message };
  } finally { clearTimeout(timer); }
}
