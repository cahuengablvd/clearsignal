create extension if not exists pgcrypto;

create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  url text not null,
  email text not null,
  competitor_1 text,
  scores jsonb,
  top_insight text,
  status text default 'done'
);

create table if not exists audits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  score_id uuid references scores(id),
  email text not null,
  url text not null,
  icp_description text,
  competitor_1 text,
  competitor_2 text,
  competitor_3 text,
  stripe_session text,
  payment_status text default 'pending',
  audit_status text default 'queued',
  report jsonb,
  admin_notes text,
  tier text default 'automated'
);

create table if not exists audit_insights (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid references audits(id),
  created_at timestamp with time zone default now(),
  icp_clarity int,
  headline_score int,
  cta_score int,
  trust_score int,
  ai_search_score int,
  top_issues text[],
  competitor_patterns text[],
  fixes_implemented text[],
  outcome_30d text,
  delta_noted text
);

-- Indexes
create index if not exists idx_audits_stripe_session on audits(stripe_session);
create index if not exists idx_audits_email on audits(email);
create index if not exists idx_audits_status on audits(audit_status);
create index if not exists idx_scores_email on scores(email);
