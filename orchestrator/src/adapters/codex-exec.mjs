import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runProcess, classifyFailure } from '../process.mjs';
import { redactText } from '../redact.mjs';

export async function runCodex({ command = 'codex', model, cwd, prompt, schemaPath, artifactDir, sandbox = 'read-only', timeoutMs, signal, env }) {
  mkdirSync(artifactDir, { recursive: true });
  const resultPath = join(artifactDir, 'result.json');
  const args = ['exec', '--json', '--output-schema', schemaPath, '--output-last-message', resultPath, '-m', model, '-s', sandbox, '-c', 'approval_policy="never"', '-C', cwd, '-'];
  const processResult = await runProcess(command, args, { cwd, input: prompt, timeoutMs, signal, env });
  writeFileSync(join(artifactDir, 'agent-events.jsonl'), redactText(processResult.stdout), 'utf8');
  writeFileSync(join(artifactDir, 'stderr.log'), redactText(processResult.stderr), 'utf8');
  const events = processResult.stdout.split(/\r?\n/).filter(Boolean).flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } });
  const externalRunId = events.find((event) => event.type === 'thread.started')?.thread_id || null;
  const usage = events.findLast((event) => event.type === 'turn.completed')?.usage || {};
  const errorEvent = events.findLast((event) => event.type === 'error' || event.type === 'turn.failed' || event.error);
  const structuredError = errorEvent?.error && typeof errorEvent.error === 'object' ? { message: errorEvent.error.message || errorEvent.error.type, retryAt: errorEvent.error.retry_at, retryAfterSeconds: errorEvent.error.retry_after_seconds } : null;
  if (processResult.exitCode !== 0) return { ...classifyFailure(processResult, structuredError), ...processResult, externalRunId, usage };
  try {
    const output = JSON.parse(readFileSync(resultPath, 'utf8'));
    return { status: 'COMPLETED', output, exitCode: 0, externalRunId, usage };
  } catch (error) {
    return { status: 'FAILED', failureCode: 'invalid_output', failureSummary: error.message, exitCode: 0, externalRunId, usage };
  }
}
