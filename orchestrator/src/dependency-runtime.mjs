import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
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
    for (const [name, version] of Object.entries(declared)) {
      if (locked[name] !== version) throw new RuntimePreparationError(`package.json and package-lock.json disagree for ${field}.${name}; refusing to guess a runtime.`);
    }
  }
}

function metadataPath(runtimePath) { return join(runtimePath, 'runtime.json'); }
function readyRuntime(runtimePath, fingerprint) {
  const requiredEntries = ['typescript/bin/tsc', 'vitest/vitest.mjs', 'next/dist/bin/next'];
  if (!existsSync(metadataPath(runtimePath)) || !requiredEntries.every((entry) => existsSync(join(runtimePath, 'node_modules', entry)))) return false;
  try { const metadata = JSON.parse(readFileSync(metadataPath(runtimePath), 'utf8')); return metadata.state === 'RUNTIME_READY' && metadata.fingerprint === fingerprint; } catch { return false; }
}

export async function prepareDependencyRuntime({ repository, runtimeRoot, npmCliPath, run = runProcess }) {
  assertPackageLockConsistency(repository);
  const fingerprint = dependencyFingerprint(join(repository, 'package-lock.json'));
  // The full SHA-256 remains in runtime.json. A 24-hex path key keeps Windows resolved paths short.
  const runtimePath = join(runtimeRoot, fingerprint.slice(0, 24));
  if (readyRuntime(runtimePath, fingerprint)) return { state: 'RUNTIME_READY', fingerprint, runtimePath, reused: true };
  mkdirSync(runtimeRoot, { recursive: true });
  // A partial runtime is managed state, not user source. It cannot be reused for this fingerprint.
  if (existsSync(runtimePath)) rmSync(runtimePath, { recursive: true, force: true });
  const staging = `${runtimePath}.preparing-${process.pid}-${Date.now()}`;
  try {
    rmSync(staging, { recursive: true, force: true }); mkdirSync(staging, { recursive: true });
    // The runtime contains only these reviewed dependency manifests and node_modules; .env files are never copied.
    copyFileSync(join(repository, 'package.json'), join(staging, 'package.json'));
    copyFileSync(join(repository, 'package-lock.json'), join(staging, 'package-lock.json'));
    writeFileSync(metadataPath(staging), JSON.stringify({ state: 'RUNTIME_PREPARING', fingerprint, createdAt: new Date().toISOString(), lifecycleScripts: 'disabled via --ignore-scripts' }, null, 2));
    const result = await run(process.execPath, [npmCliPath, 'ci', '--ignore-scripts', '--no-audit', '--fund=false'], { cwd: staging, timeoutMs: 20 * 60000 });
    if (result.exitCode !== 0 || !['typescript/bin/tsc', 'vitest/vitest.mjs', 'next/dist/bin/next'].every((entry) => existsSync(join(staging, 'node_modules', entry)))) throw new RuntimePreparationError(`Dependency runtime provisioning failed (npm ci exit ${result.exitCode ?? 'unavailable'}): ${(result.stderr || result.stdout).slice(-1000)}`);
    writeFileSync(metadataPath(staging), JSON.stringify({ state: 'RUNTIME_READY', fingerprint, createdAt: new Date().toISOString(), lifecycleScripts: 'disabled via --ignore-scripts' }, null, 2));
    if (existsSync(runtimePath)) { rmSync(staging, { recursive: true, force: true }); if (readyRuntime(runtimePath, fingerprint)) return { state: 'RUNTIME_READY', fingerprint, runtimePath, reused: true }; throw new RuntimePreparationError('A concurrent runtime preparation left an invalid runtime.'); }
    renameSync(staging, runtimePath);
    return { state: 'RUNTIME_READY', fingerprint, runtimePath, reused: false };
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    if (error instanceof RuntimePreparationError) throw error;
    throw new RuntimePreparationError(error.message);
  }
}

export function attachRuntimeToWorktree(worktree, runtimePath) {
  const target = join(worktree, 'node_modules');
  if (!existsSync(target)) symlinkSync(join(runtimePath, 'node_modules'), target, 'junction');
  return target;
}
