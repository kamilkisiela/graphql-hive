DROP TABLE
  organization_invitations;

ALTER TABLE
  public.organizations
ADD COLUMN
  invite_code invite_code VARCHAR(10) NOT NULL UNIQUE DEFAULT SUBSTR(MD5(RANDOM()::TEXT), 0, 10);
