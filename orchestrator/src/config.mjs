import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
export function discoverCodexCommand(localAppData = process.env.LOCALAPPDATA) {
  const root = localAppData && join(localAppData, 'OpenAI', 'Codex', 'bin');
  if (!root || !existsSync(root)) return null;
  const candidates = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => join(root, entry.name, 'codex.exe')).filter(existsSync);
  return candidates.sort().at(-1) || null;
}
export function loadConfig(path = process.env.ORCHESTRATOR_CONFIG) {
  const supplied = path && existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  const repository = resolve(supplied.repository || join(here, '..', '..'));
  const local = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
  const stateRoot = join(local, 'CSO', 'clearsignal'); // Short Windows paths keep junction-resolved module paths below MAX_PATH.
  return {
    repository, host: '127.0.0.1', port: 4317, codexCommand: supplied.codexCommand || discoverCodexCommand() || null,
    implementerModel: 'gpt-5.6-terra', techLeadModel: 'gpt-5.6-terra', reviewerModel: 'claude-fable-5-1',
    maxAttempts: 3, agentTimeoutMinutes: 60, notifyWebhookEnv: 'ORCHESTRATOR_NOTIFY_WEBHOOK_URL',
    // When the founder checkout is dirty, this must name a verified committed SHA. Worktrees are
    // created from that SHA and never include the checkout's uncommitted files.
    executionBaseCommit: null, stateRoot, runtimeRoot: join(stateRoot, 'runtime'),
    npmCliPath: join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'), ...supplied
  };
}
