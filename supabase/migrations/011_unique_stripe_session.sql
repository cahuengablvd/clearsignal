-- Prevent duplicate paid audits when Stripe retries the same checkout.session.completed event concurrently.
-- PostgreSQL unique indexes allow multiple NULL values, so unpaid/manual rows without stripe_session remain valid.
CREATE UNIQUE INDEX if not exists audits_stripe_session_unique_idx
  ON audits (stripe_session)
  WHERE stripe_session IS NOT NULL;
