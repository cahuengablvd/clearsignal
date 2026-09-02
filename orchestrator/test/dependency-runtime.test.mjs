import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';
import { RuntimePreparationError, dependencyFingerprint, prepareDependencyRuntime } from '../src/dependency-runtime.mjs';

function fixture() {
  const repository = mkdtempSync(join(tmpdir(), 'cs-runtime-repo-'));
  writeFileSync(join(repository, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0', dependencies: { x: '1.0.0' } }));
  writeFileSync(join(repository, 'package-lock.json'), JSON.stringify({ name: 'fixture', lockfileVersion: 3, packages: { '': { name: 'fixture', version: '1.0.0', dependencies: { x: '1.0.0' } }, 'node_modules/x': { version: '1.0.0' } } }));
  return { repository };
}
function successfulNpm(calls) { return async (_command, _args, { cwd }) => { calls.push(cwd); for (const entry of ['typescript/bin/tsc', 'vitest/vitest.mjs', 'next/dist/bin/next']) { const file = join(cwd, 'node_modules', entry); mkdirSync(join(file, '..'), { recursive: true }); writeFileSync(file, ''); } return { exitCode: 0, stdout: '', stderr: '' }; }; }

test('dependency fingerprint is stable and changes with the lockfile', () => {
  const { repository } = fixture(); const lock = join(repository, 'package-lock.json'); const first = dependencyFingerprint(lock);
  writeFileSync(lock, `${readFileSync(lock, 'utf8')}\n`); assert.notEqual(dependencyFingerprint(lock), first);
});
test('runtime is prepared inside, and never sourced from outside, the isolated worktree', async () => {
  const { repository } = fixture(); const calls = [];
  const first = await prepareDependencyRuntime({ repository, npmCliPath: 'npm-cli.js', run: successfulNpm(calls) });
  const second = await prepareDependencyRuntime({ repository, npmCliPath: 'npm-cli.js', run: successfulNpm(calls) });
  assert.equal(first.runtimePath, repository); assert.equal(first.strategy, 'isolated-worktree-npm-ci'); assert.equal(second.reused, true); assert.equal(calls.length, 1);
  assert.equal(JSON.parse(readFileSync(join(repository, 'node_modules', '.clearsignal-orchestrator-runtime.json'))).fingerprint, first.fingerprint);
});
test('changed lockfile invalidates the installed runtime', async () => {
  const { repository } = fixture(); const calls = [];
  await prepareDependencyRuntime({ repository, npmCliPath: 'npm-cli.js', run: successfulNpm(calls) });
  writeFileSync(join(repository, 'package-lock.json'), `${readFileSync(join(repository, 'package-lock.json'), 'utf8')}\n`);
  const rebuilt = await prepareDependencyRuntime({ repository, npmCliPath: 'npm-cli.js', run: successfulNpm(calls) });
  assert.equal(rebuilt.reused, false); assert.equal(calls.length, 2);
});
test('dependency preparation failure blocks execution and leaves no ready marker', async () => {
  const { repository } = fixture();
  await assert.rejects(() => prepareDependencyRuntime({ repository, npmCliPath: 'npm-cli.js', run: async () => ({ exitCode: 1, stdout: '', stderr: 'offline' }) }), RuntimePreparationError);
  assert.equal(existsSync(join(repository, 'node_modules', '.clearsignal-orchestrator-runtime.json')), false);
});
test('inconsistent package and lock files are an infrastructure error', async () => {
  const { repository } = fixture(); writeFileSync(join(repository, 'package.json'), JSON.stringify({ dependencies: { x: '2.0.0' } }));
  await assert.rejects(() => prepareDependencyRuntime({ repository, npmCliPath: 'npm-cli.js', run: successfulNpm([]) }), /disagree/);
});
