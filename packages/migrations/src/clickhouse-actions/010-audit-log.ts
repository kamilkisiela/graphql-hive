import type { Action } from '../clickhouse';

export const action: Action = async (exec, _query) => {
  await exec(`
  CREATE TABLE audit_log (
    timestamp DateTime('UTC') CODEC(DoubleDelta, LZ4),
    user_id LowCardinality(String) CODEC(ZSTD(1)),
    user_email STRING,
    organization_id LowCardinality(String) CODEC(ZSTD(1)),
    project_id LowCardinality(String) CODEC(ZSTD(1)),
    project_name STRING,
    target_id LowCardinality(String) CODEC(ZSTD(1)),
    target_name STRING,
    schema_version_id LowCardinality(String) CODEC(ZSTD(1)),
    event_action LowCardinality(String) CODEC(ZSTD(1)),
    event_details JSON,
    event_human_readable STRING,
    INDEX idx_user_id user_id TYPE set(0) GRANULARITY 64,
    INDEX idx_user_email user_email TYPE set(0) GRANULARITY 64,
  ) ENGINE = MergeTree ()
  ORDER BY (timestamp, organization_id, project_id, target_id)
  TTL timestamp + INTERVAL 2 YEAR;  
  `);


};
