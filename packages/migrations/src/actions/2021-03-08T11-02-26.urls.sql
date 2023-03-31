--urls (up)
ALTER TABLE
  public.projects
ALTER COLUMN
  build_url
TYPE
  TEXT,
ALTER COLUMN
  validation_url
TYPE
  TEXT;
