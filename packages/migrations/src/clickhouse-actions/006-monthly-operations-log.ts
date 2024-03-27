import type { Action } from '../clickhouse';

// [ ] test performance

export const action: Action = async exec => {
  await exec(`
    CREATE MATERIALIZED IF NOT EXISTS monthly_operations_log (
      target LowCardinality(String) CODEC(ZSTD(1)),
      date Date32 CODEC(DoubleDelta, ZSTD(1)),
      total UInt32 CODEC(T64, ZSTD(1))
    )
    ENGINE = SummingMergeTree
    PARTITION BY tuple()
    PRIMARY KEY (target)
    ORDER BY (target, date)
    TTL date + INTERVAL 1 YEAR
    SETTINGS index_granularity = 8192
    AS
      SELECT target, date, sum(total) as total FROM (
        SELECT
          target,
          toDate(timestamp) AS date,
          count() AS total
        FROM default.subscription_operations
        GROUP BY target, date
        
        UNION ALL
        
        SELECT
          target,
          toDate(timestamp) AS date,
          count() AS total
        FROM default.operations
        GROUP BY target, date
      ) GROUP BY target, date
  `);
};
