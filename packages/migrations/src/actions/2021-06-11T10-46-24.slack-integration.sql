--slack-integration (up)
ALTER TABLE
  public.organizations
ADD COLUMN
  slack_token TEXT;
