import { sql } from 'slonik';
import { getPool, toDate, tokens } from './db';
import type { Slonik } from './shared';

export async function createTokenStorage(connection: string, maximumPoolSize: number) {
  const pool = await getPool(connection, maximumPoolSize);

  return {
    destroy() {
      return pool.end();
    },
    async isReady() {
      try {
        await pool.exists(sql`SELECT 1`);
        return true;
      } catch {
        return false;
      }
    },
    async getTokens({ target }: { target: string }) {
      const result = await pool.query<Slonik<tokens>>(
        sql`
          SELECT *
          FROM public.tokens
          WHERE
            target_id = ${target}
            AND deleted_at IS NULL
          ORDER BY created_at DESC
        `,
      );

      return result.rows;
    },
    async getToken({ token }: { token: string }) {
      return pool.maybeOne<Slonik<tokens>>(
        sql`
          SELECT *
          FROM public.tokens
          WHERE token = ${token} AND deleted_at IS NULL
          LIMIT 1
        `,
      );
    },
    createToken({
      token,
      tokenAlias,
      target,
      project,
      organization,
      name,
      scopes,
    }: {
      token: string;
      tokenAlias: string;
      name: string;
      target: string;
      project: string;
      organization: string;
      scopes: readonly string[];
    }) {
      return pool.one<Slonik<tokens>>(
        sql`
          INSERT INTO public.tokens
            (name, token, token_alias, target_id, project_id, organization_id, scopes)
          VALUES
            (${name}, ${token}, ${tokenAlias}, ${target}, ${project}, ${organization}, ${sql.array(
          scopes,
          'text',
        )})
          RETURNING *
        `,
      );
    },
    async deleteToken({ token }: { token: string }) {
      await pool.query(
        sql`
          UPDATE public.tokens SET deleted_at = NOW() WHERE token = ${token}
        `,
      );
    },
    async touchTokens({ tokens }: { tokens: Array<{ token: string; date: Date }> }) {
      await pool.query(sql`
        UPDATE public.tokens as t
        SET last_used_at = c.last_used_at
        FROM (
            VALUES
              (${sql.join(
                tokens.map(t => sql`${t.token}, ${toDate(t.date)}`),
                sql`), (`,
              )})
        ) as c(token, last_used_at)
        WHERE c.token = t.token;
      `);
    },
  };
}
