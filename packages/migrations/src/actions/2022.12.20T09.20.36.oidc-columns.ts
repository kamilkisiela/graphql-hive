import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2022.12.20T09.20.36.oidc-columns.sql',
  run: ({ sql }) => sql`
ALTER TABLE
  "public"."oidc_integrations"
ADD COLUMN
  "token_endpoint" TEXT,
ADD COLUMN
  "userinfo_endpoint" TEXT,
ADD COLUMN
  "authorization_endpoint" TEXT,
ALTER COLUMN
  "oauth_api_url"
DROP NOT NULL
,
ADD
  CONSTRAINT "oidc_column_union_check" CHECK (
    (
      "oauth_api_url" IS NOT NULL
      AND "userinfo_endpoint" IS NULL
      AND "authorization_endpoint" IS NULL
      AND "token_endpoint" IS NULL
    )
    OR (
      "oauth_api_url" IS NULL
      AND "userinfo_endpoint" IS NOT NULL
      AND "authorization_endpoint" IS NOT NULL
      AND "token_endpoint" IS NOT NULL
    )
  );
  `,
} satisfies MigrationExecutor;
