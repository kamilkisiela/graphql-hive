import { got } from 'got';
import { config } from '../src/env';

const create_operations_new_query = /* SQL */ `
  CREATE TABLE IF NOT EXISTS default.operations_new
  (
    target LowCardinality(String) CODEC(ZSTD(1)),
    timestamp DateTime('UTC'),
    expires_at DateTime('UTC'),
    hash String CODEC(ZSTD(1)),
    ok UInt8 CODEC(ZSTD(1)),
    errors UInt16 CODEC(ZSTD(1)),
    duration UInt64 CODEC(ZSTD(1)),
    schema Array(String) CODEC(ZSTD(1)),
    client_name LowCardinality(String) CODEC(ZSTD(1)),
    client_version String CODEC(ZSTD(1)),
    INDEX idx_schema schema TYPE bloom_filter(0.01) GRANULARITY 3,
    INDEX idx_ok ok TYPE minmax GRANULARITY 1,
    INDEX idx_errors errors TYPE minmax GRANULARITY 1
  )
  ENGINE = MergeTree
  PARTITION BY toYYYYMMDD(timestamp)
  PRIMARY KEY (target, hash, timestamp)
  ORDER BY (target, hash, timestamp)
  TTL expires_at
  SETTINGS index_granularity = 8192
`;

const create_operations_new_hourly_mv_query = /* SQL */ `
  CREATE MATERIALIZED VIEW IF NOT EXISTS default.operations_new_hourly_mv
  (
      target LowCardinality(String) CODEC(ZSTD(1)),
      timestamp DateTime('UTC'),
      hash String CODEC(ZSTD(1)),
      total UInt32 CODEC(ZSTD(1)),
      total_ok UInt32 CODEC(ZSTD(1)),
      duration_avg AggregateFunction(avg, UInt64) CODEC(ZSTD(1)),
      duration_quantiles AggregateFunction(quantiles(0.75, 0.9, 0.95, 0.99), UInt64) CODEC(ZSTD(1))
  )
  ENGINE = SummingMergeTree
  PARTITION BY toYYYYMMDD(timestamp)
  PRIMARY KEY (target, hash, timestamp)
  ORDER BY (target, hash, timestamp)
  SETTINGS index_granularity = 8192 AS
  SELECT
    target,
    toStartOfHour(timestamp) AS timestamp,
    hash,
    count() AS total,
    sum(ok) AS total_ok,
    avgState(duration) AS duration_avg,
    quantilesState(0.75, 0.9, 0.95, 0.99)(duration) AS duration_quantiles
  FROM default.operations_new
  GROUP BY
    target,
    hash,
    timestamp
`;

const create_operations_registry_query = /* SQL */ `
  CREATE TABLE IF NOT EXISTS default.operations_registry
  (
    target LowCardinality(String),
    hash String,
    name String,
    body String,
    operation String,
    inserted_at DateTime('UTC') DEFAULT toDateTime(0)
  )
  ENGINE = ReplacingMergeTree(inserted_at)
  PARTITION BY target
  ORDER BY (target, hash)
  SETTINGS index_granularity = 8192
`;

const create_schema_coordinates_daily_query = `
  CREATE MATERIALIZED VIEW IF NOT EXISTS default.schema_coordinates_daily
  (
    target LowCardinality(String) CODEC(ZSTD(1)),
    hash String CODEC(ZSTD(1)), 
    timestamp DateTime('UTC'),
    total UInt32 CODEC(ZSTD(1)),
    coordinate String CODEC(ZSTD(1))
  )
  ENGINE = SummingMergeTree
  PARTITION BY toYYYYMMDD(timestamp)
  PRIMARY KEY (target, coordinate, hash)
  ORDER BY (target, coordinate, hash)
  SETTINGS index_granularity = 8192
  AS
  SELECT
    target,
    hash,
    toStartOfDay(timestamp) AS timestamp,
    count() AS total,
    coordinate
  FROM default.operations_new
  ARRAY JOIN schema as coordinate
  GROUP BY
    target,
    coordinate,
    hash,
    timestamp
`;

const create_client_names_daily_query = `
  CREATE MATERIALIZED VIEW IF NOT EXISTS default.client_names_daily
  (
    target LowCardinality(String) CODEC(ZSTD(1)),
    client_name String CODEC(ZSTD(1)),
    hash String CODEC(ZSTD(1)), 
    timestamp DateTime('UTC'),
    total UInt32 CODEC(ZSTD(1))
  )
  ENGINE = SummingMergeTree
  PARTITION BY toYYYYMMDD(timestamp)
  PRIMARY KEY (target, client_name, hash)
  ORDER BY (target, client_name, hash)
  SETTINGS index_granularity = 8192
  AS
  SELECT
    target,
    client_name,
    hash,
    toStartOfDay(timestamp) AS timestamp,
    count() AS total
  FROM default.operations_new
  GROUP BY
    target,
    client_name,
    hash,
    timestamp
`;

export async function migrateClickHouse() {
  if (process.env.CLICKHOUSE_MIGRATOR !== 'up') {
    console.log('Skipping ClickHouse migration');
    return;
  }

  const endpoint = `${config.clickhouse.protocol}://${config.clickhouse.host}:${config.clickhouse.port}`;

  console.log('Migrating ClickHouse');
  console.log('Endpoint:', endpoint);
  console.log('Username:', config.clickhouse.username);
  console.log('Password:', config.clickhouse.password?.length);

  const queries = [
    create_operations_registry_query,
    create_operations_new_query,
    create_operations_new_hourly_mv_query,
    create_schema_coordinates_daily_query,
    create_client_names_daily_query,
  ];

  for await (const query of queries) {
    await got
      .post(endpoint, {
        body: query,
        searchParams: {
          default_format: 'JSON',
          wait_end_of_query: '1',
        },
        timeout: {
          request: 10_000,
        },
        headers: {
          Accept: 'text/plain',
        },
        username: config.clickhouse.username,
        password: config.clickhouse.password,
      })
      .catch(error => {
        const body = error?.response?.body;
        if (body) {
          console.error(body);
        }

        return Promise.reject(error);
      });
  }
}
