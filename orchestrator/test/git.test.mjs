import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runProcess } from '../src/process.mjs';
import { commitAll, ConcurrentRepositoryChangeError, gitHead } from '../src/git.mjs';

async function run(repo, args) { const result = await runProcess('git', args, { cwd: repo }); assert.equal(result.exitCode, 0, result.stderr); return result.stdout.trim(); }
async function repository() {
  const path = mkdtempSync(join(tmpdir(), 'cs-git-')); await run(path, ['init']); await run(path, ['config', 'user.email', 'test@example.invalid']); await run(path, ['config', 'user.name', 'Test']);
  writeFileSync(join(path, 'base.txt'), 'base'); await run(path, ['add', 'base.txt']); await run(path, ['commit', '-m', 'base']); return path;
}
test('matching expected HEAD permits a new commit', async () => {
  const repo = await repository(); const expected = await gitHead(repo); writeFileSync(join(repo, 'base.txt'), 'change');
  const commit = await commitAll(repo, 'A1', 'safe commit', { expectedHead: expected });
  assert.notEqual(commit, expected); assert.equal((await run(repo, ['log', '-1', '--format=%s'])).startsWith('A1: safe commit'), true);
});
test('changed HEAD refuses commit and preserves the newer head', async () => {
  const repo = await repository(); const expected = await gitHead(repo); writeFileSync(join(repo, 'outside.txt'), 'new head'); await run(repo, ['add', 'outside.txt']); await run(repo, ['commit', '-m', 'external']); const observed = await gitHead(repo);
  writeFileSync(join(repo, 'base.txt'), 'task');
  await assert.rejects(() => commitAll(repo, 'A1', 'must not commit', { expectedHead: expected }), (error) => error instanceof ConcurrentRepositoryChangeError && error.expectedHead === expected && error.observedHead === observed);
  assert.equal(await gitHead(repo), observed); assert.equal((await run(repo, ['log', '-1', '--format=%s'])), 'external');
});
