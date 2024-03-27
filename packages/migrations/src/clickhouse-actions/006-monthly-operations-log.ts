import type { Action } from '../clickhouse';

export const action: Action = async exec => {
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
    ALTER TABLE operations ADD COLUMN IF NOT EXISTS organization LowCardinality(String) DEFAULT '' CODEC(ZSTD(1))
  `);

  await exec(`
    ALTER TABLE subscription_operations ADD COLUMN IF NOT EXISTS organization LowCardinality(String) DEFAULT CODEC(ZSTD(1))
  `);

  await exec(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_overview_operations
    TO monthly_overview
    AS
      SELECT
        organization,
        toDate(timestamp) AS date,
        count() AS total
      FROM default.operations
      WHERE notEmpty(organization)
      GROUP BY organization, date
  `);

  await exec(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_overview_subscriptions
    TO monthly_overview
    AS
      SELECT
        organization,
        toDate(timestamp) AS date,
        count() AS total
      FROM default.subscription_operations
      WHERE notEmpty(organization)
      GROUP BY organization, date
  `);
};
