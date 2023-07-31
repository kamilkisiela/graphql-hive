CREATE TABLE IF NOT EXISTS default.operation_collection
(
  target LowCardinality(String) CODEC(ZSTD(1)),
  hash String CODEC(ZSTD(1)),
  name String CODEC(ZSTD(1)),
  body String CODEC(ZSTD(1)),
  operation_kind String CODEC(ZSTD(1)),
  coordinates Array(String) CODEC(ZSTD(1)),
  total UInt32 CODEC(ZSTD(1)),
  timestamp DateTime('UTC') CODEC(ZSTD(1)),
  expires_at DateTime('UTC') CODEC(ZSTD(1)),
  INDEX idx_operation_kind (operation_kind) TYPE set(0) GRANULARITY 1
)
ENGINE = SummingMergeTree
PARTITION BY toYYYYMMDD(timestamp)
PRIMARY KEY (target, hash)
ORDER BY (target, hash, timestamp, expires_at)
TTL expires_at
SETTINGS index_granularity = 8192

CREATE TABLE IF NOT EXISTS default.operations
(
  target LowCardinality(String) CODEC(ZSTD(1)),
  timestamp DateTime('UTC') CODEC(ZSTD(1)),
  expires_at DateTime('UTC') CODEC(ZSTD(1)),
  hash String CODEC(ZSTD(1)),
  ok UInt8 CODEC(ZSTD(1)),
  errors UInt16 CODEC(ZSTD(1)),
  duration UInt64 CODEC(ZSTD(1)),
  client_name LowCardinality(String) CODEC(ZSTD(1)),
  client_version String CODEC(ZSTD(1)),
  INDEX idx_client_name (client_name) TYPE set(0) GRANULARITY 1,
  INDEX idx_hash (hash) TYPE set(0) GRANULARITY 1
)
ENGINE = MergeTree
PARTITION BY toYYYYMMDD(timestamp)
PRIMARY KEY (target, hash)
ORDER BY (target, hash, timestamp)
TTL expires_at
SETTINGS index_granularity = 8192
  
CREATE MATERIALIZED VIEW IF NOT EXISTS default.operations_hourly
(
  target LowCardinality(String) CODEC(ZSTD(1)),
  timestamp DateTime('UTC') CODEC(ZSTD(1)),
  expires_at DateTime('UTC') CODEC(ZSTD(1)),
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

CREATE MATERIALIZED VIEW IF NOT EXISTS default.operations_daily
(
  target LowCardinality(String) CODEC(ZSTD(1)),
  timestamp DateTime('UTC') CODEC(ZSTD(1)),
  expires_at DateTime('UTC') CODEC(ZSTD(1)),
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
 
CREATE MATERIALIZED VIEW IF NOT EXISTS default.coordinates_daily
(
  target LowCardinality(String) CODEC(ZSTD(1)),
  hash String CODEC(ZSTD(1)), 
  timestamp DateTime('UTC') CODEC(ZSTD(1)),
  expires_at DateTime('UTC') CODEC(ZSTD(1)),
  total UInt32 CODEC(ZSTD(1)),
  coordinate String CODEC(ZSTD(1))
)
ENGINE = SummingMergeTree
PARTITION BY toYYYYMMDD(timestamp)
PRIMARY KEY (target, coordinate, hash)
ORDER BY (target, coordinate, hash, timestamp, expires_at)
SETTINGS index_granularity = 8192
AS
SELECT
  target,
  hash,
  toStartOfDay(timestamp) AS timestamp,
  toStartOfDay(expires_at) AS expires_at,
  sum(total) AS total,
  coordinate
FROM default.operation_collection
ARRAY JOIN coordinates as coordinate
GROUP BY
  target,
  coordinate,
  hash,
  timestamp,
  expires_at

CREATE MATERIALIZED VIEW IF NOT EXISTS default.clients_daily
(
  target LowCardinality(String) CODEC(ZSTD(1)),
  client_name String CODEC(ZSTD(1)),
  client_version String CODEC(ZSTD(1)),
  hash String CODEC(ZSTD(1)), 
  timestamp DateTime('UTC') CODEC(ZSTD(1)),
  expires_at DateTime('UTC') CODEC(ZSTD(1)),
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

