import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2024.08.08T00-00-00.graphile-worker.ts',
  run: ({ sql }) => sql`
    CREATE TABLE job_monthly_deduplication (
      key TEXT PRIMARY KEY,
      created_at TIMESTAMP NOT NULL
    );

    CREATE INDEX idx_job_monthly_deduplication_key ON job_monthly_deduplication(key);
    CREATE INDEX idx_job_monthly_deduplication_created_at ON job_monthly_deduplication(created_at);
  `,
} satisfies MigrationExecutor;
