alter table audits add column if not exists last_generated_at timestamptz;
alter table audits add column if not exists last_rerendered_at timestamptz;
alter table audits add column if not exists last_delivered_at timestamptz;
