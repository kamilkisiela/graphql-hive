import type { Action } from '../clickhouse';

export const action: Action = async exec => {
  await exec(`
    CREATE TABLE IF NOT EXISTS "audit_log"
    (
      "id" UUID DEFAULT generateUUIDv4() CODEC(ZSTD(1)),
      "event_time" DateTime CODEC(ZSTD(1)),
      "user_id" String CODEC(ZSTD(1)),
      "user_email" String CODEC(ZSTD(1)),
      "organization_id" String CODEC(ZSTD(1)),
      "event_action" String CODEC(ZSTD(1)),
      "metadata" String CODEC(ZSTD(1))
    )
    ENGINE = ReplacingMergeTree
    ORDER BY ("event_time", "user_id")
    TTL event_time + INTERVAL 1 YEAR
    SETTINGS index_granularity = 8192
  `);
};
