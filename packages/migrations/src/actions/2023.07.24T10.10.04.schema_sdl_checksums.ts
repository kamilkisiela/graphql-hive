import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2023.07.24T10.10.04.schema_sdl_checksums.sql',
  run: ({ sql }) => sql`
CREATE TABLE IF NOT EXISTS "public"."schema_sdl_checksums" (
    "checksum" bigint NOT NULL,
    "schema_sdl" text NOT NULL,
    "target_id" uuid NOT NULL REFERENCES "targets" ("id") ON DELETE CASCADE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY(target_id, checksum));
ALTER TABLE "public"."schema_checks"
  ADD COLUMN "schema_checkshum" bigint NOT NULL,
  ADD COLUMN "supergraph_schema_checksum" bigint,
  ADD CONSTRAINT schema_sdl_fk
      FOREIGN KEY(target_id, schema_checkshum) 
	    REFERENCES schema_sdl_checksums(target_id, checksum),

  ADD CONSTRAINT supergraph_schema_sdl_fk
    FOREIGN KEY(target_id, supergraph_schema_checksum) 
  REFERENCES schema_sdl_checksums(target_id, checksum)
;
  `,
} satisfies MigrationExecutor;
