import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2023.08.10T11.44.36.schema-versions-github-repository.ts',
  run: ({ sql }) => sql`
    ALTER TABLE "public"."schema_versions"
      ADD COLUMN "github_repository" text
      , ADD COLUMN "github_sha" text
    ;
  `,
} satisfies MigrationExecutor;
