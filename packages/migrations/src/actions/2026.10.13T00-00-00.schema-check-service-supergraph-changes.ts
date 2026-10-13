import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2026.10.13T00-00-00.schema-check-service-supergraph-changes.ts',
  run: ({ psql }) => psql`
    ALTER TABLE "schema_checks"
      ADD COLUMN "service_schema_changes" jsonb
      , ADD COLUMN "supergraph_schema_changes" jsonb
    ;

    ALTER TABLE "contract_checks"
      ADD COLUMN "supergraph_schema_changes" jsonb
    ;
  `,
} satisfies MigrationExecutor;
