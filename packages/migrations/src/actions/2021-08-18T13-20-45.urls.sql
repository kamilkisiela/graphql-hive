--urls (up)
ALTER TABLE
  public.version_commit
ALTER COLUMN
  url
TYPE
  TEXT;

ALTER TABLE
  public.projects
ALTER COLUMN
  build_url
TYPE
  TEXT;

ALTER TABLE
  public.projects
ALTER COLUMN
  validation_url
TYPE
  TEXT;
