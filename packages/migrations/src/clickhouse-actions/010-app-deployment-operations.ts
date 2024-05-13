import type { Action } from '../clickhouse';

export const action: Action = async exec => {
  await exec(`
    CREATE TABLE IF NOT EXISTS "app_deployments"
    (
      "target_id" LowCardinality(String) CODEC(ZSTD(1)),
      "app_deployment_id" LowCardinality(String) CODEC(ZSTD(1)),
      "is_active" Bool
    )
    ENGINE = ReplacingMergeTree
    ORDER BY ("target_id", "app_deployment_id")
    SETTINGS index_granularity = 8192
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS "app_deployment_documents"
    (
      "app_deployment_id" LowCardinality(String) CODEC(ZSTD(1)),
      "document_hash" String CODEC(ZSTD(1)),
      "operation_names" Array(String) CODEC(ZSTD(1)),
      "schema_coordinates" Array(String) CODEC(ZSTD(1)),
      "document_body" String CODEC(ZSTD(1))
    )
    ENGINE = ReplacingMergeTree
    ORDER BY ("app_deployment_id", "document_hash")
    SETTINGS index_granularity = 8192
  `);

  await exec(`
    ALTER TABLE "app_deployment_documents"
      ADD INDEX IF NOT EXISTS "schema_coordinates_index" "schema_coordinates" TYPE bloom_filter GRANULARITY 1
  `);
};
