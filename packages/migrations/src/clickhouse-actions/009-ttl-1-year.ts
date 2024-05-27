import { z } from 'zod';
import type { Action } from '../clickhouse';

const SystemTablesModel = z.array(
  z.object({
    name: z.string(),
    uuid: z.string(),
  }),
);

// This migration sets TTL for all tables to at least (read comments) 1 year.
export const action: Action = async (exec, query, isHiveCloud) => {
  if (!isHiveCloud) {
    console.log('Skipping ClickHouse migration');
    // This migration is only for Hive Cloud, self-hosted Hive depends on the user's configuration of data retention.
    return;
  }

  console.log('Checking materialize_ttl_after_modify');

  const { rows } = await query(
    `SELECT value FROM system.settings WHERE name = 'materialize_ttl_after_modify' AND value = '1'`,
  );

  if (rows === 0) {
    throw new Error('Expected materialize_ttl_after_modify to be 1');
  }

  // Tables with `timestamp` column
  const withTimestamp = await query(`
    SELECT uuid, name FROM system.tables WHERE name IN (
      'coordinates_daily',
      'clients_daily',
      'operations_daily',
      'subscription_operations_daily'
    );
  `).then(async r => SystemTablesModel.parse(r.data));

  if (withTimestamp.length !== 4) {
    throw new Error('Expected 4 tables with timestamp column');
  }

  for (const { uuid, name } of withTimestamp) {
    console.log(`Setting TTL for table ${name}`);
    await exec(`ALTER TABLE ".inner_id.${uuid}" MODIFY TTL timestamp + INTERVAL 1 YEAR`);
  }

  // Tables without `timestamp` column.
  // We can't use `timestamp` column for TTL, because it's not present in the table.
  // We use `expires_at` column instead, but it means that the row will be deleted after 1 year from the `expires_at` date.
  // The `expires_at` date could be already `timestamp` + 1 year,
  // meaning that the row will be deleted after 2 years from the `timestamp` date.
  // We need a gradual migration to make these tables depend on `timestamp` column.
  // We're going to do it in a separate migration.
  const withoutTimestamp = await query(`
    SELECT uuid, name FROM system.tables WHERE name IN (
      'target_existence',
      'operation_collection_details',
      'operation_collection_body',
      'subscription_target_existence'
    );
  `).then(async r => SystemTablesModel.parse(r.data));

  for (const { uuid, name } of withoutTimestamp) {
    console.log(`Setting TTL for table ${name}`);
    await exec(`ALTER TABLE ".inner_id.${uuid}" MODIFY TTL expires_at + INTERVAL 1 YEAR`);
  }
};
