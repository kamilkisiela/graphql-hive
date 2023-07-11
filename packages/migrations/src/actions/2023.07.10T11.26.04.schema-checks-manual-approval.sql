ALTER TABLE "public"."schema_checks"
  ADD COLUMN "github_check_run_id" integer
  , ADD COLUMN "is_manually_approved" boolean
  , ADD COLUMN "manual_approval_user_id" uuid REFERENCES "users" ("id") ON DELETE SET NULL
;
