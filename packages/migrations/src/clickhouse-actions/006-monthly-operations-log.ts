import zod from 'zod';
import type { Action } from '../clickhouse';

const MigrationRequirements = zod.object({
  CLICKHOUSE_MIGRATION_006_DATE: zod
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD format required'),
});

export const action: Action = async (exec, _query, isHiveCloud) => {
  let insertAfterDate: string | null = null;
  let where = 'notEmpty(organization)';

  if (isHiveCloud) {
    // eslint-disable-next-line no-process-env
    const { CLICKHOUSE_MIGRATION_006_DATE } = MigrationRequirements.parse(process.env);

    const date = new Date(CLICKHOUSE_MIGRATION_006_DATE);
    const startOfToday = new Date(new Date().toISOString().split('T')[0]);

    if (date <= startOfToday) {
      throw new Error('Date must point to future day');
    }

    insertAfterDate = CLICKHOUSE_MIGRATION_006_DATE;
  }

  if (isHiveCloud) {
    // Hive Cloud needs to perform a migration and insert data from previous months.
    // This is not needed for Hive On-Premise, as the data is only relevant for rate-limiting and billing.
    //
    // In order to do that, we need to control the starting point of the migration.
    // We can't start inserting data from the middle of the day,
    // because of the TTL constraints of `operations` table.
    // We can't also rely on the hourly aggregation as it's rounded to the start of the hour,
    // and it would lead to inaccurate data.
    //
    // The solution is to start accepting operations that happened after 00:00:00 of X day.
    // This way we can use daily aggregation to calculate the amount of operations from the current month,
    // before the migration started, and update the `monthly_overview` table to reflect that.
    //
    // For previous months, we can use the daily aggregation as well, and update `monthly_overview` table with count() over month.

    if (!insertAfterDate) {
      throw new Error('Oh no! The date is not set!');
    }

    where = ` AND toDate(timestamp) >= toDate('${insertAfterDate}')`;
  }

  await exec(`
    CREATE TABLE IF NOT EXISTS monthly_overview
    (
      organization LowCardinality(String) CODEC(ZSTD(1)),
      date Date CODEC(DoubleDelta, ZSTD(1)),
      total UInt32 CODEC(T64, ZSTD(1))
    )
    ENGINE = SummingMergeTree
    PARTITION BY tuple()
    PRIMARY KEY (organization)
    ORDER BY (organization, date)
    TTL date + INTERVAL 1 YEAR
    SETTINGS index_granularity = 8192
  `);

  await exec(`
    ALTER TABLE operations
    ADD COLUMN IF NOT EXISTS organization LowCardinality(String) DEFAULT '' CODEC(ZSTD(1))
  `);

  await exec(`
    ALTER TABLE subscription_operations
    ADD COLUMN IF NOT EXISTS organization LowCardinality(String) DEFAULT '' CODEC(ZSTD(1))
  `);

  await exec(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_overview_operations
    TO monthly_overview
    AS
      SELECT
        organization,
        toDate(toStartOfMonth(timestamp)) AS date,
        count() AS total
      FROM default.operations
      WHERE ${where}
      GROUP BY organization, date
  `);

  await exec(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_overview_subscriptions
    TO monthly_overview
    AS
      SELECT
        organization,
        toDate(toStartOfMonth(timestamp)) AS date,
        count() AS total
      FROM default.subscription_operations
      WHERE ${where}
      GROUP BY organization, date
  `);
};
