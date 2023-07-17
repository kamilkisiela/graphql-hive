import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2023.05.08T12.23.45.clean-invalid-schema-version-changes.sql',
  run: ({ sql }) => sql`
DELETE 
FROM
  "public"."schema_version_changes" "svc"
WHERE 
  "svc"."change_type" = 'REGISTRY_SERVICE_URL_CHANGED'
  AND (
    NOT "svc"."meta"->'serviceUrls' ? 'new'
    OR NOT "svc"."meta"->'serviceUrls' ? 'old'
  )
;
  `,
} satisfies MigrationExecutor;
