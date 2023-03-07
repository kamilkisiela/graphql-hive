--urls (down)
ALTER TABLE
  public.version_commit
ALTER COLUMN
  url
TYPE
  url;

ALTER TABLE
  public.projects
ALTER COLUMN
  build_url
TYPE
  url
ALTER TABLE
  public.projects
ALTER COLUMN
  validation_url
TYPE
  url;
