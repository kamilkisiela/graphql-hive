import type { Action } from '../clickhouse';

export const action: Action = async exec => {
  await exec(`
    CREATE TABLE IF NOT EXISTS monthly_overview
    (
      target LowCardinality(String) CODEC(ZSTD(1)),
      date Date CODEC(DoubleDelta, ZSTD(1)),
      total UInt32 CODEC(T64, ZSTD(1))
    )
    ENGINE = SummingMergeTree
    PARTITION BY tuple()
    PRIMARY KEY (target)
    ORDER BY (target, date)
    TTL date + INTERVAL 1 YEAR
    SETTINGS index_granularity = 8192
  `);

  await exec(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_operations_log
    TO monthly_overview
    AS
      SELECT
        target,
        toDate(timestamp) AS date,
        count() AS total
      FROM default.operations
      GROUP BY target, date
  `);

  await exec(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_subscriptions_log
    TO monthly_overview
    AS
      SELECT
        target,
        toDate(timestamp) AS date,
        count() AS total
      FROM default.subscription_operations
      GROUP BY target, date
  `);
};
