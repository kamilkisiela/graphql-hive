import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2024.07.16T13-44-00.oidc-only-access.ts',
  run: ({ sql }) => sql`
    ALTER TABLE "oidc_integrations"
    ADD COLUMN "oidc_user_access_only" BOOLEAN NOT NULL DEFAULT TRUE;
  `,
} satisfies MigrationExecutor;
