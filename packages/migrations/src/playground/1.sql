CREATE TABLE IF NOT EXISTS default.operation_collection_1
(
  target LowCardinality(String) CODEC(ZSTD(1)),
  hash String CODEC(ZSTD(1)),
  name String CODEC(ZSTD(1)),
  body String CODEC(ZSTD(1)),
  operation_kind String CODEC(ZSTD(1)),
  coordinates Array(String) CODEC(ZSTD(1)),
  total UInt32 CODEC(T64, ZSTD(1)),
  timestamp DateTime('UTC') CODEC(DoubleDelta, LZ4),
  expires_at DateTime('UTC') CODEC(DoubleDelta, LZ4),
  INDEX idx_operation_kind (operation_kind) TYPE set(0) GRANULARITY 1
)
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(timestamp)
PRIMARY KEY (target, hash)
ORDER BY (target, hash, timestamp, expires_at)
TTL timestamp + INTERVAL 1 DAY
SETTINGS index_granularity = 8192

-- 75134323 rows in 1163 seconds (64604 rows/s)
-- 3B rows in 1 day

CREATE TABLE IF NOT EXISTS default.operations_1
(
  target LowCardinality(String) CODEC(ZSTD(1)),
  timestamp DateTime('UTC') CODEC(DoubleDelta, LZ4),
  expires_at DateTime('UTC') CODEC(DoubleDelta, LZ4),
  hash String CODEC(ZSTD(1)),
  ok UInt8 CODEC(ZSTD(1)),
  errors UInt16 CODEC(T64, ZSTD(1)),
  duration UInt64 CODEC(T64, ZSTD(1)),
  client_name LowCardinality(String) CODEC(ZSTD(1)),
  client_version String CODEC(ZSTD(1)),
  INDEX idx_client_name (client_name) TYPE set(0) GRANULARITY 1,
  INDEX idx_hash (hash) TYPE set(0) GRANULARITY 1
)
ENGINE = MergeTree
PARTITION BY toYYYYMMDD(timestamp)
PRIMARY KEY (target, hash)
ORDER BY (target, hash, timestamp)
TTL timestamp + INTERVAL 1 DAY
SETTINGS index_granularity = 8192

CREATE MATERIALIZED VIEW IF NOT EXISTS default.operations_hourly_1
(
  target LowCardinality(String) CODEC(ZSTD(1)),
  timestamp DateTime('UTC') CODEC(DoubleDelta, LZ4),
  expires_at DateTime('UTC') CODEC(DoubleDelta, LZ4),
  hash String CODEC(ZSTD(1)),
  client_name String CODEC(ZSTD(1)),
  total UInt32 CODEC(T64, ZSTD(1)),
  total_ok UInt32 CODEC(T64, ZSTD(1)),
  duration_avg AggregateFunction(avg, UInt64) CODEC(ZSTD(1)),
  duration_quantiles AggregateFunction(quantiles(0.75, 0.9, 0.95, 0.99), UInt64) CODEC(ZSTD(1))
)
ENGINE = SummingMergeTree
PARTITION BY tuple()
PRIMARY KEY (target, hash)
ORDER BY (target, hash, client_name, timestamp, expires_at)
TTL timestamp + INTERVAL 7 DAY
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
FROM default.operations_1
GROUP BY
  target,
  hash,
  client_name,
  timestamp,
  expires_at

CREATE MATERIALIZED VIEW IF NOT EXISTS default.operations_daily_1
(
  target LowCardinality(String) CODEC(ZSTD(1)),
  timestamp DateTime('UTC') CODEC(DoubleDelta, LZ4),
  expires_at DateTime('UTC') CODEC(DoubleDelta, LZ4),
  hash String CODEC(ZSTD(1)),
  client_name String CODEC(ZSTD(1)),
  total UInt32 CODEC(T64, ZSTD(1)),
  total_ok UInt32 CODEC(T64, ZSTD(1)),
  duration_avg AggregateFunction(avg, UInt64) CODEC(ZSTD(1)),
  duration_quantiles AggregateFunction(quantiles(0.75, 0.9, 0.95, 0.99), UInt64) CODEC(ZSTD(1))
)
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(timestamp)
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
FROM default.operations_1
GROUP BY
  target,
  hash,
  client_name,
  timestamp,
  expires_at
  
CREATE MATERIALIZED VIEW IF NOT EXISTS default.operations_minutely_1
(
  target LowCardinality(String) CODEC(ZSTD(1)),
  timestamp DateTime('UTC') CODEC(DoubleDelta, LZ4),
  expires_at DateTime('UTC') CODEC(DoubleDelta, LZ4),
  hash String CODEC(ZSTD(1)),
  client_name String CODEC(ZSTD(1)),
  total UInt32 CODEC(T64, ZSTD(1)),
  total_ok UInt32 CODEC(T64, ZSTD(1)),
  duration_avg AggregateFunction(avg, UInt64) CODEC(ZSTD(1)),
  duration_quantiles AggregateFunction(quantiles(0.75, 0.9, 0.95, 0.99), UInt64) CODEC(ZSTD(1))
)
ENGINE = SummingMergeTree
PARTITION BY tuple()
PRIMARY KEY (target, hash)
ORDER BY (target, hash, client_name, timestamp, expires_at)
TTL timestamp + INTERVAL 12 HOUR
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
FROM default.operations_1
GROUP BY
  target,
  hash,
  client_name,
  timestamp,
  expires_at

CREATE MATERIALIZED VIEW IF NOT EXISTS default.coordinates_daily_1
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
ORDER BY (target, coordinate, hash, timestamp, expires_at)
TTL expires_at
SETTINGS index_granularity = 8192
AS
SELECT
  target,
  hash,
  toStartOfDay(timestamp) AS timestamp,
  toStartOfDay(expires_at) AS expires_at,
  sum(total) AS total,
  coordinate
FROM default.operation_collection_1
ARRAY JOIN coordinates as coordinate
GROUP BY
  target,
  coordinate,
  hash,
  timestamp,
  expires_at

CREATE MATERIALIZED VIEW IF NOT EXISTS default.clients_daily_1
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
FROM default.operations_1
GROUP BY
  target,
  client_name,
  client_version,
  hash,
  timestamp,
  expires_at

-- This stores `body` per `hash` and `target`.
-- It deduplicates the rows and stores them only once.
-- Should significantly reduce the size of the original table.
CREATE MATERIALIZED VIEW IF NOT EXISTS default.operation_collection_body_1
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
SELECT
  target,
  hash,
  body,
  toStartOfDay(expires_at) AS expires_at
FROM default.operation_collection_1
GROUP BY
  target,
  hash,
  body,
  expires_at

-- This stores `name`, `hash`, `operation_kind` per `hash` and `target`.
-- It deduplicates the rows and stores them only once.
-- Should significantly reduce the size of the original table.
CREATE MATERIALIZED VIEW IF NOT EXISTS default.operation_collection_details_1
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
SELECT
  target,
  name,
  hash,
  operation_kind,
  toStartOfDay(expires_at) AS expires_at
FROM default.operation_collection_1
GROUP BY
  target,
  name,
  hash,
  operation_kind,
  expires_at
