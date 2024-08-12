import { pgSql, Storage } from '@hive/api';
import { createTask } from './utils.js';

export const monthlyDeduplicationCleanupTask = createTask(null, async (_, helpers) => {
  // TODO: check perf
  // It runs every 1 hour, so it should be fine
  await helpers.context.storage.pool.query(pgSql`
    DELETE FROM job_monthly_deduplication WHERE created_at <= NOW() - INTERVAL '1 month'
  `);
});

export async function ensureMonthlyDedupeKey(pool: Storage['pool'], key: string) {
  const result = await pool.query<{
    key: string;
    created_at: unknown;
  }>(pgSql`
    INSERT INTO job_monthly_deduplication (key, created_at)
    VALUES (${key}, NOW())
    ON CONFLICT (key) 
    DO UPDATE SET created_at = EXCLUDED.created_at
    WHERE job_monthly_deduplication.created_at < NOW() - INTERVAL '1 month'
    RETURNING key, created_at
  `);

  return result.rowCount === 0;
}

export async function rollbackMonthlyDedupeKey(pool: Storage['pool'], key: string) {
  await pool.query(pgSql`
    DELETE FROM job_monthly_deduplication WHERE key = ${key}
  `);
}
