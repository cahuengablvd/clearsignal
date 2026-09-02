import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { runProcess } from './process.mjs';

export class RuntimePreparationError extends Error {
  constructor(message) { super(message); this.name = 'RuntimePreparationError'; }
}

export function dependencyFingerprint(lockfile) {
  return createHash('sha256').update(readFileSync(lockfile)).digest('hex');
}

export function assertPackageLockConsistency(repository) {
  const manifest = JSON.parse(readFileSync(join(repository, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(join(repository, 'package-lock.json'), 'utf8'));
  const root = lock.packages?.[''];
  if (!root) throw new RuntimePreparationError('package-lock.json has no root package entry. Run npm install in a reviewed checkout before orchestration.');
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    const declared = manifest[field] || {}; const locked = root[field] || {};
    for (const [name, version] of Object.entries(declared)) if (locked[name] !== version) throw new RuntimePreparationError(`package.json and package-lock.json disagree for ${field}.${name}; refusing to guess a runtime.`);
  }
}

const requiredEntries = ['typescript/bin/tsc', 'vitest/vitest.mjs', 'next/dist/bin/next'];
const metadataPath = (repository) => join(repository, 'node_modules', '.clearsignal-orchestrator-runtime.json');
function readyRuntime(repository, fingerprint) {
  if (!requiredEntries.every((entry) => existsSync(join(repository, 'node_modules', entry))) || !existsSync(metadataPath(repository))) return false;
  try { const metadata = JSON.parse(readFileSync(metadataPath(repository), 'utf8')); return metadata.state === 'RUNTIME_READY' && metadata.fingerprint === fingerprint; } catch { return false; }
}

// Windows junctions created by Node or PowerShell were not a reliable runtime boundary: the
// resulting reparse point could not consistently be traversed by Node from a Git worktree.
// Reliability wins over caching: npm ci runs in the isolated worktree itself.
export async function prepareDependencyRuntime({ repository, npmCliPath, run = runProcess }) {
  assertPackageLockConsistency(repository);
  const fingerprint = dependencyFingerprint(join(repository, 'package-lock.json'));
  if (readyRuntime(repository, fingerprint)) return { state: 'RUNTIME_READY', fingerprint, runtimePath: repository, reused: true, strategy: 'isolated-worktree-npm-ci' };
  try {
    // npm ci owns node_modules and removes incomplete/junctioned state before installing exactly
    // package-lock.json. This never reads or copies the founder checkout's dependencies.
    const result = await run(process.execPath, [npmCliPath, 'ci', '--ignore-scripts', '--no-audit', '--fund=false'], { cwd: repository, timeoutMs: 20 * 60000 });
    if (result.exitCode !== 0 || !requiredEntries.every((entry) => existsSync(join(repository, 'node_modules', entry)))) throw new RuntimePreparationError(`Dependency runtime provisioning failed (npm ci exit ${result.exitCode ?? 'unavailable'}): ${(result.stderr || result.stdout).slice(-1000)}`);
    writeFileSync(metadataPath(repository), JSON.stringify({ state: 'RUNTIME_READY', fingerprint, preparedAt: new Date().toISOString(), strategy: 'isolated-worktree-npm-ci', lifecycleScripts: 'disabled via --ignore-scripts' }, null, 2));
    return { state: 'RUNTIME_READY', fingerprint, runtimePath: repository, reused: false, strategy: 'isolated-worktree-npm-ci' };
  } catch (error) {
    try { rmSync(metadataPath(repository), { force: true }); } catch {}
    if (error instanceof RuntimePreparationError) throw error;
    throw new RuntimePreparationError(error.message);
  }
}
