ALTER TABLE "public"."oidc_integrations"
  ADD COLUMN "token_endpoint" text
  , ADD COLUMN "userinfo_endpoint" text
  , ADD COLUMN "authorization_endpoint" text
  , ALTER COLUMN "oauth_api_url" DROP NOT NULL
;
