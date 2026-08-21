create index if not exists audit_ai_call_logs_created_at_idx
  on audit_ai_call_logs(created_at);

create table if not exists daily_ai_spend_alerts (
  spend_date date primary key,
  created_at timestamptz not null default now(),
  observed_spend_usd numeric,
  cap_usd numeric not null,
  audit_id uuid references audits(id) on delete set null,
  reason text not null
);

alter table daily_ai_spend_alerts enable row level security;
