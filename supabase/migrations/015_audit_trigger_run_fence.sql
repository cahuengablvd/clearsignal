-- A Trigger automatic retry may resume only the same durable Trigger run.
-- Recovery/manual claims clear this owner before they enqueue new work.
alter table audits add column if not exists trigger_run_id text;
