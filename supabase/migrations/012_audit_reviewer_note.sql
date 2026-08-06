-- Client-facing note written by the human reviewer. It is deliberately
-- separate from admin_notes, which remains an internal operational log.
alter table audits add column if not exists reviewer_note text;
