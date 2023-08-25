import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2023.11.22T13.57.00.no-auth0.ts',
  run: ({ sql }) => sql`
    delete from users where supertoken_user_id is null
  `,
} satisfies MigrationExecutor;
