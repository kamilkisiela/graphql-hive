import type { Action } from '../clickhouse';

const action: Action = async (exec, isGraphQLHiveCloud) => {
  // Create materialized views
  await Promise.all(
    [
      `
        CREATE MATERIALIZED VIEW IF NOT EXISTS default.operations_migration
        (
          target String,
          timestamp AggregateFunction(min, UInt32)
        )
        ENGINE = AggregatingMergeTree() ORDER BY (target)
        AS
        SELECT
          target,
          minState(toUnixTimestamp(timestamp)) as timestamp
        FROM default.operations
        GROUP BY
          target
      `,
      `
        CREATE MATERIALIZED VIEW IF NOT EXISTS default.operations_daily_new
        (
          target LowCardinality(String) CODEC(ZSTD(1)),
          timestamp DateTime('UTC'),
          expires_at DateTime('UTC'),
          hash String CODEC(ZSTD(1)),
          client_name String CODEC(ZSTD(1)),
          total UInt32 CODEC(ZSTD(1)),
          total_ok UInt32 CODEC(ZSTD(1)),
          duration_avg AggregateFunction(avg, UInt64) CODEC(ZSTD(1)),
          duration_quantiles AggregateFunction(quantiles(0.75, 0.9, 0.95, 0.99), UInt64) CODEC(ZSTD(1))
        )
        ENGINE = SummingMergeTree
        PARTITION BY toYYYYMMDD(timestamp)
        PRIMARY KEY (target, hash)
        ORDER BY (target, hash, client_name, timestamp, expires_at)
        TTL expires_at
        SETTINGS index_granularity = 8192 AS
        SELECT
          target,
          toStartOfDay(timestamp) AS timestamp,
          toStartOfDay(expires_at) AS expires_at,
          hash,
          client_name,
          count() AS total,
          sum(ok) AS total_ok,
          avgState(duration) AS duration_avg,
          quantilesState(0.75, 0.9, 0.95, 0.99)(duration) AS duration_quantiles
        FROM default.operations
        GROUP BY
          target,
          hash,
          client_name,
          timestamp,
          expires_at
      `,
      `
        CREATE MATERIALIZED VIEW IF NOT EXISTS default.operations_hourly_new
        (
          target LowCardinality(String) CODEC(ZSTD(1)),
          timestamp DateTime('UTC'),
          expires_at DateTime('UTC'),
          hash String CODEC(ZSTD(1)),
          client_name String CODEC(ZSTD(1)),
          total UInt32 CODEC(ZSTD(1)),
          total_ok UInt32 CODEC(ZSTD(1)),
          duration_avg AggregateFunction(avg, UInt64) CODEC(ZSTD(1)),
          duration_quantiles AggregateFunction(quantiles(0.75, 0.9, 0.95, 0.99), UInt64) CODEC(ZSTD(1))
        )
        ENGINE = SummingMergeTree
        PARTITION BY toYYYYMMDD(timestamp)
        PRIMARY KEY (target, hash)
        ORDER BY (target, hash, client_name, timestamp, expires_at)
        SETTINGS index_granularity = 8192 AS
        SELECT
          target,
          toStartOfHour(timestamp) AS timestamp,
          toStartOfHour(expires_at) AS expires_at,
          hash,
          client_name,
          count() AS total,
          sum(ok) AS total_ok,
          avgState(duration) AS duration_avg,
          quantilesState(0.75, 0.9, 0.95, 0.99)(duration) AS duration_quantiles
        FROM default.operations
        GROUP BY
          target,
          hash,
          client_name,
          timestamp,
          expires_at
    `,
    ].map(exec),
  );

  // Run the rest of the migration only for self-hosted instances, not for Cloud.
  if (isGraphQLHiveCloud) {
    console.log('Detected GraphQL Hive Cloud. Skipping the rest of the migration.');
    // You need to run these two queries and then execute all the statements they output

    // SELECT
    //   partition,
    //   toString(partition) as partition_string,
    //   substring(partition_string, 1, 4) as year,
    //   substring(partition_string, 5, 2) as month,
    //   substring(partition_string, 7, 2) as day,
    //   format('INSERT INTO default.operations_daily_new
    //       SELECT
    //         target,
    //         toStartOfDay(timestamp) AS timestamp,
    //         toStartOfDay(expires_at) AS expires_at,
    //         hash,
    //         client_name,
    //         count() AS total,
    //         sum(ok) AS total_ok,
    //         avgState(duration) AS duration_avg,
    //         quantilesState(0.75, 0.9, 0.95, 0.99)(duration) AS duration_quantiles
    //       FROM
    //       default.operations
    //       WHERE timestamp >= toDateTime(\'{0}-{1}-{2} 00:00:00\', \'UTC\') AND timestamp <= toDateTime(\'{0}-{1}-{2} 23:59:59\', \'UTC\')
    //       GROUP BY
    //         target,
    //         client_name,
    //         client_version,
    //         hash,
    //         timestamp_day,
    //         expires_at
    //   ', year, month, day) as insert_statement
    // FROM
    //   system.parts
    // WHERE
    //   database = 'default'
    //   AND table = 'operations'
    //   AND toInt32(partition) < toInt32((SELECT toYYYYMMDD(fromUnixTimestamp(minMerge(timestamp))) FROM default.operations_migration))
    // GROUP BY
    //   database,
    //   table,
    //   partition
    // ORDER BY
    //   partition ASC
    // ;

    // SELECT
    //   partition,
    //   toString(partition) as partition_string,
    //   substring(partition_string, 1, 4) as year,
    //   substring(partition_string, 5, 2) as month,
    //   substring(partition_string, 7, 2) as day,
    //   format('INSERT INTO default.operations_hourly_new
    //       SELECT
    //         target,
    //         toStartOfDay(timestamp) AS timestamp,
    //         toStartOfDay(expires_at) AS expires_at,
    //         hash,
    //         client_name,
    //         count() AS total,
    //         sum(ok) AS total_ok,
    //         avgState(duration) AS duration_avg,
    //         quantilesState(0.75, 0.9, 0.95, 0.99)(duration) AS duration_quantiles
    //       FROM
    //       default.operations
    //       WHERE timestamp >= toDateTime(\'{0}-{1}-{2} 00:00:00\', \'UTC\') AND timestamp <= toDateTime(\'{0}-{1}-{2} 23:59:59\', \'UTC\')
    //       GROUP BY
    //         target,
    //         client_name,
    //         client_version,
    //         hash,
    //         timestamp_day,
    //         expires_at
    //   ', year, month, day) as insert_statement
    // FROM
    //   system.parts
    // WHERE
    //   database = 'default'
    //   AND table = 'operations'
    //   AND toInt32(partition) < toInt32((SELECT toYYYYMMDD(fromUnixTimestamp(minMerge(timestamp))) FROM default.operations_migration))
    // GROUP BY
    //   database,
    //   table,
    //   partition
    // ORDER BY
    //   partition ASC
    // ;

    return;
  }

  console.log('Detected self-hosted version of GraphQL Hive. Running the rest of the migration.');

  // Copy data
  await exec(`
    INSERT INTO
      default.operations_daily_new
    SELECT
      target,
      toStartOfDay(timestamp) AS timestamp_day,
      toStartOfDay(expires_at) AS expires_at,
      hash,
      client_name,
      count() AS total,
      sum(ok) AS total_ok,
      avgState(duration) AS duration_avg,
      quantilesState(0.75, 0.9, 0.95, 0.99)(duration) AS duration_quantiles
    FROM
      default.operations
    WHERE timestamp < (
      SELECT
        fromUnixTimestamp(
          if(
            minMerge(timestamp) > 0, 
            minMerge(timestamp),
            toUnixTimestamp(now())
          )
        )
      FROM
        default.operations_migration
    )
    GROUP BY
      target,
      client_name,
      client_version,
      hash,
      timestamp_day,
      expires_at
  `);

  await exec(`
    RENAME TABLE
      default.operations_daily TO default.operations_daily_old,
      default.operations_daily_new TO default.operations_daily
  `);

  await exec(`
    INSERT INTO
      default.operations_hourly_new
    SELECT
      target,
      toStartOfHour(timestamp) AS timestamp,
      toStartOfHour(expires_at) AS expires_at,
      hash,
      client_name,
      count() AS total,
      sum(ok) AS total_ok,
      avgState(duration) AS duration_avg,
      quantilesState(0.75, 0.9, 0.95, 0.99)(duration) AS duration_quantiles
    FROM default.operations
    WHERE timestamp < (
      SELECT
        fromUnixTimestamp(
          if(
            minMerge(timestamp) > 0, 
            minMerge(timestamp),
            toUnixTimestamp(now())
          )
        )
      FROM
        default.operations_migration
    )
    GROUP BY
      target,
      hash,
      client_name,
      timestamp,
      expires_at
  `);

  await exec(`
    RENAME TABLE
      default.operations_hourly TO default.operations_hourly_old,
      default.operations_hourly_new TO default.operations_hourly
  `);

  await Promise.all([
    exec(`DROP VIEW default.operations_daily_old`),
    exec(`DROP VIEW default.operations_hourly_old`),
    exec(`DROP VIEW default.operations_migration`),
  ]);
};

export { action };
