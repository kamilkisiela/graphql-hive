--slack-integration (down)
ALTER TABLE
  public.organizations
DROP COLUMN
  slack_token;
