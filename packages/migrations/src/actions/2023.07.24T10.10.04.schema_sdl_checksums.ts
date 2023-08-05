import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2023.07.24T10.10.04.schema_sdl_checksums.sql',
  run: ({ sql }) => sql`
CREATE TABLE IF NOT EXISTS "public"."schema_sdl_checksums" (
    "checksum" text NOT NULL,
    "schema_sdl" text NOT NULL,
    "target_id" uuid NOT NULL REFERENCES "targets" ("id") ON DELETE CASCADE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY(target_id, checksum));
ALTER TABLE "public"."schema_checks"
  ADD COLUMN "schema_checksum" text,
  ADD COLUMN "composite_schema_checksum" text,
  ADD COLUMN "supergraph_schema_checksum" text,

  ADD CONSTRAINT schema_sdl_fk
      FOREIGN KEY(target_id, schema_checksum) 
	    REFERENCES schema_sdl_checksums(target_id, checksum),
  
  ADD CONSTRAINT schema_composite_sdl_fk
    FOREIGN KEY(target_id, composite_schema_checksum) 
  REFERENCES schema_sdl_checksums(target_id, checksum),

  ADD CONSTRAINT supergraph_schema_sdl_fk
    FOREIGN KEY(target_id, supergraph_schema_checksum) 
  REFERENCES schema_sdl_checksums(target_id, checksum)
;
  `,
} satisfies MigrationExecutor;
