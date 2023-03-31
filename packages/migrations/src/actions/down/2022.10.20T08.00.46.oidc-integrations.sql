DROP TABLE IF EXISTS
  "oidc_integrations";

ALTER TABLE
  "public"."users"
DROP COLUMN
  "oidc_integration_id";
