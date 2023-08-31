import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2023.09.01T09.54.00.zendesk-support.ts',
  run: ({ sql }) => sql`
    ALTER TABLE "public"."users" ADD COLUMN "zendesk_user_id" TEXT UNIQUE DEFAULT NULL;
    CREATE INDEX "users_by_zendesk_user_id" ON "public"."users" ("zendesk_user_id" ASC);

    ALTER TABLE "public"."organizations" ADD COLUMN "zendesk_organization_id" TEXT UNIQUE DEFAULT NULL;
    CREATE INDEX "organizations_by_zendesk_organization_id" ON "public"."organizations" ("zendesk_organization_id" ASC);

    ALTER TABLE "public"."organization_member" ADD COLUMN "connected_to_zendesk" BOOLEAN NOT NULL DEFAULT FALSE;
  `,
} satisfies MigrationExecutor;
