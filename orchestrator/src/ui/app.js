let state = { csrf: '', plan: null, humanActions: [] };
const $ = (id) => document.getElementById(id);
async function api(path, options = {}) { const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', 'x-orchestrator-csrf': state.csrf, ...(options.headers || {}) } }); const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; }
function render(data) {
  state = data; $('connection').textContent = data.running ? 'Running' : 'Idle'; $('empty').hidden = !!data.plan; $('dashboard').hidden = !data.plan;
  $('message').textContent = data.codex?.ok ? '' : (data.codex?.message || 'Codex configuration has not been verified.');
  if (!data.plan) return;
  $('planName').textContent = data.plan.name; $('status').textContent = data.plan.status;
  const completed = data.tasks.filter((task) => task.status === 'COMPLETED').length; $('progress').textContent = `${completed} / ${data.tasks.length} tasks completed`;
  const task = data.tasks.find((item) => item.status !== 'COMPLETED') || data.tasks.at(-1); $('taskName').textContent = task ? `${task.id} - ${task.objective}` : '-'; $('agent').textContent = task?.status === 'TECH_LEAD_REVIEW' ? 'TECH_LEAD' : task?.assigned_role || '-'; $('attempt').textContent = task ? `${task.attempt_count} / ${task.max_attempts}` : '-';
  const lastTest = [...data.events].reverse().find((event) => event.type.startsWith('TEST_')); $('tests').textContent = lastTest?.type.replace('TEST_', '') || '-';
  $('events').replaceChildren(...data.events.slice(-40).reverse().map((event) => { const row = document.createElement('p'); row.className = `event ${event.level}`; row.textContent = `${new Date(event.created_at).toLocaleTimeString()}  ${event.public_message}`; return row; }));
  const action = data.humanActions[0]; $('actionCard').hidden = !action;
  if (action) { $('actionTitle').textContent = action.title; $('actionWhy').textContent = action.explanation; $('actionExpected').textContent = action.expected_result; $('actionSteps').replaceChildren(...JSON.parse(action.steps_json).map((step) => { const li = document.createElement('li'); li.textContent = step; return li; })); $('verify').onclick = async () => { const result = await api(`/api/human-actions/${action.id}/verify`, { method: 'POST' }); $('message').textContent = result.message; await refresh(); }; }
}
async function refresh() { try { render(await api('/api/state')); } catch (error) { $('message').textContent = error.message; } }
$('import').onclick = async () => { try { await api('/api/import', { method: 'POST', body: JSON.stringify({ path: $('planPath').value }) }); await refresh(); } catch (error) { $('message').textContent = error.message; } };
document.querySelectorAll('[data-action]').forEach((button) => button.onclick = async () => { try { await api(`/api/plans/${state.plan.id}/${button.dataset.action}`, { method: 'POST' }); await refresh(); } catch (error) { $('message').textContent = error.message; } });
refresh(); setInterval(refresh, 2000);
