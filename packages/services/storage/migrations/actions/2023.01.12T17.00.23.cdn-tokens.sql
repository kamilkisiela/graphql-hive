CREATE TABLE "public"."cdn_access_tokens" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4()
  , "target_id" uuid REFERENCES "targets"("id") NOT NULL
  , "s3_key" text UNIQUE NOT NULL
  , "first_characters" text NOT NULL
  , "last_characters" text NOT NULL
  , "is_revoked" boolean NOT NULL DEFAULT false
  , "created_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE INDEX cdn_access_tokens_pagination ON "public"."cdn_access_tokens" (
  "target_id" asc
  , "created_at" desc
  , "id" desc
);
