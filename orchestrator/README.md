# ClearSignal Orchestrator MVP

This is a local, package-free Node 24 orchestration vertical slice. It stores durable state outside
the repository, launches fresh role-specific agent sessions, captures an append-only event trail,
and provides a small loopback dashboard.

Read `../ORCHESTRATOR_DESIGN.md` before relying on it. In particular:

- TECH_LEAD uses a separate read-only Codex CLI session, not an existing ChatGPT desktop chat.
- Fable review uses the Anthropic API. The verified local `.env.local` key is read in memory only.
- The direct OpenAI API adapter is not enabled because the current key returned HTTP 401.
- Production deploy, push, and Supabase mutation are intentionally absent.
- Start refuses a dirty ClearSignal checkout. It never stashes, resets, or commits user-owned edits.

## Start

```powershell
npm run orchestrator
```

Open <http://127.0.0.1:4317>, enter an absolute `TASKS_*.md` path inside the repository, import it,
and press Start.

Optional configuration:

```powershell
Copy-Item orchestrator\config.example.json orchestrator\config.local.json
$env:ORCHESTRATOR_CONFIG = (Resolve-Path orchestrator\config.local.json)
npm run orchestrator
```

Do not commit `config.local.json` if it gains machine-specific information. Secrets belong in
environment variables. Supported secret variables are `ORCHESTRATOR_ANTHROPIC_API_KEY` and
`ORCHESTRATOR_NOTIFY_WEBHOOK_URL`; the Anthropic adapter otherwise reads `ANTHROPIC_API_KEY` from
the project's existing `.env.local` without logging it.

State defaults to `%LOCALAPPDATA%\ClearSignalOrchestrator\clearsignal`. Deleting it discards local
orchestration history, so back up `state.db` and `artifacts` if a plan matters.

## Isolated dependency runtime

Each worktree gets a junction to a managed runtime at
`%LOCALAPPDATA%\CSO\clearsignal\runtime\<24-hex-lockfile-fingerprint>\node_modules` (the
full SHA-256 is retained and verified in `runtime.json`).
The runner verifies that `package.json` and the lockfile agree, reuses only a matching
`RUNTIME_READY` fingerprint, and provisions a missing runtime with Node invoking npm's local JS
entry point. It never copies the founder checkout's `node_modules` or `.env.local`.

Provisioning uses `npm ci --ignore-scripts --no-audit`; lifecycle scripts are deliberately disabled.
If a package requires a lifecycle script, preparation fails and execution is blocked rather than
silently running unreviewed install code. The runtime includes only the package manifests,
lockfile, installed packages, and `runtime.json` state metadata.

## Current MVP limits

- One plan/task executes at a time.
- Task dependencies default to source order. A future TECH_LEAD normalization pass should import
  explicit dependency metadata before parallelism is added.
- Pause takes effect between agent/test steps. Cancel aborts the active agent child process, but
  cleanup is deliberately manual so partial diffs remain recoverable.
- Automatic HumanAction verification currently supports the clean-Git preflight only.
- Agent failure classification is conservative. Missing reset metadata remains unknown.

## Tests

```powershell
npm run test:orchestrator
npx tsc --noEmit
npm test
npm run build
```
