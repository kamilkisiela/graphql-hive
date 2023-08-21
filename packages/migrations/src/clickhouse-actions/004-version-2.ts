import { z } from 'zod';
import type { Action } from '../clickhouse';

export const createSelectStatementForOperationsMinutely = (
  tableName: 'operations' | 'operations_new',
) => `
  SELECT
    target,
    toStartOfMinute(timestamp) AS timestamp,
    hash,
    client_name,
    client_version,
    count() AS total,
    sum(ok) AS total_ok,
    avgState(duration) AS duration_avg,
    quantilesState(0.75, 0.9, 0.95, 0.99)(duration) AS duration_quantiles
  FROM default.${tableName}
  GROUP BY
    target,
    hash,
    client_name,
    client_version,
    timestamp
`;

export const createSelectStatementForOperationsHourly = (
  tableName: 'operations' | 'operations_new',
) => `
  SELECT
    target,
    toStartOfHour(timestamp) AS timestamp,
    hash,
    client_name,
    client_version,
    count() AS total,
    sum(ok) AS total_ok,
    avgState(duration) AS duration_avg,
    quantilesState(0.75, 0.9, 0.95, 0.99)(duration) AS duration_quantiles
  FROM default.${tableName}
  GROUP BY
    target,
    hash,
    client_name,
    client_version,
    timestamp
`;

export const createSelectStatementForOperationsDaily = (
  tableName: 'operations' | 'operations_new',
) => `
  SELECT
    target,
    toStartOfDay(timestamp) AS timestamp,
    toStartOfDay(expires_at) AS expires_at,
    hash,
    client_name,
    client_version,
    count() AS total,
    sum(ok) AS total_ok,
    avgState(duration) AS duration_avg,
    quantilesState(0.75, 0.9, 0.95, 0.99)(duration) AS duration_quantiles
  FROM default.${tableName}
  GROUP BY
    target,
    hash,
    client_name,
    client_version,
    timestamp,
    expires_at
`;

export const createSelectStatementForClientsDaily = (
  tableName: 'operations' | 'operations_new',
) => `
  SELECT
    target,
    client_name,
    client_version,
    hash,
    toStartOfDay(timestamp) AS timestamp,
    toStartOfDay(expires_at) AS expires_at,
    count() AS total
  FROM default.${tableName}
  GROUP BY
    target,
    client_name,
    client_version,
    hash,
    timestamp,
    expires_at
`;

export const createSelectStatementForCoordinatesDaily = (
  tableName: 'operation_collection_new' | 'operation_collection',
) => `
  SELECT
    target,
    hash,
    toStartOfDay(timestamp) AS timestamp,
    toStartOfDay(expires_at) AS expires_at,
    sum(total) AS total,
    coordinate
  FROM default.${tableName}
  ARRAY JOIN coordinates as coordinate
  GROUP BY
    target,
    coordinate,
    hash,
    timestamp,
    expires_at
`;

export const createSelectStatementForOperationCollectionBody = (
  tableName: 'operation_collection_new' | 'operation_collection',
) => `
  SELECT
    target,
    hash,
    body,
    toStartOfDay(expires_at) AS expires_at
  FROM default.${tableName}
  GROUP BY
    target,
    hash,
    body,
    expires_at
`;

export const createSelectStatementForOperationCollectionDetails = (
  tableName: 'operation_collection_new' | 'operation_collection',
) => `
  SELECT
    target,
    name,
    hash,
    operation_kind,
    toStartOfDay(expires_at) AS expires_at
  FROM default.${tableName}
  GROUP BY
    target,
    name,
    hash,
    operation_kind,
    expires_at
`;

const SystemSettingsModel = z.array(
  z.object({
    value: z.string(),
  }),
);

export const action: Action = async (exec, query, isClickHouseCloud) => {
  const allowExperimentalAlterMaterializedViewStructure = await query(
    `
      SELECT value 
      FROM system.settings 
      WHERE name = 'allow_experimental_alter_materialized_view_structure'
      SETTINGS allow_experimental_alter_materialized_view_structure=1`,
  ).then(async r => SystemSettingsModel.parse(r.data)[0]);
  if (allowExperimentalAlterMaterializedViewStructure.value !== '1') {
    throw new Error(
      'Migration is not possible. Please enable allow_experimental_alter_materialized_view_structure system setting.',
    );
  }

  let label = 'Created new tables';
  console.time(label);
  // Create new tables
  await Promise.all(
    [
      // New and improved codec
      `
        CREATE TABLE IF NOT EXISTS default.operation_collection_new
        (
          target LowCardinality(String) CODEC(ZSTD(1)),
          hash String CODEC(ZSTD(1)),
          name String CODEC(ZSTD(1)),
          body String CODEC(ZSTD(1)),
          operation_kind String CODEC(ZSTD(1)),
          coordinates Array(String) CODEC(ZSTD(1)),
          total UInt32 CODEC(T64, ZSTD(1)),
          timestamp DateTime('UTC') CODEC(DoubleDelta, LZ4),
          expires_at DateTime('UTC') CODEC(DoubleDelta, LZ4)
        )
        ENGINE = SummingMergeTree
        PARTITION BY toYYYYMM(timestamp)
        PRIMARY KEY (target, hash)
        ORDER BY (target, hash, timestamp)
        SETTINGS index_granularity = 8192
      `,
      // New and improved codec
      `
      CREATE TABLE IF NOT EXISTS default.operations_new
      (
        target LowCardinality(String) CODEC(ZSTD(1)),
        timestamp DateTime('UTC') CODEC(DoubleDelta, LZ4),
        expires_at DateTime('UTC') CODEC(DoubleDelta, LZ4),
        hash String CODEC(ZSTD(1)),
        ok UInt8 CODEC(ZSTD(1)),
        errors UInt16 CODEC(T64, ZSTD(1)),
        duration UInt64 CODEC(T64, ZSTD(1)),
        client_name LowCardinality(String) CODEC(ZSTD(1)),
        client_version String CODEC(ZSTD(1))
      )
      ENGINE = MergeTree
      PARTITION BY toYYYYMM(timestamp)
      PRIMARY KEY (target, hash)
      ORDER BY (target, hash, timestamp)
      SETTINGS index_granularity = 8192
    `,
    ].map(q => exec(q)),
  );
  console.timeEnd(label);

  label = 'Created new views';
  console.time(label);
  // Create Materialized Views
  await Promise.all(
    [
      // `operations`
      // Completely new view, aggregates data by minute
      `
      CREATE MATERIALIZED VIEW IF NOT EXISTS default.operations_minutely_new
      (
        target LowCardinality(String) CODEC(ZSTD(1)),
        timestamp DateTime('UTC') CODEC(DoubleDelta, LZ4),
        hash String CODEC(ZSTD(1)),
        client_name String CODEC(ZSTD(1)),
        client_version String CODEC(ZSTD(1)),
        total UInt32 CODEC(T64, ZSTD(1)),
        total_ok UInt32 CODEC(T64, ZSTD(1)),
        duration_avg AggregateFunction(avg, UInt64) CODEC(ZSTD(1)),
        duration_quantiles AggregateFunction(quantiles(0.75, 0.9, 0.95, 0.99), UInt64) CODEC(ZSTD(1))
      )
      ENGINE = SummingMergeTree
      PARTITION BY tuple()
      PRIMARY KEY (target, hash)
      ORDER BY (target, hash, client_name, client_version, timestamp)
      TTL timestamp + INTERVAL 24 HOUR
      SETTINGS index_granularity = 8192 AS
      ${createSelectStatementForOperationsMinutely('operations_new')}
    `,
      // Adds TTL to the view, no longer depends on `expires_at`
      // Adds and improves codecs
      `
      CREATE MATERIALIZED VIEW IF NOT EXISTS default.operations_hourly_new
      (
        target LowCardinality(String) CODEC(ZSTD(1)),
        timestamp DateTime('UTC') CODEC(DoubleDelta, LZ4),
        hash String CODEC(ZSTD(1)),
        client_name String CODEC(ZSTD(1)),
        client_version String CODEC(ZSTD(1)),
        total UInt32 CODEC(T64, ZSTD(1)),
        total_ok UInt32 CODEC(T64, ZSTD(1)),
        duration_avg AggregateFunction(avg, UInt64) CODEC(ZSTD(1)),
        duration_quantiles AggregateFunction(quantiles(0.75, 0.9, 0.95, 0.99), UInt64) CODEC(ZSTD(1))
      )
      ENGINE = SummingMergeTree
      PARTITION BY toYYYYMMDD(timestamp)
      PRIMARY KEY (target, hash)
      ORDER BY (target, hash, client_name, client_version, timestamp)
      TTL timestamp + INTERVAL 30 DAY
      SETTINGS index_granularity = 8192 AS
      ${createSelectStatementForOperationsHourly('operations_new')}
    `,
      // Adds and improves codecs
      `
      CREATE MATERIALIZED VIEW IF NOT EXISTS default.operations_daily_new
      (
        target LowCardinality(String) CODEC(ZSTD(1)),
        timestamp DateTime('UTC') CODEC(DoubleDelta, LZ4),
        expires_at DateTime('UTC') CODEC(DoubleDelta, LZ4),
        hash String CODEC(ZSTD(1)),
        client_name String CODEC(ZSTD(1)),
        client_version String CODEC(ZSTD(1)),
        total UInt32 CODEC(T64, ZSTD(1)),
        total_ok UInt32 CODEC(T64, ZSTD(1)),
        duration_avg AggregateFunction(avg, UInt64) CODEC(ZSTD(1)),
        duration_quantiles AggregateFunction(quantiles(0.75, 0.9, 0.95, 0.99), UInt64) CODEC(ZSTD(1))
      )
      ENGINE = SummingMergeTree
      PARTITION BY toYYYYMM(timestamp)
      PRIMARY KEY (target, hash)
      ORDER BY (target, hash, client_name, client_version, timestamp)
      TTL expires_at
      SETTINGS index_granularity = 8192 AS
      ${createSelectStatementForOperationsDaily('operations_new')}
    `,
      // Adds and improves codecs
      `
      CREATE MATERIALIZED VIEW IF NOT EXISTS default.clients_daily_new
      (
        target LowCardinality(String) CODEC(ZSTD(1)),
        client_name String CODEC(ZSTD(1)),
        client_version String CODEC(ZSTD(1)),
        hash String CODEC(ZSTD(1)), 
        timestamp DateTime('UTC') CODEC(DoubleDelta, LZ4),
        expires_at DateTime('UTC') CODEC(DoubleDelta, LZ4),
        total UInt32 CODEC(T64, ZSTD(1)),
        INDEX idx_hash (hash) TYPE set(0) GRANULARITY 1
      )
      ENGINE = SummingMergeTree
      PARTITION BY toYYYYMM(timestamp)
      PRIMARY KEY (target, client_name, client_version)
      ORDER BY (target, client_name, client_version, hash, timestamp)
      TTL expires_at
      SETTINGS index_granularity = 8192
      AS
      ${createSelectStatementForClientsDaily('operations_new')}
    `,
      // `operation_collection`
      // Adds and improves codecs
      `
      CREATE MATERIALIZED VIEW IF NOT EXISTS default.coordinates_daily_new
      (
        target LowCardinality(String) CODEC(ZSTD(1)),
        hash String CODEC(ZSTD(1)), 
        timestamp DateTime('UTC') CODEC(DoubleDelta, LZ4),
        expires_at DateTime('UTC') CODEC(DoubleDelta, LZ4),
        total UInt32 CODEC(T64, ZSTD(1)),
        coordinate String CODEC(ZSTD(1))
      )
      ENGINE = SummingMergeTree
      PARTITION BY toYYYYMM(timestamp)
      PRIMARY KEY (target, coordinate, hash)
      ORDER BY (target, coordinate, hash, timestamp)
      TTL expires_at
      SETTINGS index_granularity = 8192
      AS
      ${createSelectStatementForCoordinatesDaily('operation_collection_new')}
    `,
      // Adds a new view to easily and quickly query operation bodies
      `
      CREATE MATERIALIZED VIEW IF NOT EXISTS default.operation_collection_body_new
      (
        target LowCardinality(String) CODEC(ZSTD(1)),
        hash String CODEC(ZSTD(1)), 
        body String CODEC(ZSTD(1)),
        expires_at DateTime('UTC') CODEC(DoubleDelta, LZ4)
      )
      ENGINE = ReplacingMergeTree
      PARTITION BY toYYYYMM(expires_at)
      PRIMARY KEY (target, hash)
      ORDER BY (target, hash)
      TTL expires_at
      SETTINGS index_granularity = 8192
      AS
      ${createSelectStatementForOperationCollectionBody('operation_collection_new')}
    `,
      // Adds a new view to easily and quickly query operation details
      `
      CREATE MATERIALIZED VIEW IF NOT EXISTS default.operation_collection_details_new
      (
        target LowCardinality(String) CODEC(ZSTD(1)),
        name String CODEC(ZSTD(1)),
        hash String CODEC(ZSTD(1)), 
        operation_kind String CODEC(ZSTD(1)),
        expires_at DateTime('UTC') CODEC(DoubleDelta, LZ4)
      )
      ENGINE = ReplacingMergeTree
      PARTITION BY toYYYYMM(expires_at)
      PRIMARY KEY (target, hash)
      ORDER BY (target, hash)
      TTL expires_at
      SETTINGS index_granularity = 8192
      AS
      ${createSelectStatementForOperationCollectionDetails('operation_collection_new')}
    `,
    ].map(q => exec(q)),
  );
  console.timeEnd(label);

  const totalOperationsResponse = await query(
    `SELECT if(count() > ${50_000_000}, 'big', 'small') as size FROM default.operations`,
  );
  const sizeOfOperationsTable = z
    .array(z.object({ size: z.enum(['small', 'big']) }))
    .parse(totalOperationsResponse.data)[0].size;

  const isBig = sizeOfOperationsTable === 'big';

  if (isClickHouseCloud || isBig) {
    console.log(
      `${
        isBig ? 'Detected more than 50M rows in operations table.' : 'Detected ClickHouse Cloud.'
      }. Follow a manual migration process from now on. See: packages/migrations/src/scripts/004-cloud.ts`,
    );
    return;
  }

  // Insert data from old tables into new tables
  label = 'Inserted data into new tables';
  console.time(label);
  await Promise.all([
    exec(`INSERT INTO default.operations_new SELECT * FROM default.operations`),
    exec(`INSERT INTO default.operation_collection_new SELECT * FROM default.operation_collection`),
  ]);
  console.timeEnd(label);

  label = 'Renamed tables and views';
  console.time(label);
  // Rename tables
  // Old tables
  await Promise.all([
    exec(`RENAME TABLE default.operations TO default.operations_old`),
    exec(`RENAME TABLE default.operation_collection TO default.operation_collection_old`),
  ]);
  // Old views
  await Promise.all([
    exec(`RENAME TABLE default.operations_hourly TO default.operations_hourly_old`),
    exec(`RENAME TABLE default.operations_daily TO default.operations_daily_old`),
    exec(`RENAME TABLE default.coordinates_daily TO default.coordinates_daily_old`),
    exec(`RENAME TABLE default.clients_daily TO default.clients_daily_old`),
  ]);
  // New tables
  await Promise.all([
    exec(`RENAME TABLE default.operations_new TO default.operations`),
    exec(`RENAME TABLE default.operation_collection_new TO default.operation_collection`),
  ]);
  // New views
  await Promise.all([
    exec(`RENAME TABLE default.operations_minutely_new TO default.operations_minutely`),
    exec(`RENAME TABLE default.operations_hourly_new TO default.operations_hourly`),
    exec(`RENAME TABLE default.operations_daily_new TO default.operations_daily`),
    exec(`RENAME TABLE default.coordinates_daily_new TO default.coordinates_daily`),
    exec(`RENAME TABLE default.clients_daily_new TO default.clients_daily`),
    exec(`RENAME TABLE default.operation_collection_body_new TO default.operation_collection_body`),
    exec(
      `RENAME TABLE default.operation_collection_details_new TO default.operation_collection_details`,
    ),
  ]);
  console.timeEnd(label);

  label = 'Modified AS SELECT queries';
  console.time(label);
  const modifyQuerySettings = { allow_experimental_alter_materialized_view_structure: '1' };
  // Modify AS SELECT queries
  await Promise.all([
    exec(
      `
        ALTER TABLE default.operations_minutely
        MODIFY QUERY ${createSelectStatementForOperationsMinutely('operations')}
      `,
      modifyQuerySettings,
    ),
    exec(
      `
        ALTER TABLE default.operations_hourly
        MODIFY QUERY ${createSelectStatementForOperationsHourly('operations')}
      `,
      modifyQuerySettings,
    ),
    exec(
      `
        ALTER TABLE default.operations_daily
        MODIFY QUERY ${createSelectStatementForOperationsDaily('operations')}
      `,
      modifyQuerySettings,
    ),
    exec(
      `
        ALTER TABLE default.coordinates_daily
        MODIFY QUERY ${createSelectStatementForCoordinatesDaily('operation_collection')}
      `,
      modifyQuerySettings,
    ),
    exec(
      `
        ALTER TABLE default.clients_daily
        MODIFY QUERY ${createSelectStatementForClientsDaily('operations')}
      `,
      modifyQuerySettings,
    ),
    exec(
      `
        ALTER TABLE default.operation_collection_body
        MODIFY QUERY ${createSelectStatementForOperationCollectionBody('operation_collection')}
      `,
      modifyQuerySettings,
    ),
    exec(
      `
        ALTER TABLE default.operation_collection_details
        MODIFY QUERY ${createSelectStatementForOperationCollectionDetails('operation_collection')}
      `,
      modifyQuerySettings,
    ),
  ]);
  console.timeEnd(label);

  label = 'Applied TTLs to new tables';
  console.time(label);
  // Apply TTLs to new tables
  await Promise.all([
    exec(`ALTER TABLE default.operations MODIFY TTL timestamp + INTERVAL 3 HOUR`),
    exec(`ALTER TABLE default.operation_collection MODIFY TTL timestamp + INTERVAL 3 HOUR`),
  ]);
  console.timeEnd(label);

  label = 'Dropped old tables and views';
  console.time(label);
  // Drop old tables
  await Promise.all([
    exec(`DROP TABLE default.operations_old`),
    exec(`DROP TABLE default.operation_collection_old`),
  ]);
  // Drop old views
  await Promise.all([
    exec(`DROP TABLE default.operations_hourly_old`),
    exec(`DROP TABLE default.operations_daily_old`),
    exec(`DROP TABLE default.coordinates_daily_old`),
    exec(`DROP TABLE default.clients_daily_old`),
  ]);
  console.timeEnd(label);
};
