import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../src/db.mjs';
import { nextCheckpoint } from '../src/runner.mjs';

function setup(tasks = ['A1']) {
  const root = mkdtempSync(join(tmpdir(), 'cs-orchestrator-'));
  const path = join(root, 'state.db'); const store = new Store(path);
  const id = store.createPlan({ name: 'x', sha256: 'abc', tasks: tasks.map((task, ordinal) => ({ id: task, ordinal, objective: 'Do it', acceptance: 'Pass', source: 'source', dependencies: ordinal ? [tasks[ordinal - 1]] : [], assignedRole: 'IMPLEMENTER', modelClass: 'standard' })) }, { sourcePath: 'TASKS_X.md', baseCommit: 'deadbeef' });
  return { store, id, path };
}
function completed(store, id, checkpoint, result = { decision: 'PASS' }) {
  const run = store.createRun({ planId: id, taskId: 'A1', attempt: 1, role: checkpoint === 'IMPLEMENTER' ? 'IMPLEMENTER' : 'TECH_LEAD', adapter: 'mock', model: 'mock', checkpoint });
  store.finishRun(run, 'COMPLETED', { result });
  store.setTask(id, 'A1', 'READY', { phase: `${checkpoint}_COMPLETED`, attemptCount: 1, runId: run });
  return run;
}

test('restart after implementation resumes at tests without another implementer invocation', () => {
  const { store, id, path } = setup(); completed(store, id, 'IMPLEMENTER', { completion_status: 'COMPLETED' });
  const restarted = new Store(path);
  assert.equal(restarted.tasks(id)[0].phase, 'IMPLEMENTER_COMPLETED'); assert.equal(nextCheckpoint(restarted.tasks(id)[0].phase), 'TESTS_PENDING');
  assert.equal(restarted.runs(id).filter((run) => run.checkpoint === 'IMPLEMENTER').length, 1);
});
test('restart after tests resumes at assessment without replaying implementation or tests', () => {
  const { store, id, path } = setup(); completed(store, id, 'IMPLEMENTER'); store.setTask(id, 'A1', 'READY', { phase: 'TESTS_COMPLETED' });
  store.recordTests({ planId: id, taskId: 'A1', attempt: 1, phase: 'POST', results: [{ name: 'mock', exitCode: 0, status: 'TESTS_PASS', durationMs: 1 }] });
  const restarted = new Store(path); assert.equal(nextCheckpoint(restarted.tasks(id)[0].phase), 'ASSESSMENT_PENDING'); assert.equal(restarted.tests(id, 'A1', 'POST').length, 1);
});
test('interrupted assessment is retryable without replaying implementation', () => {
  const { store, id } = setup(); completed(store, id, 'IMPLEMENTER'); store.setTask(id, 'A1', 'TECH_LEAD_REVIEW', { phase: 'ASSESSMENT_RUNNING' });
  const run = store.createRun({ planId: id, taskId: 'A1', attempt: 1, role: 'TECH_LEAD', adapter: 'mock', model: 'mock', checkpoint: 'ASSESSMENT' }); store.setPlan(id, 'RUNNING'); store.reconcileRunning();
  assert.equal(store.runs(id).find((item) => item.id === run).status, 'INTERRUPTED_RETRY_REQUIRED'); assert.equal(store.tasks(id)[0].phase, 'ASSESSMENT_INTERRUPTED_RETRY_REQUIRED'); assert.equal(store.runs(id).filter((item) => item.checkpoint === 'IMPLEMENTER').length, 1);
});
test('completed assessment result survives restart and is reusable', () => {
  const { store, id, path } = setup(); completed(store, id, 'ASSESSMENT', { decision: 'CODEX_FIX', blockers: ['x'] }); const restarted = new Store(path);
  assert.deepEqual(restarted.completedRun(id, 'A1', 'ASSESSMENT').result.blockers, ['x']);
});
test('open HumanAction remains a hard gate across restart and failed verification', () => {
  const { store, id, path } = setup(); const action = store.humanAction({ planId: id, taskId: 'A1', title: 'Act', explanation: 'Why', whyManual: 'Manual', service: 'Git', steps: ['step'], expectedResult: 'done' });
  const restarted = new Store(path); restarted.startActionVerification(action); restarted.failActionVerification(action, 'still dirty');
  assert.equal(restarted.action(action).status, 'VERIFICATION_FAILED'); assert.equal(restarted.dashboard(id).humanActions.length, 1); assert.equal(restarted.plan(id).status, 'HUMAN_ACTION_REQUIRED');
});
test('pause and cancel transitions are event-reconstructable and cancel never blocks', () => {
  const { store, id } = setup(); store.setPlan(id, 'RUNNING'); store.setPlan(id, 'PAUSE_REQUESTED'); store.setPlan(id, 'PAUSED'); store.setPlan(id, 'RUNNING'); store.setPlan(id, 'CANCEL_REQUESTED'); store.setPlan(id, 'CANCELLED');
  const types = store.events(id).map((event) => event.type); for (const type of ['PLAN_PAUSE_REQUESTED', 'PLAN_PAUSED', 'PLAN_CANCEL_REQUESTED', 'PLAN_CANCELLED']) assert.ok(types.includes(type)); assert.equal(store.plan(id).status, 'CANCELLED');
});
test('dependent plan retains completed task when task two is interrupted', () => {
  const { store, id } = setup(['A1', 'A2', 'A3']); store.setTask(id, 'A1', 'COMPLETED', { phase: 'COMPLETED' }); const run = store.createRun({ planId: id, taskId: 'A2', attempt: 1, role: 'IMPLEMENTER', adapter: 'mock', model: 'mock', checkpoint: 'IMPLEMENTER' }); store.setPlan(id, 'RUNNING'); store.reconcileRunning();
  assert.equal(store.tasks(id)[0].status, 'COMPLETED'); assert.equal(store.runs(id).find((item) => item.id === run).status, 'INTERRUPTED_RETRY_REQUIRED');
});
