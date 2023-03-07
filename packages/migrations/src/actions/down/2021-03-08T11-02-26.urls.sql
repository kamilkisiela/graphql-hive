--urls (down)
ALTER TABLE
  public.projects
ALTER COLUMN
  build_url
TYPE
  url,
ALTER COLUMN
  validation_url
TYPE
  url;
