ALTER TABLE app_user ADD COLUMN onboarded_at TIMESTAMPTZ;
-- Accounts that predate onboarding never see it.
UPDATE app_user SET onboarded_at = now();
