ALTER TABLE "public"."users"
  ALTER COLUMN "supertoken_user_id" TYPE varchar(300),
  ALTER COLUMN "external_auth_user_id" TYPE varchar(300)
;
