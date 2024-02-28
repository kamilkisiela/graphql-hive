import type { MigrationExecutor } from '../pg-migrator';

export default {
  name: '2024.02.19T00.00.01.schema-check-store-breaking-change-metadata.ts',
  noTransaction: true,
  run: ({ sql }) => sql`
    ALTER TABLE "schema_checks"
      ADD COLUMN IF NOT EXISTS "conditional_breaking_change_metadata" JSONB
    ;

    ALTER TABLE "schema_versions"
      ADD COLUMN IF NOT EXISTS "conditional_breaking_change_metadata" JSONB
    ;
  `,
} satisfies MigrationExecutor;
