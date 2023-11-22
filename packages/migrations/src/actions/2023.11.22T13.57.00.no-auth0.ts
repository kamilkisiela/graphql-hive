import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2023.11.22T13.57.00.no-auth0.ts',
  async run({ sql, connection }) {
    // delete organizations where the owner is not a supertoken user and the plan is HOBBY
    await connection.query(
      sql`
        DELETE FROM organizations WHERE user_id = ANY(
          SELECT id FROM users WHERE supertoken_user_id IS NULL
        )
      `,
    );
    // delete organization membership where the user is not a supertoken user
    await connection.query(
      sql`
        DELETE FROM organization_member WHERE user_id = ANY(
          SELECT id FROM users WHERE supertoken_user_id IS NULL
        )
      `,
    );
    // delete users where the supertoken_user_id is null
    await connection.query(
      sql`
        DELETE FROM users WHERE supertoken_user_id IS NULL
      `,
    );
  },
} satisfies MigrationExecutor;
