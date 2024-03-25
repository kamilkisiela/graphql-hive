import type { Action } from '../clickhouse';

export const action: Action = async exec => {
  await exec(`
    CREATE TABLE IF NOT EXISTS subscription_operations (
      target LowCardinality(String) CODEC(ZSTD(1)),
      timestamp DateTime('UTC') CODEC(DoubleDelta, LZ4),
      expires_at DateTime('UTC') CODEC(DoubleDelta, LZ4),
      hash String CODEC(ZSTD(1)),
      client_name LowCardinality(String) CODEC(ZSTD(1)),
      client_version String CODEC(ZSTD(1))
    )
    ENGINE = MergeTree
    PARTITION BY toYYYYMM(timestamp)
    PRIMARY KEY (target, hash)
    ORDER BY (target, hash, timestamp)
    SETTINGS index_granularity = 8192
  `);

  await exec(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS default.subscription_operations_daily (
      target LowCardinality(String) CODEC(ZSTD(1)),
      timestamp DateTime('UTC') CODEC(DoubleDelta, LZ4),
      expires_at DateTime('UTC') CODEC(DoubleDelta, LZ4),
      hash String CODEC(ZSTD(1)),
      client_name String CODEC(ZSTD(1)),
      client_version String CODEC(ZSTD(1)),
      total UInt32 CODEC(T64, ZSTD(1))
    )
    ENGINE = SummingMergeTree
    PARTITION BY toYYYYMM(timestamp)
    PRIMARY KEY (target, hash)
    ORDER BY (target, hash, client_name, client_version, timestamp)
    TTL expires_at
    SETTINGS index_granularity = 8192 AS
      SELECT
        target,
        hash,
        client_name,
        client_version,
        toStartOfDay(timestamp) AS timestamp,
        toStartOfDay(expires_at) AS expires_at,
        count() AS total
      FROM default.subscription_operations
      GROUP BY
        target,
        hash,
        client_name,
        client_version,
        timestamp,
        expires_at
  `);

  await exec(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS default.subscription_target_existence
    (
      target LowCardinality(String) CODEC(ZSTD(1)),
      expires_at DateTime('UTC') CODEC(DoubleDelta, LZ4)
    )
    ENGINE = ReplacingMergeTree
    PARTITION BY tuple()
    PRIMARY KEY (target)
    ORDER BY (target)
    TTL expires_at
    SETTINGS index_granularity = 8192
    AS
      SELECT
        target,
        toStartOfDay(expires_at) AS expires_at
      FROM default.subscription_operations
      GROUP BY
        target,
        expires_at
  `);
};
