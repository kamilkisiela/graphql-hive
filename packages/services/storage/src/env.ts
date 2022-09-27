import { config as dotenv } from 'dotenv';
import cn from '../tools/db-connection-string.cjs';

dotenv({
  debug: true,
});

function ensureVarIf(key: string, condition: boolean) {
  if (condition) {
    // eslint-disable-next-line no-process-env
    if (!process.env[key]) {
      throw new Error(`Missing env var "${key}"`);
    }
    // eslint-disable-next-line no-process-env
    return process.env[key];
  }
}

// eslint-disable-next-line no-process-env
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
