CREATE TABLE "public"."cdn_access_tokens" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4()
  , "target_id" uuid REFERENCES "targets"("id") NOT NULL ON DELETE CASCADE
  , "s3_key" text UNIQUE NOT NULL
  , "first_characters" text NOT NULL
  , "last_characters" text NOT NULL
  , "alias" text NOT NULL
  , "created_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE INDEX cdn_access_tokens_pagination ON "public"."cdn_access_tokens" (
  "target_id" ASC
  , "created_at" DESC
  , "id" DESC
);
