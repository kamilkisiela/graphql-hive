CREATE TABLE "schema_checks" (
  "id" uuid NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "schema_sdl" text,
  "schema_version_id" uuid NOT NULL REFERENCES "schema_versions" ("id") ON DELETE CASCADE,
  "schema_composition_errors" jsonb,
  "schema_changes" jsonb,
  "is_success" boolean NOT NULL, 
  "composite_schema_sdl" text,
  "supergraph_sdl" text
);
