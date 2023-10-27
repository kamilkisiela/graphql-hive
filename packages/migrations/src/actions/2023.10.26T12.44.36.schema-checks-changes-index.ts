import { type MigrationExecutor } from '../pg-migrator';


export default {
  name: '2023.10.26T12.44.36.schema-checks-changes-index.ts',
  run: ({ sql }) => sql`
CREATE INDEX "schema_checks_connection_pagination_with_changes" ON "schema_checks" (
  "target_id" ASC
  , "created_at" DESC
  , "id" DESC
)
WHERE
  jsonb_typeof("safe_schema_changes") = 'array'
  OR jsonb_typeof("breaking_schema_changes") = 'array'
;

CREATE INDEX "schema_checks_connection_pagination_with_no_success" ON "schema_checks" (
  "target_id" ASC
  , "created_at" DESC
  , "id" DESC
)
WHERE
  "is_success" = false
  ;

CREATE INDEX "schema_checks_connection_pagination_with_no_success_and_changes" ON "schema_checks" (
  "target_id" ASC
  , "created_at" DESC
  , "id" DESC
)
WHERE
  "is_success" = false
  AND  (
    jsonb_typeof("safe_schema_changes") = 'array'
    OR jsonb_typeof("breaking_schema_changes") = 'array'
  )
;
  `,
} satisfies MigrationExecutor;
