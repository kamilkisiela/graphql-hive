import { config as dotenv } from 'dotenv';

dotenv({
  debug: true,
});

import cn from '../tools/db-connection-string.mjs';

function ensureVarIf(key: string, condition: boolean) {
  if (condition) {
    if (!process.env[key]) {
      throw new Error(`Missing env var "${key}"`);
    }

    return process.env[key];
  }
}

const isClickHouseMigration = process.env.CLICKHOUSE_MIGRATOR === 'up';

export const config = {
  postgresConnectionString: cn('registry'),
  clickhouse: {
    protocol: ensureVarIf('CLICKHOUSE_PROTOCOL', isClickHouseMigration),
    host: ensureVarIf('CLICKHOUSE_HOST', isClickHouseMigration),
    port: ensureVarIf('CLICKHOUSE_PORT', isClickHouseMigration),
    username: ensureVarIf('CLICKHOUSE_USERNAME', isClickHouseMigration),
    password: ensureVarIf('CLICKHOUSE_PASSWORD', isClickHouseMigration),
  },
};
