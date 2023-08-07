/**
 * This migration is a bit tricky.
 * We want to fix here a missing `hash` column in the `ORDER BY` of `clients_daily` materialized view.
 * Because we can't simply add a column to the `ORDER BY` of an existing materialized view, we need to create a new one, called `clients_daily_new`.
 *
 * The problem is that the `timestamp` column of `clients_daily` and `clients_daily_new` views represents the start of the day.
 * All rows available in the `clients_daily_new` from the same day, share the same `timestamp` value.
 * We’re not able to tell when the first row was written, meaning we won’t be able to backfill data from the first part of the day as well… It sucks 😿
 *
 * The solution is to create two materialized views at the same time (similar time, it can’t be done at the same time 🥲).
 * One represents the view we want to create (`clients_daily_new`),
 * the other one is a helper view (`clients_daily_migration`) that gives us the point in time the data started flowing.
 */
import type { Action } from '../clickhouse';

const action: Action = async (exec, _query, isGraphQLHiveCloud) => {
  // Create materialized views
  await Promise.all(
    [
      `
      CREATE MATERIALIZED VIEW IF NOT EXISTS default.clients_daily_migration
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
      CREATE MATERIALIZED VIEW IF NOT EXISTS default.clients_daily_new
      (
        target LowCardinality(String) CODEC(ZSTD(1)),
        client_name String CODEC(ZSTD(1)),
        client_version String CODEC(ZSTD(1)),
        hash String CODEC(ZSTD(1)), 
        timestamp DateTime('UTC'),
        expires_at DateTime('UTC'),
        total UInt32 CODEC(ZSTD(1)),
        INDEX idx_hash (hash) TYPE set(0) GRANULARITY 1
      )
      ENGINE = SummingMergeTree
      PARTITION BY toYYYYMMDD(timestamp)
      PRIMARY KEY (target, client_name, client_version)
      ORDER BY (target, client_name, client_version, hash, timestamp, expires_at)
      TTL expires_at
      SETTINGS index_granularity = 8192
      AS
      SELECT
        target,
        client_name,
        client_version,
        hash,
        toStartOfDay(timestamp) AS timestamp,
        toStartOfDay(expires_at) AS expires_at,
        count() AS total
      FROM default.operations
      GROUP BY
        target,
        client_name,
        client_version,
        hash,
        timestamp,
        expires_at
    `,
    ].map(exec),
  );

  // Run the rest of the migration only for self-hosted instances, not for Cloud.
  if (isGraphQLHiveCloud) {
    console.log('Detected GraphQL Hive Cloud. Skipping the rest of the migration.');
    // In case of Cloud, we need to perform it in a different, more complicated way.
    // We need to insert partition by partition, because otherwise it will take too much time and resources.
    // The query below will generate a list of insert statements we need to run.
    /*
    SELECT
      partition,
      toString(partition) as partition_string,
      substring(partition_string, 1, 4) as year,
      substring(partition_string, 5, 2) as month,
      substring(partition_string, 7, 2) as day,
      format('INSERT INTO default.clients_daily_new
          SELECT
            target,
            client_name,
            client_version,
            hash,
            toStartOfDay(timestamp) AS timestamp,
            toStartOfDay(expires_at) AS expires_at,
            count() AS total
          FROM default.operations
          WHERE timestamp >= toDateTime({0}-{1}-{2} 00:00:00, UTC) AND timestamp <= toDateTime({0}-{1}-{2} 23:59:59, UTC)
          GROUP BY
            target,
            client_name,
            client_version,
            hash,
            timestamp,
            expires_at'
      , year, month, day) as insert_statement
    FROM
      system.parts
    WHERE
      database = 'default'
      AND table = 'operations'
      AND toInt32(partition) < toInt32((SELECT toYYYYMMDD(fromUnixTimestamp(minMerge(timestamp))) FROM default.clients_daily_migration))
    GROUP BY
      database,
      table,
      partition
    ORDER BY
      partition ASC
    */
    return;
  }

  console.log('Detected self-hosted version of GraphQL Hive. Running the rest of the migration.');

  // Copy data
  await exec(`
    INSERT INTO default.clients_daily_new
    SELECT
      target,
      client_name,
      client_version,
      hash,
      toStartOfDay(timestamp) AS timestamp_day,
      toStartOfDay(expires_at) AS expires_at,
      count() AS total
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
        FROM default.clients_daily_migration
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
    RENAME TABLE default.clients_daily TO default.clients_daily_old, default.clients_daily_new TO default.clients_daily
  `);

  await Promise.all([
    exec(`DROP VIEW default.clients_daily_old`),
    exec(`DROP VIEW default.clients_daily_migration`),
  ]);
};

export { action };
