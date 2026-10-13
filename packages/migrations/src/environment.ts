import { config as dotenv } from 'dotenv';
import zod from 'zod';
import {
  parseClickHouseConfigFromEnvironment,
  parsePostgresConfigFromEnvironment,
  parseRedisConfigFromEnvironment,
} from '@hive/service-common';

if (!process.env.RELEASE) {
  dotenv({
    debug: true,
    encoding: 'utf8',
  });
}

// treat an empty string (`''`) as undefined
const emptyString = <T extends zod.ZodType>(input: T) => {
  return zod.preprocess((value: unknown) => {
    if (value === '') return undefined;
    return value;
  }, input);
};

function raiseInvariant(reason: string): never {
  throw new Error(reason);
}

const EnvironmentModel = zod.object({
  ENVIRONMENT: emptyString(zod.string().optional()),
  RELEASE: emptyString(zod.string().optional()),
  MIGRATOR: emptyString(zod.string().optional()),
  CLICKHOUSE_MIGRATOR: emptyString(zod.string().optional()),
  CLICKHOUSE_MIGRATOR_GRAPHQL_HIVE_CLOUD: zod
    .union([zod.literal('1'), zod.literal('0')])
    .optional(),
  GRAPHQL_HIVE_ENVIRONMENT: emptyString(zod.enum(['prod', 'staging', 'dev']).optional()),
  AWS_REGION: emptyString(zod.string().optional()),
});

const configs = {
  base: EnvironmentModel.safeParse(process.env),
};

const environmentErrors: Array<string> = [];

for (const config of Object.values(configs)) {
  if (config.success === false) {
    environmentErrors.push(JSON.stringify(config.error.format(), null, 4));
  }
}

const postgresConfigResult = parsePostgresConfigFromEnvironment(
  process.env,
  configs.base.success ? configs.base.data.AWS_REGION : undefined,
);

const redisConfigResult = parseRedisConfigFromEnvironment(
  process.env,
  configs.base.success ? configs.base.data.AWS_REGION : undefined,
);

const clickhouseConfigResult = process.env.CLICKHOUSE_PROTOCOL
  ? parseClickHouseConfigFromEnvironment(process.env)
  : null;

if (postgresConfigResult.type === 'error') {
  environmentErrors.push(...postgresConfigResult.errors);
}

if (clickhouseConfigResult?.type === 'error') {
  environmentErrors.push(...clickhouseConfigResult.errors);
}

if (redisConfigResult.type === 'error') {
  environmentErrors.push(...redisConfigResult.errors);
}

if (environmentErrors.length) {
  const fullError = environmentErrors.join(`\n`);
  console.error('❌ Invalid environment variables:', fullError);
  process.exit(1);
}

function extractConfig<Input, Output>(config: zod.SafeParseReturnType<Input, Output>): Output {
  if (!config.success) {
    throw new Error('Something went wrong.');
  }
  return config.data;
}

const base = extractConfig(configs.base);

export const env = {
  environment: base.ENVIRONMENT,
  release: base.RELEASE ?? 'local',
  postgres:
    postgresConfigResult?.type === 'ok'
      ? postgresConfigResult.config
      : raiseInvariant('Unreachable: postgres config errors are caught above via process.exit(1)'),
  clickhouse: clickhouseConfigResult?.type === 'ok' ? clickhouseConfigResult.config : null,
  redis:
    redisConfigResult.type === 'ok'
      ? redisConfigResult.config
      : raiseInvariant('Unreachable: redis config errors are caught above via process.exit(1)'),
  isMigrator: base.MIGRATOR === 'up',
  isClickHouseMigrator: base.CLICKHOUSE_MIGRATOR === 'up',
  isHiveCloud: base.CLICKHOUSE_MIGRATOR_GRAPHQL_HIVE_CLOUD === '1',
  hiveCloudEnvironment: base.GRAPHQL_HIVE_ENVIRONMENT ?? null,
} as const;
