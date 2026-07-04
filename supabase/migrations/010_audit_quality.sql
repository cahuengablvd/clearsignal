alter table audits
  add column if not exists quality jsonb not null default '{}'::jsonb;

create index if not exists audits_quality_gin_idx
  on audits using gin (quality);
