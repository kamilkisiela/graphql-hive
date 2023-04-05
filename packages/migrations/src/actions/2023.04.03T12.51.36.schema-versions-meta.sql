CREATE TABLE
  "schema_version_changes" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    "schema_version_id" UUID NOT NULL REFERENCES "schema_versions" ("id") ON DELETE CASCADE,
    "severity_level" TEXT NOT NULL,
    "change_type" TEXT NOT NULL,
    "meta" jsonb NOT NULL,
    "is_safe_based_on_usage" BOOLEAN NOT NULL
  );

ALTER TABLE
  "schema_versions"
ADD COLUMN
  "has_persisted_schema_changes" BOOLEAN,
ADD COLUMN
  "schema_composition_errors" jsonb,
ADD COLUMN
  "composite_schema_sdl" TEXT,
ADD COLUMN
  "previous_schema_version_id" UUID UNIQUE REFERENCES "schema_versions" ("id") ON DELETE SET NULL
;
