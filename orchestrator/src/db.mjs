import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export class Store {
  constructor(path) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS plans(id TEXT PRIMARY KEY,name TEXT NOT NULL,source_path TEXT NOT NULL,source_sha256 TEXT NOT NULL,base_commit TEXT NOT NULL,branch TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tasks(id TEXT NOT NULL,plan_id TEXT NOT NULL,ordinal INTEGER NOT NULL,objective TEXT NOT NULL,acceptance TEXT NOT NULL,source TEXT NOT NULL,dependencies_json TEXT NOT NULL,assigned_role TEXT NOT NULL,model_class TEXT NOT NULL,status TEXT NOT NULL,attempt_count INTEGER NOT NULL DEFAULT 0,max_attempts INTEGER NOT NULL,current_run_id TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(plan_id,id),FOREIGN KEY(plan_id) REFERENCES plans(id));
      CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,plan_id TEXT NOT NULL,task_id TEXT NOT NULL,attempt INTEGER NOT NULL,role TEXT NOT NULL,adapter TEXT NOT NULL,model TEXT,status TEXT NOT NULL,started_at TEXT NOT NULL,ended_at TEXT,exit_code INTEGER,external_run_id TEXT,retry_at TEXT,failure_code TEXT,failure_summary TEXT,usage_json TEXT NOT NULL DEFAULT '{}',result_json TEXT,checkpoint TEXT);
      CREATE TABLE IF NOT EXISTS test_results(id INTEGER PRIMARY KEY AUTOINCREMENT,plan_id TEXT NOT NULL,task_id TEXT NOT NULL,attempt INTEGER NOT NULL,phase TEXT NOT NULL,command TEXT NOT NULL,status TEXT NOT NULL,exit_code INTEGER,duration_ms INTEGER NOT NULL,signature TEXT,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS commits(id INTEGER PRIMARY KEY AUTOINCREMENT,plan_id TEXT NOT NULL,task_id TEXT NOT NULL,attempt INTEGER NOT NULL,sha TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS leases(name TEXT PRIMARY KEY,owner_id TEXT NOT NULL,expires_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS plan_context(plan_id TEXT PRIMARY KEY,preamble TEXT NOT NULL,raw_text TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS human_actions(id TEXT PRIMARY KEY,plan_id TEXT NOT NULL,task_id TEXT,status TEXT NOT NULL,title TEXT NOT NULL,explanation TEXT NOT NULL,why_manual TEXT NOT NULL,service TEXT NOT NULL,steps_json TEXT NOT NULL,expected_result TEXT NOT NULL,verification_json TEXT NOT NULL,created_at TEXT NOT NULL,resolved_at TEXT);
      CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT,plan_id TEXT,task_id TEXT,run_id TEXT,type TEXT NOT NULL,level TEXT NOT NULL,public_message TEXT NOT NULL,details_json TEXT NOT NULL,created_at TEXT NOT NULL);
    `);
    for (const column of ['phase TEXT NOT NULL DEFAULT \'TECH_LEAD_PENDING\'', 'worktree TEXT', 'base_commit TEXT']) {
      try { this.db.exec(`ALTER TABLE tasks ADD COLUMN ${column}`); } catch {}
    }
    try { this.db.exec('ALTER TABLE runs ADD COLUMN result_json TEXT'); } catch {}
    try { this.db.exec('ALTER TABLE runs ADD COLUMN checkpoint TEXT'); } catch {}
  }

  now() { return new Date().toISOString(); }
  event(type, message, { planId = null, taskId = null, runId = null, level = 'info', details = {} } = {}) {
    this.db.prepare('INSERT INTO events(plan_id,task_id,run_id,type,level,public_message,details_json,created_at) VALUES(?,?,?,?,?,?,?,?)').run(planId, taskId, runId, type, level, message, JSON.stringify(details), this.now());
  }
  createPlan(parsed, { sourcePath, baseCommit, maxAttempts = 3 }) {
    const id = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
    const now = this.now();
    const branch = `codex/orchestrator/${id}`;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT INTO plans VALUES(?,?,?,?,?,?,?,?,?)').run(id, parsed.name, sourcePath, parsed.sha256, baseCommit, branch, 'READY', now, now);
      this.db.prepare('INSERT INTO plan_context(plan_id,preamble,raw_text) VALUES(?,?,?)').run(id, parsed.preamble || '', parsed.raw || '');
      const insert = this.db.prepare('INSERT INTO tasks(id,plan_id,ordinal,objective,acceptance,source,dependencies_json,assigned_role,model_class,status,attempt_count,max_attempts,current_run_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
      for (const task of parsed.tasks) insert.run(task.id, id, task.ordinal, task.objective, task.acceptance, task.source, JSON.stringify(task.dependencies), task.assignedRole, task.modelClass, 'READY', 0, maxAttempts, null, now, now);
      this.event('PLAN_IMPORTED', `Imported ${parsed.tasks.length} task(s) from ${parsed.name}.`, { planId: id });
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return id;
  }
  plans() { return this.db.prepare('SELECT * FROM plans ORDER BY created_at DESC').all(); }
  plan(id) { return this.db.prepare('SELECT * FROM plans WHERE id=?').get(id); }
  planContext(id) { return this.db.prepare('SELECT * FROM plan_context WHERE plan_id=?').get(id) || { preamble: '', raw_text: '' }; }
  tasks(id) { return this.db.prepare('SELECT * FROM tasks WHERE plan_id=? ORDER BY ordinal').all(id); }
  events(id, limit = 100) { return this.db.prepare('SELECT * FROM events WHERE plan_id=? ORDER BY seq DESC LIMIT ?').all(id, limit).reverse(); }
  dashboard(id) {
    const plan = id ? this.plan(id) : this.plans()[0];
    if (!plan) return { plan: null, tasks: [], events: [], humanActions: [] };
    return { plan, tasks: this.tasks(plan.id), events: this.events(plan.id), humanActions: this.db.prepare("SELECT * FROM human_actions WHERE plan_id=? AND status<>'VERIFIED' ORDER BY created_at").all(plan.id) };
  }
  setPlan(id, status, expected = null) {
    const statement = expected === null ? 'UPDATE plans SET status=?,updated_at=? WHERE id=?' : 'UPDATE plans SET status=?,updated_at=? WHERE id=? AND status=?';
    const result = expected === null ? this.db.prepare(statement).run(status, this.now(), id) : this.db.prepare(statement).run(status, this.now(), id, expected);
    if (expected !== null && result.changes !== 1) throw new Error(`Plan transition rejected: expected ${expected}`);
    if (result.changes) this.event(`PLAN_${status}`, `Plan state changed to ${status}.`, { planId: id, details: { status } });
  }
  setPlanBase(id, baseCommit) { this.db.prepare('UPDATE plans SET base_commit=?,updated_at=? WHERE id=?').run(baseCommit, this.now(), id); }
  setTask(planId, taskId, status, patch = {}) {
    const expected = patch.expected ?? null;
    const sql = `UPDATE tasks SET status=?,attempt_count=COALESCE(?,attempt_count),current_run_id=COALESCE(?,current_run_id),phase=COALESCE(?,phase),worktree=COALESCE(?,worktree),base_commit=COALESCE(?,base_commit),updated_at=? WHERE plan_id=? AND id=?${expected === null ? '' : ' AND status=?'}`;
    const values = [status, patch.attemptCount ?? null, patch.runId ?? null, patch.phase ?? null, patch.worktree ?? null, patch.baseCommit ?? null, this.now(), planId, taskId];
    if (expected !== null) values.push(expected);
    const result = this.db.prepare(sql).run(...values);
    if (expected !== null && result.changes !== 1) throw new Error(`Task transition rejected: expected ${expected}`);
    if (result.changes) this.event(`TASK_${status}`, `${taskId} state changed to ${status}.`, { planId, taskId, details: { status, phase: patch.phase ?? null } });
  }
  transitionTask(planId, taskId, expected, status, patch = {}) { this.setTask(planId, taskId, status, { ...patch, expected }); }
  createRun({ planId, taskId, attempt, role, adapter, model, checkpoint = role }) {
    const id = randomUUID();
    this.db.prepare('INSERT INTO runs(id,plan_id,task_id,attempt,role,adapter,model,status,started_at,checkpoint) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id, planId, taskId, attempt, role, adapter, model, 'RUNNING', this.now(), checkpoint);
    return id;
  }
  finishRun(id, status, patch = {}) {
    this.db.prepare('UPDATE runs SET status=?,ended_at=?,exit_code=?,external_run_id=?,retry_at=?,failure_code=?,failure_summary=?,usage_json=?,result_json=? WHERE id=?').run(status, this.now(), patch.exitCode ?? null, patch.externalRunId ?? null, patch.retryAt ?? null, patch.failureCode ?? null, patch.failureSummary ?? null, JSON.stringify(patch.usage || {}), patch.result === undefined ? null : JSON.stringify(patch.result), id);
  }
  runs(planId) { return this.db.prepare('SELECT * FROM runs WHERE plan_id=? ORDER BY started_at').all(planId); }
  completedRun(planId, taskId, checkpoint) {
    const run = this.db.prepare("SELECT * FROM runs WHERE plan_id=? AND task_id=? AND checkpoint=? AND status='COMPLETED' AND result_json IS NOT NULL ORDER BY ended_at DESC LIMIT 1").get(planId, taskId, checkpoint);
    return run ? { ...run, result: JSON.parse(run.result_json) } : null;
  }
  recordTests({ planId, taskId, attempt, phase, results }) {
    const insert = this.db.prepare('INSERT INTO test_results(plan_id,task_id,attempt,phase,command,status,exit_code,duration_ms,signature,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)');
    for (const item of results) insert.run(planId, taskId, attempt, phase, `${item.command || item.name} ${Array.isArray(item.args) ? item.args.join(' ') : ''}`.trim(), item.status, item.exitCode, item.durationMs, item.signature || null, this.now());
  }
  completeTaskCommit({ planId, taskId, attempt, sha }) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT INTO commits(plan_id,task_id,attempt,sha,created_at) VALUES(?,?,?,?,?)').run(planId, taskId, attempt, sha, this.now());
      this.setTask(planId, taskId, 'COMPLETED', { phase: 'ASSESSMENT_FINISHED', attemptCount: attempt });
      this.event('TASK_COMPLETED', `${taskId} completed at ${sha.slice(0, 7)}.`, { planId, taskId, details: { commit: sha } });
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  tests(planId, taskId, phase) { return this.db.prepare('SELECT * FROM test_results WHERE plan_id=? AND task_id=? AND phase=? ORDER BY id').all(planId, taskId, phase); }
  acquireLease(name, ownerId, ttlMs = 5 * 60000) {
    const expires = new Date(Date.now() + ttlMs).toISOString(); const now = this.now();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const held = this.db.prepare('SELECT * FROM leases WHERE name=?').get(name);
      if (held && held.expires_at > now && held.owner_id !== ownerId) { this.db.exec('ROLLBACK'); return false; }
      this.db.prepare('INSERT INTO leases(name,owner_id,expires_at) VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET owner_id=excluded.owner_id,expires_at=excluded.expires_at').run(name, ownerId, expires);
      this.db.exec('COMMIT'); return true;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  releaseLease(name, ownerId) { this.db.prepare('DELETE FROM leases WHERE name=? AND owner_id=?').run(name, ownerId); }
  reconcileRunning() {
    const runs = this.db.prepare("SELECT * FROM runs WHERE status='RUNNING'").all();
    for (const run of runs) {
      const phase = `${run.role}_INTERRUPTED_RETRY_REQUIRED`;
      this.finishRun(run.id, 'INTERRUPTED_RETRY_REQUIRED', { failureCode: 'orphaned_restart', failureSummary: 'Orchestrator restarted during this invocation; only this step may be retried.' });
      this.setTask(run.plan_id, run.task_id, 'READY', { phase });
      const plan = this.plan(run.plan_id);
      if (plan?.status !== 'CANCELLED') this.setPlan(run.plan_id, 'READY');
      this.event('STEP_INTERRUPTED', 'A restart interrupted an external invocation; completed earlier steps are retained.', { planId: run.plan_id, taskId: run.task_id, runId: run.id, level: 'warning', details: { role: run.role } });
      this.event('STEP_RETRY_REQUIRED', `Only ${run.role} requires deliberate retry.`, { planId: run.plan_id, taskId: run.task_id, runId: run.id, level: 'warning' });
    }
  }
  humanAction({ planId, taskId = null, title, explanation, whyManual, service, steps, expectedResult, verification = { type: 'manual_only' } }) {
    const id = randomUUID();
    this.db.prepare('INSERT INTO human_actions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,NULL)').run(id, planId, taskId, 'OPEN', title, explanation, whyManual, service, JSON.stringify(steps), expectedResult, JSON.stringify(verification), this.now());
    this.setPlan(planId, 'HUMAN_ACTION_REQUIRED');
    this.event('HUMAN_ACTION_OPENED', title, { planId, taskId, level: 'warning', details: { actionId: id, service } });
    return id;
  }
  action(id) { return this.db.prepare('SELECT * FROM human_actions WHERE id=?').get(id); }
  resolveAction(id) {
    const action = this.action(id);
    if (!action || action.status !== 'VERIFYING') throw new Error('Human action is not being verified');
    const now = this.now();
    this.db.prepare("UPDATE human_actions SET status='VERIFIED',resolved_at=? WHERE id=?").run(now, id);
    if (action.task_id) this.setTask(action.plan_id, action.task_id, 'READY');
    this.setPlan(action.plan_id, 'READY');
    this.event('HUMAN_ACTION_VERIFIED', `Verified: ${action.title}`, { planId: action.plan_id, taskId: action.task_id, details: { actionId: id } });
    return action;
  }
  startActionVerification(id) {
    const action = this.action(id); if (!action || action.status !== 'OPEN') throw new Error('Open human action not found');
    this.db.prepare("UPDATE human_actions SET status='VERIFYING' WHERE id=?").run(id);
    this.event('HUMAN_ACTION_VERIFYING', `Verifying: ${action.title}`, { planId: action.plan_id, taskId: action.task_id, details: { actionId: id } });
    return this.action(id);
  }
  failActionVerification(id, message) {
    const action = this.action(id); if (!action) throw new Error('Human action not found');
    this.db.prepare("UPDATE human_actions SET status='VERIFICATION_FAILED' WHERE id=?").run(id);
    this.setPlan(action.plan_id, 'HUMAN_ACTION_REQUIRED');
    this.event('HUMAN_ACTION_VERIFICATION_FAILED', `Verification failed: ${action.title}`, { planId: action.plan_id, taskId: action.task_id, level: 'warning', details: { actionId: id, message } });
  }
  reopenAction(id) {
    const action = this.action(id); if (!action || action.status !== 'VERIFICATION_FAILED') throw new Error('Failed human action not found');
    this.db.prepare("UPDATE human_actions SET status='OPEN' WHERE id=?").run(id);
    this.event('HUMAN_ACTION_REOPENED', `Waiting for correction: ${action.title}`, { planId: action.plan_id, taskId: action.task_id, details: { actionId: id } });
  }
}
