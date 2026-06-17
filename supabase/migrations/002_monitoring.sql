-- Weekly AI Visibility Monitoring (subscription foundation)

create table if not exists monitored_sites (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  email text not null,
  url text not null,
  brand text,
  competitors text[],
  icp_description text,
  cadence text default 'weekly',     -- weekly (others later)
  status text default 'active',      -- active | paused
  last_run_at timestamptz,
  next_run_at timestamptz default now()
);

create table if not exists monitoring_runs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references monitored_sites(id) on delete cascade,
  created_at timestamptz default now(),
  run_status text default 'done',    -- done | failed
  ai_visibility_score int,
  mention_rate numeric,
  share_of_voice numeric,
  citation_rate numeric,
  cited_domains jsonb,
  competitor_visibility jsonb,
  evidence jsonb,
  geo jsonb,                         -- full GeoResult snapshot for this run
  delta_vs_previous jsonb,
  alerts jsonb
);

create index if not exists idx_monitored_sites_due on monitored_sites(status, next_run_at);
create index if not exists idx_monitored_sites_email on monitored_sites(email);
create index if not exists idx_monitoring_runs_site on monitoring_runs(site_id, created_at desc);
