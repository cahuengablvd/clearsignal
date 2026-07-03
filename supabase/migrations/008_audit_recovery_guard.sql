alter table audits add column if not exists processing_started_at timestamptz;
alter table audits add column if not exists recovery_attempts integer not null default 0;
