import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2023.09.28T14.14.14.native-fed-v2.ts',
  run: ({ sql }) => sql`ALTER TABLE "projects" ADD COLUMN native_federation BOOLEAN DEFAULT FALSE;`,
} satisfies MigrationExecutor;
