import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2022.10.20T08.00.46.oidc-integrations.sql',
  run: ({ sql }) => sql`
CREATE TABLE IF NOT EXISTS
  "oidc_integrations" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    "client_id" TEXT NOT NULL,
    "client_secret" TEXT NOT NULL,
    "oauth_api_url" TEXT NOT NULL,
    "linked_organization_id" UUID NOT NULL UNIQUE REFERENCES "organizations" ("id") ON DELETE CASCADE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  );

ALTER TABLE
  "users"
ADD COLUMN
  "oidc_integration_id" UUID REFERENCES "oidc_integrations" ("id") ON DELETE CASCADE;
  `,
} satisfies MigrationExecutor;
