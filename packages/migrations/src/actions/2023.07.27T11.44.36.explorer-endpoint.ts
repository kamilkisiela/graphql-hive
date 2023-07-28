import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2023.07.27T11.44.36.explorer-endpoint.ts',
  run: ({ sql }) => sql`
    ALTER TABLE "public"."targets"
      ADD COLUMN "explorer_endpoint_url" text
    ;
  `,
} satisfies MigrationExecutor;
