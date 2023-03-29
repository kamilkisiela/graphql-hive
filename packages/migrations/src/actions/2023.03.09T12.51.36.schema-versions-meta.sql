CREATE TABLE
  "schema_version_changes" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    "schema_version_id" UUID NOT NULL REFERENCES "schema_versions" ("id") ON DELETE CASCADE,
    "severity_level" TEXT NOT NULL,
    "change_type" TEXT NOT NULL,
    "meta" jsonb NOT NULL
  );

-- ALTER TABLE
--   "schema_versions"
-- ADD COLUMN
--   "schema_build_error_messages" TEXT DEFAULT NULL;
