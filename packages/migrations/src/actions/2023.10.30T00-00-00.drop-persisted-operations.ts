import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2023.10.30T00-00-00.drop-persisted-operations.ts',
  run: ({ sql }) => sql`
    DROP TABLE IF EXISTS "persisted_operations";
    DROP TYPE IF EXISTS "operation_kind";
  `,
} satisfies MigrationExecutor;
