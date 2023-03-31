ALTER TABLE
  public.projects
ADD COLUMN
  external_composition_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN
  external_composition_endpoint TEXT,
ADD COLUMN
  external_composition_secret TEXT;
