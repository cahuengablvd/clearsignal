import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.mjs';
import { Store } from './db.mjs';
import { parsePlanFile } from './plan-parser.mjs';
import { gitHead } from './git.mjs';
import { runPlan, cancelPlan, isRunning } from './runner.mjs';
import { runProcess } from './process.mjs';
import { verifyAction } from './human-actions.mjs';

const config = loadConfig();
const store = new Store(join(config.stateRoot, 'state.db'));
store.reconcileRunning();
const csrf = randomBytes(24).toString('hex');
const uiRoot = fileURLToPath(new URL('./ui/', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
async function codexPreflight() {
  if (!config.codexCommand || !resolve(config.codexCommand) || !existsSync(config.codexCommand)) return { ok: false, status: 'CONFIGURATION_REQUIRED', message: 'Codex executable is unavailable. Configure an absolute codexCommand in orchestrator/config.local.json.' };
  const result = await runProcess(config.codexCommand, ['--version'], { cwd: config.repository, timeoutMs: 15000 });
  return result.exitCode === 0 ? { ok: true } : { ok: false, status: /auth|login/i.test(result.stderr) ? 'AUTH_REQUIRED' : 'CONFIGURATION_REQUIRED', message: `Codex preflight failed: ${result.stderr || 'codex --version did not succeed.'}` };
}

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}
async function body(request) {
  let raw = '';
  for await (const chunk of request) { raw += chunk; if (raw.length > 1024 * 1024) throw new Error('Request too large'); }
  return raw ? JSON.parse(raw) : {};
}
function safePlanPath(path) {
  const candidate = resolve(path);
  const root = resolve(config.repository) + sep;
  if (!candidate.toLowerCase().startsWith(root.toLowerCase()) || !/^TASKS_.*\.md$/i.test(candidate.split(/[\\/]/).at(-1))) throw new Error('Choose a TASKS_*.md file inside the repository.');
  return candidate;
}

const server = createServer(async (request, response) => {
  try {
    const host = request.headers.host?.split(':')[0];
    if (!['127.0.0.1', 'localhost'].includes(host)) return json(response, 403, { error: 'Loopback access only' });
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname.startsWith('/api/') && request.method !== 'GET' && request.headers['x-orchestrator-csrf'] !== csrf) return json(response, 403, { error: 'Invalid CSRF token' });
    if (request.method === 'GET' && url.pathname === '/api/state') {
      const planId = url.searchParams.get('planId');
      const data = store.dashboard(planId);
      const codex = await codexPreflight();
      return json(response, 200, { ...data, csrf, running: data.plan ? isRunning(data.plan.id) : false, codex });
    }
    if (request.method === 'POST' && url.pathname === '/api/import') {
      const input = await body(request); const path = safePlanPath(input.path);
      const id = store.createPlan(parsePlanFile(path), { sourcePath: path, baseCommit: await gitHead(config.repository), maxAttempts: config.maxAttempts });
      return json(response, 201, { id });
    }
    const match = url.pathname.match(/^\/api\/plans\/([^/]+)\/(start|pause|resume|cancel)$/);
    if (request.method === 'POST' && match) {
      const [, id, action] = match;
      if (!store.plan(id)) return json(response, 404, { error: 'Plan not found' });
      if (action === 'pause') {
        store.setPlan(id, 'PAUSE_REQUESTED');
        store.event('PAUSE_REQUESTED', 'Pause requested; waiting for the active step to reach a safe boundary.', { planId: id, level: 'warning' });
      }
      if (action === 'cancel') { store.setPlan(id, 'CANCEL_REQUESTED'); store.event('CANCEL_REQUESTED', 'Cancellation requested; the active step will stop at a safe boundary.', { planId: id, level: 'warning' }); cancelPlan(id); }
      if (action === 'start' || action === 'resume') { const probe = await codexPreflight(); if (!probe.ok) return json(response, 409, probe); if (store.dashboard(id).humanActions.length) return json(response, 409, { error: 'A HumanAction remains unresolved and must verify before execution.' }); if (store.plan(id).status === 'CANCELLED') return json(response, 409, { error: 'Cancelled plans cannot resume automatically.' }); store.setPlan(id, 'READY'); store.event('RESUMED', 'Plan execution resumed.', { planId: id }); void runPlan(store, config, id); }
      return json(response, 202, { ok: true });
    }
    const verify = url.pathname.match(/^\/api\/human-actions\/([^/]+)\/verify$/);
    if (request.method === 'POST' && verify) {
      const result = await verifyAction(store, verify[1]);
      if (result.ok) { const action = store.action(verify[1]); void runPlan(store, config, action.plan_id); }
      return json(response, 200, result);
    }
    if (request.method !== 'GET') return json(response, 404, { error: 'Not found' });
    const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const path = resolve(uiRoot, relative);
    if (!path.startsWith(uiRoot) || !existsSync(path) || !statSync(path).isFile()) return json(response, 404, { error: 'Not found' });
    response.writeHead(200, { 'content-type': mime[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(readFileSync(path));
  } catch (error) { json(response, 400, { error: error.message }); }
});

server.listen(config.port, config.host, () => {
  process.stdout.write(`ClearSignal Orchestrator: http://${config.host}:${config.port}\nState: ${config.stateRoot}\n`);
});
