import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCodex } from './adapters/codex-exec.mjs';
import { runAnthropic } from './adapters/anthropic.mjs';
import { gitDiff, gitHead, gitStatus, gitCommitExists, prepareWorktree, commitAll } from './git.mjs';
import { runProcess } from './process.mjs';
import { requiredTestCommands } from './test-commands.mjs';
import { compareTests, passAllowed, canExecute } from './policy.mjs';
import { notify } from './notify.mjs';
import { redactText } from './redact.mjs';

const active = new Map();
const schema = (name) => fileURLToPath(new URL(`./schemas/${name}.schema.json`, import.meta.url));

function packet(task, preamble = '') {
  return `${preamble ? `Plan-level rules and context (preserved verbatim):\n${preamble}\n\n` : ''}Task ${task.id}: ${task.objective}\n\nAcceptance criteria:\n${task.acceptance}\n\nSource specification:\n${task.source}`;
}

export function isRunning(planId) { return active.has(planId); }
export function cancelPlan(planId) { active.get(planId)?.abort(); }
export function nextCheckpoint(phase) {
  const routes = {
    TECH_LEAD_COMPLETED: 'IMPLEMENTER_PENDING', IMPLEMENTER_COMPLETED: 'TESTS_PENDING',
    TESTS_COMPLETED: 'ASSESSMENT_PENDING', ASSESSMENT_COMPLETED: 'ASSESSMENT_PENDING',
    DEEP_REVIEW_COMPLETED: 'ASSESSMENT_PENDING'
  };
  return routes[phase] || phase;
}

function humanFromOutput(store, planId, taskId, output, fallback) {
  const action = output?.human_action || {};
  store.humanAction({ planId, taskId, title: action.title || 'Human action required', explanation: action.explanation || fallback, whyManual: action.why_manual || 'The available adapter cannot safely perform this action.', service: action.service || 'Local development environment', steps: Array.isArray(action.steps) ? action.steps : ['Review the task details and complete the required action.'], expectedResult: action.expected_result || 'The stated blocker is resolved.' });
}

function atSafeBoundary(store, planId) {
  const status = store.plan(planId)?.status;
  return status === 'RUNNING' ? null : status === 'CANCEL_REQUESTED' ? 'CANCELLED' : status === 'PAUSE_REQUESTED' ? 'PAUSED' : status;
}

async function agentRun(store, config, task, attempt, role, model, cwd, prompt, schemaPath, sandbox, artifactDir, signal, checkpoint = null) {
  const stopped = atSafeBoundary(store, task.plan_id); if (stopped) return { status: stopped, failureSummary: `Stopped at a safe boundary: ${stopped}.` };
  const runId = store.createRun({ planId: task.plan_id, taskId: task.id, attempt, role, adapter: 'codex-cli', model, checkpoint: checkpoint || role });
  store.setTask(task.plan_id, task.id, role === 'IMPLEMENTER' ? 'IMPLEMENTING' : 'TECH_LEAD_REVIEW', { attemptCount: attempt, runId, phase: checkpoint ? `${checkpoint}_RUNNING` : `${role}_RUNNING` });
  store.event('STEP_STARTED', `${role} started for ${task.id}.`, { planId: task.plan_id, taskId: task.id, runId, details: { checkpoint: checkpoint || role } });
  const result = await runCodex({ command: config.codexCommand, model, cwd, prompt, schemaPath, artifactDir, sandbox, timeoutMs: config.agentTimeoutMinutes * 60000, signal });
  store.finishRun(runId, result.status, { exitCode: result.exitCode, externalRunId: result.externalRunId, retryAt: result.retryAt, failureCode: result.failureCode, failureSummary: result.failureSummary, usage: result.usage, result: result.output });
  if (result.status === 'COMPLETED') store.setTask(task.plan_id, task.id, role === 'IMPLEMENTER' ? 'READY' : 'READY', { phase: checkpoint ? `${checkpoint}_COMPLETED` : `${role}_COMPLETED` });
  store.event(result.status === 'COMPLETED' ? 'STEP_COMPLETED' : 'STEP_FAILED', `${role} ${result.status.toLowerCase().replaceAll('_', ' ')} for ${task.id}.`, { planId: task.plan_id, taskId: task.id, runId, level: result.status === 'COMPLETED' ? 'info' : 'warning', details: { checkpoint: checkpoint || role } });
  return result;
}

async function runTests(store, task, attempt, cwd, artifactDir, signal, phase = 'POST') {
  const commands = requiredTestCommands(cwd);
  const results = [];
  mkdirSync(artifactDir, { recursive: true });
  store.setTask(task.plan_id, task.id, 'TESTING', { phase: `${phase === 'POST' ? 'TESTS' : phase}_RUNNING` });
  for (const { command, args, name, entry, available } of commands) {
    const stopped = atSafeBoundary(store, task.plan_id); if (stopped) return results;
    const started = Date.now();
    store.event('TEST_STARTED', `${name} started for ${task.id}.`, { planId: task.plan_id, taskId: task.id });
    const result = available ? await runProcess(command, args, { cwd, timeoutMs: 30 * 60000, signal }) : { exitCode: null, stdout: '', stderr: `Required local test entry point is unavailable: ${entry}` };
    const log = redactText(`${result.stdout}\n${result.stderr}`);
    writeFileSync(join(artifactDir, `test-${name}.log`), log, 'utf8');
    results.push({ name, command, args, exitCode: result.exitCode, status: result.exitCode === 0 ? 'TESTS_PASS' : result.exitCode === null ? 'TEST_EXECUTION_ERROR' : 'TESTS_FAIL', durationMs: Date.now() - started, signature: log.slice(-300), tail: log.slice(-8000) });
    store.event(result.exitCode === 0 ? 'TEST_PASS' : 'TEST_FAIL', `${name} ${result.exitCode === 0 ? 'passed' : 'failed'} for ${task.id}.`, { planId: task.plan_id, taskId: task.id, level: result.exitCode === 0 ? 'info' : 'warning' });
  }
  store.recordTests({ planId: task.plan_id, taskId: task.id, attempt, phase, results });
  if (phase === 'POST' && results.length === commands.length) store.setTask(task.plan_id, task.id, 'READY', { phase: 'TESTS_COMPLETED' });
  return results;
}

async function deepReview(store, config, task, attempt, cwd, artifactDir, context) {
  const runId = store.createRun({ planId: task.plan_id, taskId: task.id, attempt, role: 'REVIEWER', adapter: 'anthropic-api', model: config.reviewerModel });
  store.setTask(task.plan_id, task.id, 'DEEP_REVIEW', { runId });
  store.event('DEEP_REVIEW_STARTED', `Fable review started for ${task.id}.`, { planId: task.plan_id, taskId: task.id, runId });
  const prompt = `You are the independent deep reviewer for ClearSignal. Review the task against the actual diff and tests. Preserve the trust layer and frozen scope. Return JSON only with decision PASS, PASS_WITH_NOTES, FIX_REQUIRED, or BLOCKED; summary; blockers; notes.\n\n${context}`;
  const result = await runAnthropic({ model: config.reviewerModel, prompt, artifactDir: join(artifactDir, 'fable-review'), envPath: join(config.repository, '.env.local'), timeoutMs: config.agentTimeoutMinutes * 60000 });
  if (result.status === 'COMPLETED') {
    const valid = ['PASS', 'PASS_WITH_NOTES', 'FIX_REQUIRED', 'BLOCKED'].includes(result.output?.decision) && typeof result.output?.summary === 'string' && Array.isArray(result.output?.blockers);
    if (!valid) Object.assign(result, { status: 'FAILED', failureCode: 'invalid_output', failureSummary: 'Reviewer output did not satisfy the required contract.' });
  }
  store.finishRun(runId, result.status, { externalRunId: result.externalRunId, retryAt: result.retryAt, failureCode: result.failureCode, failureSummary: result.failureSummary, usage: result.usage });
  return result;
}

async function executeTask(store, config, task, worktree, signal) {
  const basePacket = packet(task, store.planContext(task.plan_id).preamble);
  let fixInstruction = '';
  for (let attempt = task.attempt_count + 1; attempt <= task.max_attempts; attempt++) {
    const artifactDir = join(config.stateRoot, 'artifacts', task.plan_id, task.id, String(attempt));
    mkdirSync(artifactDir, { recursive: true });
    const previousDiff = await gitDiff(worktree);
    const retainedWork = previousDiff ? `\n\nA previous attempt left these uncommitted changes. Treat them as evidence; do not discard them:\n${previousDiff.slice(0, 60000)}${previousDiff.length > 60000 ? '\n[TRUNCATED]' : ''}` : '';
    let implementation = null;
    const resumeAfterImplementation = ['IMPLEMENTER_COMPLETED', 'TESTS_COMPLETED', 'ASSESSMENT_PENDING', 'ASSESSMENT_RUNNING', 'ASSESSMENT_COMPLETED', 'DEEP_REVIEW_COMPLETED'].includes(task.phase);
    if (resumeAfterImplementation) {
      const completed = store.completedRun(task.plan_id, task.id, 'IMPLEMENTER');
      if (!completed) return { status: 'BLOCKED', failureSummary: 'Implementation checkpoint has no persisted completed result.' };
      implementation = { status: 'COMPLETED', output: completed.result };
    } else {
      const leadPrompt = `You are ClearSignal TECH_LEAD. Convert this task into the smallest precise implementation instruction. Do not change product behavior beyond the specification. Return schema-valid JSON. Choose IMPLEMENT unless a genuine human/product blocker exists.\n\n${basePacket}${retainedWork}\n${fixInstruction}`;
      const lead = await agentRun(store, config, task, attempt, 'TECH_LEAD', config.techLeadModel, worktree, leadPrompt, schema('tech-lead'), 'read-only', join(artifactDir, 'techlead-instruction'), signal, 'TECH_LEAD');
      if (lead.status !== 'COMPLETED') return lead;
      if (lead.output.decision === 'HUMAN_ACTION_REQUIRED') { humanFromOutput(store, task.plan_id, task.id, lead.output, lead.output.summary); return { status: 'HUMAN_ACTION_REQUIRED' }; }
      if (lead.output.decision === 'BLOCKED') return { status: 'BLOCKED', failureSummary: lead.output.summary };
      const implementationPrompt = `You are the IMPLEMENTER. Work only in this isolated ClearSignal worktree. Follow AGENTS.md and CLAUDE.md. Do not deploy, push, weaken lib/sanitize.ts or lib/report-validator.ts, bypass human review, or discard existing work. Implement the instruction, run focused tests if useful, and return schema-valid JSON.\n\nTask contract:\n${basePacket}\n\nTECH_LEAD instruction:\n${lead.output.instruction}${fixInstruction}`;
      implementation = await agentRun(store, config, task, attempt, 'IMPLEMENTER', config.implementerModel, worktree, implementationPrompt, schema('implementer'), 'workspace-write', join(artifactDir, 'implementer'), signal, 'IMPLEMENTER');
      if (implementation.status !== 'COMPLETED') return implementation;
    }
    if (implementation.output.completion_status === 'HUMAN_ACTION_REQUIRED') { humanFromOutput(store, task.plan_id, task.id, implementation.output, implementation.output.blocker); return { status: 'HUMAN_ACTION_REQUIRED' }; }
    if (implementation.output.completion_status === 'BLOCKED') return { status: 'BLOCKED', failureSummary: implementation.output.blocker };

    const diff = await gitDiff(worktree);
    writeFileSync(join(artifactDir, 'diff.patch'), redactText(diff), 'utf8');
    const tests = ['TESTS_COMPLETED', 'ASSESSMENT_PENDING', 'ASSESSMENT_RUNNING', 'ASSESSMENT_COMPLETED', 'DEEP_REVIEW_COMPLETED'].includes(task.phase) ? store.tests(task.plan_id, task.id, 'POST').map((item) => ({ name: item.command, exitCode: item.exit_code, status: item.status })) : await runTests(store, task, attempt, worktree, artifactDir, signal);
    const boundary = atSafeBoundary(store, task.plan_id); if (signal.aborted || boundary) return { status: boundary === 'CANCELLED' ? 'CANCELLED' : 'PAUSED', failureSummary: 'Stopped safely; partial worktree and artifacts were preserved.' };
    writeFileSync(join(artifactDir, 'tests.json'), JSON.stringify(tests, null, 2), 'utf8');
    const baseline = store.tests(task.plan_id, task.id, 'BASELINE');
    const testComparison = compareTests(baseline, tests);
    let fableDecision = null;
    const assessmentContext = `${basePacket}\n\nImplementation result:\n${JSON.stringify(implementation.output)}\n\nDiff:\n${diff.slice(0, 60000)}${diff.length > 60000 ? '\n[TRUNCATED]' : ''}\n\nTests:\n${JSON.stringify(tests)}\n\nBaseline results:\n${JSON.stringify(baseline)}\n\nBaseline comparison:\n${JSON.stringify(testComparison)}`;
    const savedAssessment = task.phase === 'ASSESSMENT_COMPLETED' ? store.completedRun(task.plan_id, task.id, 'ASSESSMENT') : null;
    const assessment = savedAssessment ? { status: 'COMPLETED', output: savedAssessment.result } : await agentRun(store, config, task, attempt, 'TECH_LEAD', config.techLeadModel, worktree, `Assess the implementation. Return schema-valid JSON. PASS only if the task and all required tests pass. CODEX_FIX must contain a concise exact instruction. Escalate to DEEP_REVIEW_REQUIRED only for architecture, trust, methodology, high-risk, or genuinely complex ambiguity.\n\n${assessmentContext}`, schema('tech-lead'), 'read-only', join(artifactDir, 'techlead-assessment'), signal, 'ASSESSMENT');
    if (assessment.status !== 'COMPLETED') return assessment;
    let decision = assessment.output.decision;
    if (decision === 'DEEP_REVIEW_REQUIRED') {
      const review = await deepReview(store, config, task, attempt, worktree, artifactDir, assessmentContext);
      if (review.status !== 'COMPLETED') return review;
      fableDecision = review.output.decision;
      if (review.output.decision === 'BLOCKED') return { status: 'BLOCKED', failureSummary: review.output.summary };
      const interpreted = await agentRun(store, config, task, attempt, 'TECH_LEAD', config.techLeadModel, worktree, `Interpret this Fable review into the next routing decision. Return schema-valid JSON. Fable FIX_REQUIRED cannot become PASS without a new implementation/review cycle.\n\n${assessmentContext}\n\nReview:\n${JSON.stringify(review.output)}`, schema('tech-lead'), 'read-only', join(artifactDir, 'techlead-review-interpretation'), signal);
      if (interpreted.status !== 'COMPLETED') return interpreted;
      decision = interpreted.output.decision;
      assessment.output = interpreted.output;
    }
    if (decision === 'PASS' && !passAllowed({ tests, baseline, fableDecision })) decision = 'CODEX_FIX';
    if (decision === 'PASS') {
      const commit = await commitAll(worktree, task.id, implementation.output.summary);
      store.completeTaskCommit({ planId: task.plan_id, taskId: task.id, attempt, sha: commit });
      return { status: 'COMPLETED', commit };
    }
    if (decision === 'HUMAN_ACTION_REQUIRED') { humanFromOutput(store, task.plan_id, task.id, assessment.output, assessment.output.summary); return { status: 'HUMAN_ACTION_REQUIRED' }; }
    if (decision === 'BLOCKED') return { status: 'BLOCKED', failureSummary: assessment.output.summary };
    fixInstruction = `\n\nPrevious assessment blockers:\n${assessment.output.blockers.join('\n')}\n\nExact fix instruction:\n${assessment.output.instruction}`;
  }
  return { status: 'BLOCKED_REQUIRES_ESCALATION', failureSummary: 'Three implementation/review rounds were exhausted.' };
}

export async function runPlan(store, config, planId) {
  if (active.has(planId)) return;
  const controller = new AbortController(); const ownerId = `${process.pid}-${Date.now()}`;
  if (!store.acquireLease('active-plan', ownerId)) { store.event('LEASE_REJECTED', 'Another plan owns the local execution lease.', { planId, level: 'warning' }); return; }
  active.set(planId, controller);
  try {
    const plan = store.plan(planId);
    if (!plan) throw new Error('Plan not found');
    const openAction = store.dashboard(planId).humanActions[0];
    if (!canExecute(openAction ? 1 : 0)) { store.setPlan(planId, 'HUMAN_ACTION_REQUIRED'); return; }
    const dirty = await gitStatus(config.repository);
    const configuredBase = config.executionBaseCommit;
    if (configuredBase && !(await gitCommitExists(config.repository, configuredBase))) {
      store.humanAction({ planId, title: 'Choose a valid committed execution base', explanation: 'The configured execution base does not resolve to a commit in this repository.', whyManual: 'The orchestrator must not infer a base from a dirty checkout.', service: 'Git', steps: ['Set executionBaseCommit to a committed SHA reachable from this repository.'], expectedResult: 'git rev-parse --verify <sha>^{commit} succeeds.' });
      return;
    }
    if (dirty && !configuredBase) {
      store.humanAction({ planId, title: 'Choose a clean Git base', explanation: 'The ClearSignal checkout has uncommitted user-owned changes. Unattended work cannot safely guess whether to include them.', whyManual: 'Automatically stashing, committing, or excluding these changes could lose work or implement against the wrong source.', service: 'Git', steps: ['Review git status in C:\\Claude Code\\clearsignal.', 'Commit the changes that belong in the plan base, or move unrelated work to its own branch.', 'Return here and choose Verify & continue.'], expectedResult: 'git status --porcelain returns no entries.', verification: { type: 'command', command: 'git', args: ['status', '--porcelain'], cwd: config.repository, expectEmpty: true } });
      return;
    }
    const baseCommit = configuredBase || await gitHead(config.repository); store.setPlanBase(planId, baseCommit);
    store.setPlan(planId, 'RUNNING');
    store.event('PLAN_STARTED', `Plan ${plan.name} started.`, { planId });
    const worktree = await prepareWorktree(config.repository, join(config.stateRoot, 'worktrees'), plan.branch, baseCommit, `plan-${plan.id}`);
    while (!controller.signal.aborted) {
      const currentPlan = store.plan(planId);
      if (currentPlan.status === 'PAUSED' || currentPlan.status === 'CANCELLED') break;
      const tasks = store.tasks(planId);
      const done = new Set(tasks.filter((item) => item.status === 'COMPLETED').map((item) => item.id));
      const next = tasks.find((item) => !['COMPLETED', 'CANCELLED'].includes(item.status) && JSON.parse(item.dependencies_json).every((id) => done.has(id)));
      if (!next) {
        if (tasks.every((item) => item.status === 'COMPLETED')) {
          store.setPlan(planId, 'COMPLETED'); store.event('PLAN_COMPLETED', `Plan ${plan.name} completed.`, { planId });
          await notify(config, 'plan_completed', { planId, name: plan.name });
        } else { store.setPlan(planId, 'BLOCKED'); store.event('PLAN_BLOCKED', 'No dependency-ready task exists.', { planId, level: 'error' }); }
        break;
      }
      if (!store.tests(planId, next.id, 'BASELINE').length) {
        store.setTask(planId, next.id, 'TESTING', { phase: 'TESTS_PENDING', worktree, baseCommit });
        const baseline = await runTests(store, next, 0, worktree, join(config.stateRoot, 'artifacts', planId, next.id, 'baseline'), controller.signal, 'BASELINE');
        if (baseline.length !== 3) return;
        store.setTask(planId, next.id, 'READY', { phase: 'BEFORE_IMPLEMENTATION', worktree, baseCommit });
      }
      const result = await executeTask(store, config, next, worktree, controller.signal);
      if (result.status !== 'COMPLETED') {
        if (result.status === 'CANCELLED') {
          store.setTask(planId, next.id, 'CANCELLED', { phase: 'HUMAN_ACTION_PENDING' });
          store.setPlan(planId, 'CANCELLED');
          store.event('PLAN_CANCELLED', 'Cancellation completed at a safe boundary. Partial work and artifacts were preserved.', { planId, taskId: next.id, level: 'warning' });
        } else if (result.status === 'PAUSED') {
          store.setTask(planId, next.id, 'PAUSED'); store.setPlan(planId, 'PAUSED');
          store.event('PLAN_PAUSED', 'Paused at a safe boundary. Partial work and artifacts were preserved.', { planId, taskId: next.id, level: 'warning' });
        } else if (result.status !== 'HUMAN_ACTION_REQUIRED') {
          const paused = ['RATE_LIMITED', 'MODEL_QUOTA_EXHAUSTED', 'AUTH_REQUIRED'].includes(result.status);
          store.setTask(planId, next.id, paused ? 'PAUSED' : 'BLOCKED');
          store.setPlan(planId, paused ? 'PAUSED' : 'BLOCKED');
          store.event(paused ? 'PLAN_PAUSED' : 'PLAN_BLOCKED', result.failureSummary || `${next.id} stopped: ${result.status}.`, { planId, taskId: next.id, level: 'error', details: { status: result.status, retryAt: result.retryAt || null } });
          await notify(config, paused ? 'plan_paused' : 'task_blocked', { planId, taskId: next.id, status: result.status });
        }
        break;
      }
    }
  } catch (error) {
    store.setPlan(planId, 'BLOCKED');
    store.event('UNKNOWN_FAILURE', error.message, { planId, level: 'error' });
  } finally { active.delete(planId); store.releaseLease('active-plan', ownerId); }
}
