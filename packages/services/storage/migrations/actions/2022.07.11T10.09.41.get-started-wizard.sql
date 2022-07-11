-- Tracks feature discovery progress

ALTER table public.organizations
  ADD COLUMN get_started_creating_project BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN get_started_publishing_schema BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN get_started_checking_schema BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN get_started_inviting_members BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN get_started_reporting_operations BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN get_started_usage_breaking BOOLEAN NOT NULL DEFAULT FALSE;