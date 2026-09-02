import { runProcess } from './process.mjs';

export async function verifyAction(store, actionId) {
  const action = store.action(actionId);
  if (!action || !['OPEN', 'VERIFICATION_FAILED'].includes(action.status)) throw new Error('Action is not awaiting verification');
  if (action.status === 'VERIFICATION_FAILED') store.reopenAction(actionId);
  store.startActionVerification(actionId);
  const verification = JSON.parse(action.verification_json);
  if (verification.type === 'manual_only') { store.failActionVerification(actionId, 'No safe automatic verifier exists.'); return { ok: false, message: 'This action has no safe automatic verifier.' }; }
  if (verification.type !== 'command') { store.failActionVerification(actionId, `Unsupported verifier: ${verification.type}`); return { ok: false, message: `Unsupported verifier: ${verification.type}` }; }
  const allowed = new Set(['git']);
  if (!allowed.has(verification.command)) { store.failActionVerification(actionId, 'Verifier command is not allowed.'); return { ok: false, message: 'Verifier command is not allowed.' }; }
  const result = await runProcess(verification.command, verification.args || [], { cwd: verification.cwd, timeoutMs: 30000 });
  const ok = result.exitCode === 0 && (!verification.expectEmpty || !result.stdout.trim());
  if (!ok) {
    store.failActionVerification(actionId, result.stderr.trim() || result.stdout.trim() || `Command exited ${result.exitCode}.`);
    return { ok: false, message: result.stderr.trim() || result.stdout.trim() || `Command exited ${result.exitCode}.` };
  }
  store.resolveAction(actionId);
  return { ok: true, message: 'Verified. The plan can continue.' };
}
