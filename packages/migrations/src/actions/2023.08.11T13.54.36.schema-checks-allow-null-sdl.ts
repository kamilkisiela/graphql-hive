import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2023.08.11T13.54.36.schema-checks-allow-null-sdl.ts',
  run: ({ sql }) => sql`
    ALTER TABLE "public"."schema_checks"
    ALTER COLUMN schema_sdl DROP NOT NULL;
  `,
} satisfies MigrationExecutor;
