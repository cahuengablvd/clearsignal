-- Persist the operator-confirmed buyer-intent queries for a manual/comped audit
-- so the GEO scan tests exactly the queries shown on the confirmation screen.
alter table audits add column if not exists geo_queries text[];
