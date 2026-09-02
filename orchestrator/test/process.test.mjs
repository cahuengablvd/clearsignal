import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyFailure, runProcess, childEnvironment } from '../src/process.mjs';
import { requiredTestCommands } from '../src/test-commands.mjs';
import { resolve } from 'node:path';

test('closes stdin and captures output', async () => {
  const result = await runProcess(process.execPath, ['-e', "process.stdin.on('data',d=>process.stdout.write(d));"], { input: 'hello' });
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, 'hello');
});

test('classifies quota without inventing a reset', () => {
  assert.deepEqual(classifyFailure({ stdout: '', stderr: 'usage limit reached', timedOut: false }), { status: 'MODEL_QUOTA_EXHAUSTED', code: 'quota_exhausted', retryAt: null });
});

test('does not classify normal model prose as provider state', () => {
  assert.deepEqual(classifyFailure({ stdout: 'I reviewed authentication and retry count 3.', stderr: 'ordinary failure', timedOut: false }), { status: 'UNKNOWN_FAILURE', code: 'process_failed' });
});

test('uses only an explicit structured reset value', () => {
  const result = classifyFailure({ stdout: 'retry count 3', stderr: 'usage limit reached', timedOut: false }, { message: 'usage limit reached' });
  assert.equal(result.retryAt, null);
  assert.equal(classifyFailure({ stderr: '429', timedOut: false }, { message: '429', retryAfterSeconds: 1 }).status, 'RATE_LIMITED');
});

test('fixed Node entry points execute instead of npm.cmd/npx.cmd', async () => {
  const command = requiredTestCommands(resolve('.')).find((item) => item.name === 'tsc');
  assert.equal(command.command, process.execPath);
  assert.equal(command.available, true);
  const result = await runProcess(command.command, [...command.args, '--version'], { cwd: resolve('.'), timeoutMs: 30000 });
  assert.equal(result.exitCode, 0, result.stderr);
});

test('child environment excludes arbitrary founder shell values', () => {
  process.env.ORCHESTRATOR_TEST_SECRET = 'must-not-pass';
  assert.equal(childEnvironment().ORCHESTRATOR_TEST_SECRET, undefined);
  delete process.env.ORCHESTRATOR_TEST_SECRET;
});
