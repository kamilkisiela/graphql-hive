import type { Action } from '../clickhouse';

export const action: Action = async (exec, _query, isHiveCloud) => {
  let where = 'WHERE notEmpty(organization)';

  if (isHiveCloud) {
    // Starts aggregating data the next day of the migration (deployment)
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const startOfTomorrow = tomorrow.toISOString().split('T')[0];

    where += ` AND toDate(timestamp) >= toDate('${startOfTomorrow}')`;
  }

  await exec(`
    CREATE TABLE IF NOT EXISTS daily_overview
    (
      organization LowCardinality(String) CODEC(ZSTD(1)),
      date Date CODEC(DoubleDelta, ZSTD(1)),
      total UInt32 CODEC(T64, ZSTD(1))
    )
    ENGINE = SummingMergeTree
    PARTITION BY tuple()
    PRIMARY KEY (organization)
    ORDER BY (organization, date)
    TTL date + INTERVAL 2 MONTH
    SETTINGS index_granularity = 8192
  `);

  await exec(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS daily_overview_operations
    TO daily_overview
    AS
      SELECT
        organization,
        toDate(timestamp) AS date,
        count() AS total
      FROM default.operations
      ${where}
      GROUP BY organization, date
  `);

  await exec(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS daily_overview_subscriptions
    TO daily_overview
    AS
      SELECT
        organization,
        toDate(timestamp) AS date,
        count() AS total
      FROM default.subscription_operations
      ${where}
      GROUP BY organization, date
  `);
};
