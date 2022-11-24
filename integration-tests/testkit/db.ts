import { sql, DatabasePoolConnection } from 'slonik';

export const resetDb = async (conn: DatabasePoolConnection) => {
  const migrationTables = ['migrations'];

  const result = await conn.many<{ tablename: string }>(sql`
    SELECT "tablename"
    FROM "pg_tables"
    WHERE "schemaname" = 'public';
  `);

  const tablenames = result
    .map(({ tablename }) => tablename)
    .filter(tablename => !migrationTables.includes(tablename));

  if (tablenames.length) {
    await conn.query(sql`
      TRUNCATE TABLE 
        ${sql.join(
          tablenames.map(name => sql.identifier([name])),
          sql`,`,
        )}
        RESTART IDENTITY
      ;
    `);
  }
};
