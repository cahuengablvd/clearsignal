# ClearSignal local agent orchestrator — discovery and MVP design

**Discovery date:** 2026-09-02  
**Repository:** `C:\Claude Code\clearsignal` at `c095476` on `main`  
**Decision:** Proceed with a local MVP, with the limitations and substitution described below.

This is developer tooling, not a ClearSignal customer feature. It does not change the audit engine,
report structure, trust layer, paid funnel, or deployment policy.

## Status vocabulary

- **VERIFIED** — observed on this machine or confirmed by a successful metadata/execution probe.
- **UNCONFIRMED** — plausible or documented, but not demonstrated with the current account/runtime.
- **NOT AVAILABLE** — absent locally or no supported programmatic interface was found.

## Executive decision

The useful core can be built without mouse/keyboard automation:

- Codex can be started non-interactively in a fresh session, emits JSONL events, accepts an output
  schema, exposes a thread ID, reports token usage, and returns a process exit code.
- Claude Fable 5.1 is available to the current Anthropic API key and can be called directly for
  planning and deep review.
- The ChatGPT desktop conversation cannot be driven through a supported external API. For MVP, the
  mandatory **TECH_LEAD** role is preserved as a separate, fresh, read-only OpenAI reasoning session
  launched through the ChatGPT-authenticated Codex CLI. It is independent by prompt, context packet,
  session, output schema, and role, but it is not the founder's existing ChatGPT desktop conversation.
- A direct OpenAI Responses API adapter is the preferred later TECH_LEAD adapter. The current
  `OPENAI_API_KEY` returned HTTP 401 during discovery, so that adapter must remain unavailable until
  the owner replaces or repairs the credential and separately confirms API billing.

No production deployment is part of the MVP. No GUI automation will be built.

## A. Verified available interfaces

| Interface | Status | Evidence and consequence |
|---|---|---|
| Repository | **VERIFIED** | `git log --oneline -1` returned `c095476 Close RD-00 RD-05 review notes`. |
| Codex CLI | **VERIFIED** | `codex-cli 0.152.1` at the Codex desktop installation path. |
| Codex non-interactive execution | **VERIFIED** | `codex exec --json --ephemeral ...` emitted `thread.started`, `turn.started`, `item.completed`, and `turn.completed`, then exited successfully. |
| Codex structured final output | **VERIFIED** | Local help exposes `--output-schema` and `--output-last-message`. |
| Codex auth | **VERIFIED** | `codex login status`: `Logged in using ChatGPT`; redacted doctor output confirms ChatGPT tokens and no stored API key. |
| Codex model selection | **VERIFIED** | CLI exposes `--model`; the installed configuration currently names `gpt-5.6-sol`. Specific alternate models must be capability-probed before a plan starts. |
| Codex review entry point | **VERIFIED** | CLI exposes both `codex review` and `codex exec review`. MVP uses role prompts and schemas so routing remains vendor-neutral. |
| Codex desktop app server | **VERIFIED, EXPERIMENTAL** | Installed CLI exposes an experimental app-server. It is deliberately not an MVP dependency. |
| Anthropic API authentication | **VERIFIED** | `GET /v1/models` succeeded using the local secret without printing it. |
| Fable API availability | **VERIFIED** | Account lists `claude-fable-5-1`; a 23-input-token/9-output-token probe returned HTTP 200 and `FABLE_OK`. |
| Anthropic SDK | **VERIFIED** | `@anthropic-ai/sdk` is already a ClearSignal dependency. MVP may use direct `fetch` to keep the tool isolated. |
| Node.js | **VERIFIED** | Node `v24.18.0`; built-in `node:sqlite` passed a create/insert/read probe. |
| Durable database | **VERIFIED** | Built-in SQLite works without another package or native build step. |
| Git | **VERIFIED** | Git `2.55.0.windows.2`; repository remote is GitHub. |
| Tests | **VERIFIED** | Local `vitest`, `tsc`, and `next` binaries exist; required commands are `npm test`, `npx tsc --noEmit`, and `npm run build`. |
| Trigger.dev | **VERIFIED** | Project-pinned CLI `4.4.6` runs through `npx`; deployment remains a separate owner-authorized operation from `C:\csdeploy`. |
| Existing webhook notifications | **VERIFIED** | `.env.local` contains `NOTIFY_WEBHOOK_URL` and `lib/notify.ts` already posts operational alerts to it. The orchestrator will use a separately named setting by default to avoid mixing concerns. |
| ChatGPT desktop | **VERIFIED GUI ONLY** | Installed as a packaged Windows application (`ChatGPT Classic`). No supported external job/session API was found. |
| Claude desktop | **VERIFIED GUI ONLY** | Installed as a packaged Windows application. No local `claude` CLI is installed. |

Official background: the OpenAI Responses API supports explicit model selection, structured output,
conversation linkage, background status, error objects, and usage reporting:
<https://developers.openai.com/api/reference/cli/resources/responses/methods/create>. Anthropic's
Claude Code CLI documents non-interactive print mode, but that CLI is not installed here:
<https://code.claude.com/docs/en/cli-usage>. Fable 5.1 is officially available through the Claude
API: <https://www.anthropic.com/claude/fable>.

## B. Unsupported or uncertain interfaces

| Interface/behavior | Status | Handling |
|---|---|---|
| Existing ChatGPT desktop conversation as an agent | **NOT AVAILABLE** | Do not automate the GUI. Use a fresh TECH_LEAD model session and persist its artifacts. |
| Existing Claude desktop conversation as an agent | **NOT AVAILABLE** | Do not automate the GUI. Use the Claude API. |
| Local Claude Code CLI | **NOT AVAILABLE** | `Get-Command claude` failed. It can be added later, but is unnecessary for the verified Fable API path. |
| Local Fable executable | **NOT AVAILABLE** | Fable is a model, not a local executable on this machine. |
| Direct OpenAI API TECH_LEAD | **NOT AVAILABLE NOW** | Current `OPENAI_API_KEY` returned 401. Repairing it is a HumanAction; API billing is separate from ChatGPT billing. |
| ChatGPT subscription quota reset via public Codex CLI command | **UNCONFIRMED** | No stable CLI command exposing the reset was found. Parse structured errors when present; otherwise keep `resume_at = null`. |
| Codex experimental app-server as stable orchestration API | **UNCONFIRMED** | Excluded from MVP to avoid binding durable state to an experimental protocol. |
| Fable/Claude subscription desktop quota from Claude API | **NOT AVAILABLE** | API limits and product subscription limits are different pools. The API adapter can only observe API errors/headers. |
| GitHub CLI | **NOT AVAILABLE** | Ordinary Git is available. MVP does not open PRs. |
| Supabase CLI | **NOT AVAILABLE LOCALLY** | SQL/migration work remains a HumanAction unless a reviewed, supported CLI setup is added. |
| Vercel CLI | **NOT AVAILABLE LOCALLY** | Vercel deployment is Git-driven from `main`; MVP never pushes or deploys. |

OpenAI API billing is separate from ChatGPT subscription billing. A desktop subscription cannot be
treated as API credit. The direct API adapter therefore requires its own valid API credential and
billing configuration. Conversation data in the desktop apps is not automatically readable by this
tool; only files/artifacts explicitly placed in the task packet can cross the boundary.

## CHATGPT INTEGRATION

### Current supported interfaces

1. **Codex CLI with ChatGPT authentication — VERIFIED.** This can run fresh OpenAI model sessions
   and return machine-readable events. It is the MVP TECH_LEAD transport.
2. **OpenAI Responses API — documented, current credential NOT AVAILABLE.** This is the preferred
   long-term TECH_LEAD transport because it has first-class structured output, usage, status, and
   rate-limit semantics.
3. **ChatGPT desktop/product session — NOT AVAILABLE programmatically.** It cannot be attached to
   the queue or polled by supported external code.
4. **Codex desktop internal thread tools/app-server — experimental or host-internal.** They are not
   used as the orchestrator's durable contract.

### Authentication and cost

- Codex CLI currently authenticates with stored ChatGPT tokens. The orchestrator never reads or
  copies those tokens; it launches the installed CLI.
- OpenAI API mode requires `ORCHESTRATOR_OPENAI_API_KEY` (or an explicitly selected secret source),
  not a key written to the database or repository. Current ClearSignal `OPENAI_API_KEY` is invalid
  for the model-list endpoint and will not be reused silently.
- ChatGPT subscription usage and OpenAI API usage/billing are separate. Codex CLI usage consumes the
  entitlement associated with its ChatGPT login; API mode is token-billed separately.
- The MVP records input/cached/output token counts reported by Codex, but a precise currency amount
  is **UNCONFIRMED** because subscription-credit pricing is not a stable public per-call API contract.

### Context persistence

The TECH_LEAD never relies on desktop chat history. Every call is fresh and receives a bounded packet:
task contract, latest planner/reviewer artifact when relevant, diff summary, test results, attempt
number, and allowed routing decisions. Its JSON result is stored as an immutable artifact. The
deterministic kernel, not the model, owns state transitions.

### Rate and quota behavior

- Record all structured CLI events, process exit code, stderr classification, and any explicit reset
  or retry metadata.
- If an error clearly identifies a short rate limit and supplies a retry time, set `RATE_LIMITED`
  and schedule that time.
- If it clearly identifies subscription/model quota exhaustion, set `MODEL_QUOTA_EXHAUSTED`.
- If no reset is supplied, show that the reset time is unavailable and require manual Resume or a
  conservative operator-configured retry policy. Never derive a reset time from prior incidents.

## C. Proposed architecture

One local Node process provides both the deterministic worker and a localhost UI:

```text
Browser on 127.0.0.1
        |
HTTP + server-sent events
        |
orchestration kernel ---- SQLite state.db (WAL)
        |                 append-only events + immutable artifacts
        |
role adapters
  |-- CodexExecAdapter (IMPLEMENTER)
  |-- CodexTechLeadAdapter (TECH_LEAD MVP)
  |-- OpenAIResponsesAdapter (TECH_LEAD later, credential-gated)
  `-- AnthropicMessagesAdapter (PLANNER / REVIEWER / Fable)
        |
isolated Git worktree per attempt
```

The kernel alone may transition state. Adapters return typed outcomes; they never select the next
task or mutate orchestration records directly. One plan runs at a time in MVP.

## D. Agent adapters

All adapters implement:

```ts
run({ role, modelClass, packetPath, schemaPath, cwd, timeoutMs, abortSignal })
  -> { status, externalRunId, output, usage, retryAfter, rawArtifactPaths }
```

### IMPLEMENTER — CodexExecAdapter

- Spawn a new `codex exec` process per attempt with `--json`, `--output-schema`, an explicit working
  directory, model/profile, sandbox, and non-interactive approval policy.
- Use a new session; never `resume` for the next task or fix attempt.
- Permit repository writes and test commands inside the isolated worktree only.
- Do not pass `--dangerously-bypass-approvals-and-sandbox`.
- Capture stdout JSONL and stderr separately. Close stdin explicitly so piped parent input is not
  accidentally appended to the prompt (the discovery probe showed that inherited stdin is visible).

### TECH_LEAD — CodexTechLeadAdapter (MVP)

- A separate fresh Codex CLI session, read-only sandbox, role-specific system/task packet, and strict
  JSON schema.
- Allowed decisions: `PASS`, `CODEX_FIX`, `DEEP_REVIEW_REQUIRED`,
  `HUMAN_ACTION_REQUIRED`, `BLOCKED`.
- It cannot edit the repository. It writes only its validated decision artifact through the parent.
- This preserves the independent reasoning role, but is not the same as controlling ChatGPT desktop.

### PLANNER / REVIEWER — AnthropicMessagesAdapter

- Direct Claude Messages API with a capability-probed model. Fable 5.1 is verified.
- Send only the bounded packet; no repository credentials and no general filesystem tool.
- Use `low`/`medium` for routine normalization where appropriate, `high` or above only for the
  escalation categories in the brief.
- Validate returned JSON locally before accepting a transition.

### OpenAIResponsesAdapter (later/config-gated)

- Direct Responses API with Structured Outputs.
- Becomes preferred for TECH_LEAD after a valid separately billed key passes a startup model probe.
- Never imports desktop ChatGPT conversation history.

## E. State machine

```text
DRAFT -> READY -> NORMALIZING -> IMPLEMENTING -> TESTING -> TECH_LEAD_REVIEW
                                                       |          |
                                                       |          +-> COMPLETED
                                                       |          +-> FIX_READY -> IMPLEMENTING
                                                       |          +-> DEEP_REVIEW -> TECH_LEAD_REVIEW
                                                       |          +-> HUMAN_ACTION_REQUIRED
                                                       |          `-> BLOCKED
                                                       `-> BLOCKED / PAUSED
```

Plan statuses: `DRAFT`, `READY`, `RUNNING`, `PAUSED`, `HUMAN_ACTION_REQUIRED`, `BLOCKED`,
`COMPLETED`, `CANCELLED`.

Run outcomes include the required set: `RUNNING`, `COMPLETED`, `FAILED`, `RATE_LIMITED`,
`MODEL_QUOTA_EXHAUSTED`, `AUTH_REQUIRED`, `HUMAN_ACTION_REQUIRED`, `BLOCKED`,
`WAITING_DEPENDENCY`, `PAUSED`, `UNKNOWN_FAILURE`.

Transitions use a database transaction with a compare-and-set expected prior state. On restart,
`RUNNING` executions with no live owned process become `UNKNOWN_FAILURE` and are safe to Retry; they
are never assumed complete.

## F. Persistent state design

Default root: `%LOCALAPPDATA%\ClearSignalOrchestrator\<repository-id>\` so state is not committed,
does not dirty the repository, and survives app/repository restarts.

```text
state.db
artifacts/<plan>/<task>/<attempt>/
  packet.json
  prompt.txt
  agent-events.jsonl
  stderr.log
  result.json
  diff.patch
  tests.json
worktrees/<plan>/<task>-<attempt>/
```

SQLite tables:

- `plans(id, name, source_path, source_sha256, base_commit, branch, status, created_at, updated_at)`
- `tasks(id, plan_id, ordinal, objective, acceptance_json, dependencies_json, assigned_role,
  model_class, status, attempt_count, max_attempts, current_run_id, created_at, updated_at)`
- `runs(id, task_id, attempt, role, adapter, model, status, started_at, ended_at, exit_code,
  external_run_id, retry_at, failure_code, failure_summary, usage_json)`
- `artifacts(id, run_id, kind, path, sha256, bytes, created_at)`
- `commits(id, task_id, attempt, sha, parent_sha, subject, created_at)`
- `test_results(id, task_id, attempt, command, status, exit_code, duration_ms, log_artifact_id)`
- `reviews(id, task_id, attempt, reviewer_role, decision, blockers_json, artifact_id, created_at)`
- `human_actions(id, plan_id, task_id, status, title, explanation, why_manual, service,
  steps_json, payload_path, expected_result, verification_json, created_at, resolved_at)`
- `events(seq INTEGER PRIMARY KEY AUTOINCREMENT, plan_id, task_id, run_id, type, level,
  public_message, details_json, created_at)`
- `leases(name PRIMARY KEY, owner_id, expires_at)`

Artifacts are immutable and content-hashed. Database paths are relative to the state root. Events
are append-only; secrets and full environment dumps are forbidden.

## G. Large-plan decomposition

1. Hash and preserve the original `TASKS_*.md` as a source artifact.
2. Deterministically extract headings that look like stable task IDs (`A1`, `A3.2`, `R39`, etc.).
3. Send the extracted sections to TECH_LEAD for a structured graph containing stable IDs, objectives,
   acceptance criteria, explicit dependencies, role, and model class.
4. Validate: unique IDs, no missing dependencies, acyclic graph, nonempty objective/acceptance, no
   forbidden expansion beyond the source.
5. If ambiguity changes product behavior, emit HumanAction. Otherwise save the graph and continue.

Never pass the entire plan history to each implementation run. Each packet is rebuilt from current
database rows and only directly relevant predecessor artifacts.

## H. Retry and fix logic

- Maximum three implementation/review rounds per task, including the initial implementation.
- A failed test first returns to TECH_LEAD with the failing command and bounded tail/full artifact.
- `CODEX_FIX` creates a new attempt, fresh Codex session, and smallest actionable fix packet.
- `DEEP_REVIEW_REQUIRED` creates one fresh Fable review, then always returns through TECH_LEAD.
- Identical blocker fingerprints on consecutive attempts stop early rather than burn the third call.
- After the maximum, set `BLOCKED_REQUIRES_ESCALATION` and notify once.
- Infrastructure-only transient failures do not consume a correction attempt unless code changed.

## I. Quota handling

For Anthropic, HTTP 429 plus `retry-after` is `RATE_LIMITED`; response rate-limit reset headers are
stored when supplied. Anthropic documents separate spend-cap error shapes and cases with no
`retry-after`: <https://platform.claude.com/docs/en/api/rate-limits>.

For Codex CLI, classify only explicit structured/error evidence. A reset timestamp is nullable.
Without one, display: “Paused because the OpenAI/Codex usage limit was reached. Automatic reset time
is not available from the interface.” Manual Resume reruns a cheap capability probe first.

Never silently change a task marked `high_reasoning`. A configured fallback may be offered only when
the task policy permits it and the event log names the substitution.

## J. HumanAction protocol

A HumanAction is first-class persisted state, not prose in a log. It contains the fields requested
in the brief plus a typed verifier:

- `command`: read-only command with an explicit allowlist and expected exit/output predicate.
- `http`: GET/HEAD against an explicit URL with status/body predicate.
- `database`: named, read-only query through an existing credential source.
- `manual_only`: no safe automatic verifier; the UI states this honestly.

The UI's **Verify & continue** runs the verifier and appends either `HUMAN_ACTION_VERIFIED` or
`HUMAN_ACTION_VERIFICATION_FAILED`. “Done” alone never marks a verifiable action complete. SQL/code
payloads live in a separate artifact, not an interpolated shell command.

## K. Git isolation strategy

- The current worktree is heavily dirty, including `lib/sanitize.ts`; those edits are user-owned.
- MVP refuses unattended Start when the selected base contains uncommitted changes. It does not
  stash, reset, clean, commit, or copy them.
- The owner may explicitly select the current committed `HEAD`, or first commit the desired edits.
- Create a plan branch using `codex/orchestrator/<plan-id>` and one external worktree per attempt.
- Run one task at a time in MVP. A dependency-ready task starts from the plan branch head.
- After review PASS, create/record the task commit and fast-forward the plan branch. Never push.
- Cancel terminates the child process, preserves artifacts/diff, removes no worktree automatically,
  and marks the run cancelled. Cleanup is a separate safe operation after path verification.
- A package-lock change uses an isolated dependency install. Otherwise the worktree may use the
  verified repository dependencies without copying build output; `.next` stays per-worktree.

## L. ClearSignal-specific tests and deploy integration

Every implementation attempt must run, in order:

1. task-specific tests supplied by the task/TECH_LEAD;
2. `npx tsc --noEmit`;
3. `npm test`;
4. `npm run build`.

The isolated worktree gives `next build` its own `.next`, avoiding conflict with a dev server in the
founder's main checkout. Test commands, exit codes, duration, and logs are stored independently.

Trust rules are injected into every packet: do not weaken `lib/sanitize.ts` or
`lib/report-validator.ts`, do not bypass human review, do not invent measurements or guarantees,
and apply evidence filters to both live and stored-evidence reuse paths with tests.

Deployment is explicitly out of MVP:

- no Git push;
- no Vercel production action;
- no Trigger deploy;
- no Supabase migration apply.

If a passed task touches Trigger-sensitive paths, the completion artifact creates a pending
HumanAction referencing `DEPLOY.md` and `C:\csdeploy`. Production deployment always remains opt-in.

## M. Notification strategy

MVP supports one configurable generic webhook named `ORCHESTRATOR_NOTIFY_WEBHOOK_URL`. It may be set
to the same destination as ClearSignal's existing webhook, but that choice is explicit; secrets are
read from the environment and never persisted. Notification events are only:

- plan completed;
- task blocked/escalated;
- HumanAction required;
- meaningful quota pause;
- unresolved tests/fix-loop exhaustion.

Normal transitions appear only in the live UI/event stream. Webhook failures append one warning and
do not fail the plan. A Windows toast adapter is a later optional convenience, not a dependency.

## N. UI proposal

A functional localhost dashboard on `127.0.0.1` shows:

- current plan and completed/total progress;
- current task, role/agent, attempt, and status;
- last test/review result;
- plain-language stop reason and what happens next;
- open HumanAction with steps, payload, expected result, and verifier result;
- recent append-only events.

Controls: Start, Pause, Resume, Retry, Cancel safely, Open HumanAction, Verify & continue. Actions are
POST requests with CSRF tokens and idempotency keys. The server binds loopback only.

## O. Security model

- Bind only `127.0.0.1`; reject non-loopback Host headers.
- Generate a per-launch CSRF token; no remote access in MVP.
- Read secrets from process environment or `.env.local` in memory only; never store values.
- Redact key/token/password/cookie patterns from captured stdout/stderr before disk write.
- Pass only a minimal environment allowlist to child processes.
- Do not place prompts containing secrets in events; artifact access remains local.
- Cap artifact/log sizes and record truncation explicitly.
- Never execute model-produced shell text directly. The kernel owns every command and argument array.
- Validate all model output against JSON schema plus deterministic semantic checks.

## P. Failure scenarios

| Scenario | Result |
|---|---|
| Orchestrator/Windows restarts mid-run | Lease expires; run becomes `UNKNOWN_FAILURE`; preserved diff is inspected before Retry. |
| Codex exits 0 without schema-valid result | `FAILED_INVALID_OUTPUT`, no transition based on prose. |
| Codex/Claude auth rejected | `AUTH_REQUIRED` HumanAction naming the exact adapter. |
| 429 with retry metadata | `RATE_LIMITED`, resume scheduled no earlier than server value. |
| Quota/spend cap without reset | `MODEL_QUOTA_EXHAUSTED`, `retry_at = null`, plain-language pause. |
| Tests fail | TECH_LEAD routes a fresh fix or blocks; never mark complete. |
| Review asks for out-of-scope product change | `BLOCKED` or HumanAction for product decision. |
| Dirty base repository | HumanAction; no stash/reset/implicit snapshot. |
| Agent modifies forbidden/out-of-scope files | TECH_LEAD review plus deterministic path policy blocks commit. |
| Webhook fails | Warning event; UI remains source of truth. |
| Human claims action done but verification fails | Remain `HUMAN_ACTION_REQUIRED` with verifier output. |
| Dependency cycle/missing task | Plan import fails before any agent runs. |
| Cancellation during Git operation | Finish/abort the atomic Git command, retain worktree, record exact state. |

## Q. MVP scope

Included:

- SQLite schema, migrations, leases, and append-only events;
- import/validation of `TASKS_*.md` into a sequential or explicit dependency graph;
- fresh Codex IMPLEMENTER and TECH_LEAD sessions;
- Fable reviewer adapter through the verified Anthropic API;
- three-round correction loop;
- worktree preflight/isolation and deterministic Git capture;
- required test pipeline and artifacts;
- pause/resume/retry/cancel recovery;
- HumanAction creation and verification hooks;
- localhost status/control UI and server-sent events;
- low-noise webhook notifications;
- no production deployment.

MVP does not promise fully autonomous interpretation of every historical task format. Invalid or
ambiguous decomposition becomes a visible blocker rather than an invented graph.

## R. Later improvements

- Repair and enable direct OpenAI Responses API TECH_LEAD adapter.
- Add installed Claude Code CLI adapter if its subscription economics are preferable to API calls.
- Evaluate Codex app-server only after it is a documented stable interface.
- Parallel execution for genuinely independent tasks after merge-conflict and budget controls exist.
- PR creation through GitHub integration.
- Native Windows notifications and system-tray launcher.
- Optional, owner-authorized Vercel/Trigger/Supabase deployment workflows.
- Budget forecasting and hard daily agent-spend caps.

## S. Exact files/packages to create

The package-free Node 24 MVP avoids adding runtime dependencies:

```text
orchestrator/
  README.md
  config.example.json
  src/
    cli.mjs
    server.mjs
    db.mjs
    state-machine.mjs
    plan-parser.mjs
    runner.mjs
    git.mjs
    process.mjs
    redact.mjs
    notify.mjs
    human-actions.mjs
    adapters/
      codex-exec.mjs
      anthropic.mjs
    schemas/
      tech-lead.schema.json
      implementer.schema.json
      reviewer.schema.json
    ui/
      index.html
      app.js
      styles.css
  test/
    db.test.mjs
    state-machine.test.mjs
    plan-parser.test.mjs
    redact.test.mjs
```

`package.json` adds only scripts to start and test the tool. Runtime uses Node core `http`,
`child_process`, `crypto`, `fs`, and `node:sqlite`; Anthropic calls use `fetch`. Persistent runtime
data lives outside the repository.

## T. Estimated implementation complexity

- Kernel, schema, events, recovery: **2–3 focused days**.
- Codex/Anthropic adapters and classification: **1–2 days**.
- Git worktree/test pipeline: **1–2 days**.
- Functional UI/HumanAction/notifications: **1–2 days**.
- End-to-end hardening against deliberate failure cases: **2–3 days**.

Total production-hardened MVP: roughly **7–12 focused engineering days**. A narrower runnable vertical
slice can be built in one session, but it should not be described as unattended-production-ready
until restart recovery, cancellation, quota classification, Git isolation, and failure injection have
all been exercised.

## Discovery conclusions by required question

1. **Codex:** supported CLI and non-interactive JSONL are verified; ChatGPT authentication works.
2. **Claude Code:** documented headless mode exists, but the CLI is not installed here.
3. **Fable:** exact Fable 5.1 model access through Claude API is verified; the desktop session is not controllable.
4. **ChatGPT:** desktop session is not automatable; OpenAI API is separate and current key fails; Codex CLI provides the MVP OpenAI TECH_LEAD transport.
5. **GUI-only:** existing desktop conversations, owner billing/legal choices, real-card Stripe test, and current Supabase dashboard review steps.
6. **ClearSignal CLI/API:** Git, Node/npm tests/build, Trigger CLI through pinned `npx`, service SDKs, and HTTP health checks are available.
7. **Genuine owner actions:** current `STATUS.md` owner blockers plus destructive/production/credential decisions.
8. **Limits:** Anthropic API gives typed HTTP errors and rate headers; Codex gives structured events but reset metadata is not guaranteed.
9. **Quota reset:** only store an explicit server value; otherwise it is unknown.
10. **80% architecture:** one deterministic Node/SQLite process, fresh role sessions, external worktrees, bounded artifacts, and a loopback dashboard.
