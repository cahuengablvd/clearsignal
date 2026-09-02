import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlanText } from '../src/plan-parser.mjs';

test('extracts stable task headings in source order', () => {
  const plan = parsePlanText('# Plan\n## A1 - First\n### Acceptance criteria\n- one\n## A2.1 - Second\nbody\n## A5a - Third', 'TASKS_X.md');
  assert.deepEqual(plan.tasks.map((task) => task.id), ['A1', 'A2.1', 'A5A']);
  assert.deepEqual(plan.tasks[1].dependencies, ['A1']);
  assert.match(plan.tasks[0].acceptance, /one/);
});

test('falls back to one task when headings are prose', () => {
  const plan = parsePlanText('# Link preview\n## The problem\ntext', 'TASKS_LINK_PREVIEW.md');
  assert.equal(plan.tasks.length, 1);
  assert.equal(plan.tasks[0].id, 'LINK-PREVIEW');
});

test('rejects duplicate stable ids', () => {
  assert.throws(() => parsePlanText('## A1 - One\n## A1 - Two'), /Duplicate/);
});

test('preserves plan-level constraints and explicit dependencies', () => {
  const plan = parsePlanText('# Plan\n\nDo not deploy.\n## A1 - First\nbody\n## A2 - Second\nDepends on: A1\n', 'TASKS_X.md');
  assert.match(plan.preamble, /Do not deploy/);
  assert.deepEqual(plan.tasks[1].dependencies, ['A1']);
});
