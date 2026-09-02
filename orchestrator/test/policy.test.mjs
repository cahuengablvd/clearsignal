import test from 'node:test';
import assert from 'node:assert/strict';
import { canExecute, compareTests, passAllowed } from '../src/policy.mjs';

const baseline = [{ command: 'tsc --noEmit', exit_code: 0 }, { command: 'vitest run', exit_code: 0 }, { command: 'build', exit_code: 0 }];
const green = [{ name: 'tsc', exitCode: 0 }, { name: 'vitest', exitCode: 0 }, { name: 'build', exitCode: 0 }];

test('PASS is impossible after failed or missing required tests', () => {
  assert.equal(passAllowed({ tests: [{ ...green[0], exitCode: 1 }, ...green.slice(1)], baseline }), false);
  assert.equal(passAllowed({ tests: green.slice(0, 2), baseline }), false);
});

test('Fable BLOCKED or FIX_REQUIRED cannot become PASS', () => {
  assert.equal(passAllowed({ tests: green, baseline, fableDecision: 'BLOCKED' }), false);
  assert.equal(passAllowed({ tests: green, baseline, fableDecision: 'FIX_REQUIRED' }), false);
});

test('baseline comparison distinguishes new and unchanged failures', () => {
  assert.deepEqual(compareTests([{ command: 'tsc --noEmit', exit_code: 1 }], [{ name: 'tsc', exitCode: 1 }, { name: 'vitest', exitCode: 1 }]).map((item) => item.status), ['UNCHANGED_FAILURE', 'NEW_STAGE']);
});

test('an open HumanAction is a deterministic execution blocker', () => {
  assert.equal(canExecute(1), false);
  assert.equal(canExecute(0), true);
});
