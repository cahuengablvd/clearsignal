alter table audits add column if not exists api_cost_usd numeric;
alter table audits add column if not exists api_cost_breakdown jsonb;
