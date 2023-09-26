import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2023.09.25T15.23.00.github-check-with-project-name.ts',
  run: ({ sql }) => sql`
    ALTER TABLE "public"."projects" ADD COLUMN "github_check_with_project_name" BOOLEAN;
    UPDATE "public"."projects" SET "github_check_with_project_name" = FALSE WHERE "github_check_with_project_name" IS NULL;
    ALTER TABLE "public"."projects"
      ALTER COLUMN "github_check_with_project_name" SET NOT NULL,
      ALTER COLUMN "github_check_with_project_name" SET DEFAULT TRUE;
  `,
} satisfies MigrationExecutor;
