create table if not exists report_versions (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references audits(id) on delete cascade,
  version_type text not null check (version_type in ('generated', 'regenerated', 'rerendered', 'approved', 'manual')),
  report jsonb not null,
  audit_status text,
  created_at timestamptz not null default now()
);

create index if not exists report_versions_audit_id_created_at_idx
  on report_versions(audit_id, created_at desc);

delete from audit_insights a
using audit_insights b
where a.audit_id = b.audit_id
  and a.ctid < b.ctid;

create unique index if not exists audit_insights_audit_id_key
  on audit_insights(audit_id);
