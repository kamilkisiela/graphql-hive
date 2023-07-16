import { type MigrationExecutor } from "../pg-migrator"

export default {
  name: '2023.01.12T17.00.23.cdn-tokens.sql',
  run: ({ sql }) => sql`
CREATE TABLE
  "public"."cdn_access_tokens" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    "target_id" UUID NOT NULL REFERENCES "targets" ("id") ON DELETE CASCADE,
    "s3_key" TEXT UNIQUE NOT NULL,
    "first_characters" TEXT NOT NULL,
    "last_characters" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  );

CREATE INDEX
  cdn_access_tokens_pagination ON "public"."cdn_access_tokens" ("target_id" ASC, "created_at" DESC, "id" DESC);
  `,
} satisfies MigrationExecutor
