import type { Action } from '../clickhouse';

export const action: Action = async exec => {
  await exec(`
    CREATE TABLE IF NOT EXISTS "app_deployments"
    (
      "target_id" LowCardinality(String) CODEC(ZSTD(1)),
      "app_deployment_id" LowCardinality(String) CODEC(ZSTD(1)),
      "app_name" LowCardinality(String) CODEC(ZSTD(1)),
      "app_version" LowCardinality(String) CODEC(ZSTD(1)),
      "is_active" Bool
    )
    ENGINE = ReplacingMergeTree
    ORDER BY ("target_id", "app_deployment_id", "app_name", "app_version")
    SETTINGS index_granularity = 8192
  `);

  // document_hash is the has as provided by the client
  // hash is the hash of the document_body as computed by the server
  await exec(`
    CREATE TABLE IF NOT EXISTS "app_deployment_documents"
    (
      "app_deployment_id" LowCardinality(String) CODEC(ZSTD(1)),
      "document_hash" String CODEC(ZSTD(1)),
      "operation_name" String CODEC(ZSTD(1)),
      "schema_coordinates" Array(String) CODEC(ZSTD(1)),
      "document_body" String CODEC(ZSTD(1)),
      "hash" String CODEC(ZSTD(1))
    )
    ENGINE = ReplacingMergeTree
    ORDER BY ("app_deployment_id", "document_hash")
    SETTINGS index_granularity = 8192
  `);

  await exec(`
    ALTER TABLE "app_deployment_documents"
      ADD INDEX IF NOT EXISTS "schema_coordinates_index" "schema_coordinates" TYPE bloom_filter GRANULARITY 1
  `);

  // Note: we use target_id,app_name,app_version as the primary key
  // as we don't have access to the app_deployment_id within the usage reporting sent from the client
  await exec(`
    CREATE TABLE IF NOT EXISTS "app_deployment_usage"
    (
      "target_id" LowCardinality(String) CODEC(ZSTD(1)),
      "app_name" LowCardinality(String) CODEC(ZSTD(1)),
      "app_version" LowCardinality(String) CODEC(ZSTD(1)),
      "last_request" DateTime CODEC(DoubleDelta, ZSTD(1))
    )
    ENGINE = ReplacingMergeTree
    ORDER BY ("target_id", "app_name", "app_version")
    TTL "last_request" + INTERVAL 1 YEAR
    SETTINGS index_granularity = 8192
  `);
};
