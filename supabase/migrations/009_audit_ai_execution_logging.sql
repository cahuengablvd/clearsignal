create table if not exists audit_ai_call_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  audit_id uuid references audits(id) on delete set null,
  request_id text,
  stage text not null,
  trigger text,
  purpose text,
  model text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_creation_tokens integer not null default 0,
  estimated_cost_usd numeric not null default 0,
  recovery_attempt integer,
  worker_id text,
  endpoint text,
  status text not null default 'started',
  error text
);

create index if not exists audit_ai_call_logs_audit_id_created_at_idx
  on audit_ai_call_logs(audit_id, created_at desc);

create index if not exists audit_ai_call_logs_stage_created_at_idx
  on audit_ai_call_logs(stage, created_at desc);

create table if not exists audit_stage_executions (
  execution_key text primary key,
  audit_id uuid not null references audits(id) on delete cascade,
  stage text not null,
  attempt integer not null default 0,
  status text not null default 'running',
  trigger text,
  worker_id text,
  claim_token text not null,
  claimed_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes',
  completed_at timestamptz,
  failed_at timestamptz,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists audit_stage_executions_audit_stage_idx
  on audit_stage_executions(audit_id, stage, status);

create or replace function claim_audit_stage_execution(
  p_audit_id uuid,
  p_stage text,
  p_attempt integer,
  p_trigger text,
  p_worker_id text,
  p_ttl_seconds integer default 1800
) returns jsonb
language plpgsql
as $$
declare
  v_execution_key text := p_audit_id::text || ':' || p_stage || ':' || p_attempt::text;
  v_claim_token text := gen_random_uuid()::text;
  v_completed audit_stage_executions%rowtype;
  v_existing audit_stage_executions%rowtype;
begin
  select *
  into v_completed
  from audit_stage_executions
  where audit_id = p_audit_id
    and stage = p_stage
    and status = 'completed'
    and result is not null
  order by completed_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'claimed', false,
      'alreadyCompleted', true,
      'executionKey', v_completed.execution_key,
      'result', v_completed.result
    );
  end if;

  insert into audit_stage_executions (
    execution_key,
    audit_id,
    stage,
    attempt,
    status,
    trigger,
    worker_id,
    claim_token,
    claimed_at,
    expires_at,
    updated_at
  ) values (
    v_execution_key,
    p_audit_id,
    p_stage,
    p_attempt,
    'running',
    p_trigger,
    p_worker_id,
    v_claim_token,
    now(),
    now() + make_interval(secs => p_ttl_seconds),
    now()
  )
  on conflict (execution_key) do nothing
  returning * into v_existing;

  if found then
    return jsonb_build_object(
      'claimed', true,
      'alreadyCompleted', false,
      'executionKey', v_execution_key,
      'claimToken', v_claim_token
    );
  end if;

  select *
  into v_existing
  from audit_stage_executions
  where execution_key = v_execution_key;

  if v_existing.status = 'completed' and v_existing.result is not null then
    return jsonb_build_object(
      'claimed', false,
      'alreadyCompleted', true,
      'executionKey', v_existing.execution_key,
      'result', v_existing.result
    );
  end if;

  if v_existing.status = 'running' and v_existing.expires_at > now() then
    return jsonb_build_object(
      'claimed', false,
      'alreadyCompleted', false,
      'executionKey', v_existing.execution_key,
      'active', true
    );
  end if;

  update audit_stage_executions
  set
    status = 'running',
    trigger = p_trigger,
    worker_id = p_worker_id,
    claim_token = v_claim_token,
    claimed_at = now(),
    expires_at = now() + make_interval(secs => p_ttl_seconds),
    failed_at = null,
    error = null,
    updated_at = now()
  where execution_key = v_execution_key
  returning * into v_existing;

  return jsonb_build_object(
    'claimed', true,
    'alreadyCompleted', false,
    'executionKey', v_execution_key,
    'claimToken', v_claim_token
  );
end;
$$;
