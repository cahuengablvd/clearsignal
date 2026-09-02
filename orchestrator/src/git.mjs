import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { runProcess } from './process.mjs';
import { attachRuntimeToWorktree, prepareDependencyRuntime } from './dependency-runtime.mjs';

async function git(repo, args) {
  const result = await runProcess('git', args, { cwd: repo, timeoutMs: 120000 });
  if (result.exitCode !== 0) throw new Error(`git ${args[0]} failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

export const gitHead = (repo) => git(repo, ['rev-parse', 'HEAD']);
export async function gitCommitExists(repo, sha) {
  return (await runProcess('git', ['rev-parse', '--verify', `${sha}^{commit}`], { cwd: repo, timeoutMs: 30000 })).exitCode === 0;
}
export const gitStatus = (repo) => git(repo, ['status', '--porcelain']);
export async function gitDiff(repo) {
  // Intent-to-add makes new files visible in the review diff without staging their content.
  await git(repo, ['add', '-N', '--', '.']);
  return git(repo, ['diff', '--binary', 'HEAD']);
}
export async function gitChangedPaths(repo) { return (await git(repo, ['diff', '--name-only', 'HEAD'])).split(/\r?\n/).filter(Boolean); }

export async function prepareWorktree(repo, root, branch, baseCommit, taskKey, runtimeOptions) {
  mkdirSync(root, { recursive: true });
  const path = join(root, taskKey.replace(/[^A-Za-z0-9._-]/g, '-'));
  if (!existsSync(path)) {
    const branchExists = (await runProcess('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: repo })).exitCode === 0;
    const args = branchExists ? ['worktree', 'add', path, branch] : ['worktree', 'add', '-b', branch, path, baseCommit];
    await git(repo, args);
  }
  const runtime = await prepareDependencyRuntime({ repository: path, ...runtimeOptions });
  await attachRuntimeToWorktree(path, runtime.runtimePath);
  return { path, runtime };
}

export async function commitAll(repo, taskId, summary) {
  const paths = await gitChangedPaths(repo);
  if (!paths.length) return gitHead(repo);
  await git(repo, ['add', '--', ...paths]);
  const staged = await git(repo, ['diff', '--cached', '--name-only']);
  if (!staged) return gitHead(repo);
  await git(repo, ['commit', '-m', `${taskId}: ${summary.slice(0, 60)}`]);
  return gitHead(repo);
}
