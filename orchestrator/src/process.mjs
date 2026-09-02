import { spawn } from 'node:child_process';

export function childEnvironment(extra = {}) {
  // Never forward the founder's entire shell or .env-derived state to agents.
  const names = ['PATH', 'SystemRoot', 'ComSpec', 'PATHEXT', 'TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'HOME', 'USER'];
  return Object.fromEntries([...names, ...Object.keys(extra)].filter((name, index, all) => all.indexOf(name) === index && (name in process.env || name in extra)).map((name) => [name, name in extra ? extra[name] : process.env[name]]));
}

export function runProcess(command, args, { cwd, input = '', env = childEnvironment(), timeoutMs = 60 * 60 * 1000, signal } = {}) {
  return new Promise((resolve) => {
    let child;
    try { child = spawn(command, args, { cwd, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], signal }); }
    catch (error) { resolve({ exitCode: null, stdout: '', stderr: error.message, timedOut: false, spawnError: error.code || 'spawn_error' }); return; }
    let stdout = '', stderr = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => { clearTimeout(timer); resolve({ exitCode: null, stdout, stderr: `${stderr}\n${error.message}`, timedOut }); });
    child.on('close', (exitCode) => { clearTimeout(timer); resolve({ exitCode, stdout, stderr, timedOut }); });
    child.stdin.end(input);
  });
}

export function classifyFailure(result, structuredError = null) {
  // stdout can contain arbitrary agent prose. It is never provider-state evidence.
  const text = String(structuredError?.message || result.stderr || '');
  const resetValue = structuredError?.retryAt ?? structuredError?.retryAfterSeconds ?? null;
  const reset = typeof resetValue === 'string' && !Number.isNaN(Date.parse(resetValue)) ? resetValue : Number.isInteger(resetValue) && resetValue >= 0 ? new Date(Date.now() + resetValue * 1000).toISOString() : null;
  if (/401|unauthori[sz]ed|authentication|login required/i.test(text)) return { status: 'AUTH_REQUIRED', code: 'auth_required' };
  if (/quota|usage limit|capacity.*exhaust|spend limit/i.test(text)) return { status: 'MODEL_QUOTA_EXHAUSTED', code: 'quota_exhausted', retryAt: reset };
  if (/429|rate.?limit|too many requests/i.test(text)) return { status: 'RATE_LIMITED', code: 'rate_limited', retryAt: reset };
  if (result.timedOut) return { status: 'FAILED', code: 'timeout' };
  return { status: 'UNKNOWN_FAILURE', code: 'process_failed' };
}
