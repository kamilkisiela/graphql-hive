import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2023.07.27T11.44.36.graphql-endpoint.ts',
  run: ({ sql }) => sql`
    ALTER TABLE "targets"
      ADD COLUMN "graphql_endpoint_url" text
    ;
  `,
} satisfies MigrationExecutor;
