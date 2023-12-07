import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2023.08.03T11.44.36.schema-checks-github-repository.ts',
  run: ({ sql }) => sql`
    ALTER TABLE "schema_checks"
      ADD COLUMN "github_repository" text
      , ADD COLUMN "github_sha" text
    ;

    ALTER TABLE "schema_versions"
      ADD COLUMN "github_repository" text
      , ADD COLUMN "github_sha" text
    ;
  `,
} satisfies MigrationExecutor;
