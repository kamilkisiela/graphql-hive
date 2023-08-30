import zod from 'zod';

const isNumberString = (input: unknown) => zod.string().regex(/^\d+$/).safeParse(input).success;

const numberFromNumberOrNumberString = (input: unknown): number | undefined => {
  if (typeof input == 'number') return input;
  if (isNumberString(input)) return Number(input);
};

const NumberFromString = (min = 1) =>
  zod.preprocess(numberFromNumberOrNumberString, zod.number().min(min));

// treat an empty string (`''`) as undefined
const emptyString = <T extends zod.ZodType>(input: T) => {
  return zod.preprocess((value: unknown) => {
    if (value === '') return undefined;
    return value;
  }, input);
};

const EnvironmentModel = zod.object({
  PORT: emptyString(NumberFromString().optional()),
  BODY_LIMIT: NumberFromString().optional().default(/* 15mb in bytes */ 15e6),
  ENVIRONMENT: emptyString(zod.string().optional()),
  RELEASE: emptyString(zod.string().optional()),
  ENCRYPTION_SECRET: zod.string(),
});

const RequestBrokerModel = zod.union([
  zod.object({
    REQUEST_BROKER: emptyString(zod.literal('0').optional()),
  }),
  zod.object({
    REQUEST_BROKER: zod.literal('1'),
    REQUEST_BROKER_ENDPOINT: zod.string().min(1),
    REQUEST_BROKER_SIGNATURE: zod.string().min(1),
  }),
]);

const TimingsModel = zod.object({
  SCHEMA_CACHE_TTL_MS: NumberFromString().default(30000),
  SCHEMA_COMPOSITION_TIMEOUT_MS: NumberFromString(25000).default(25000),
  SCHEMA_CACHE_POLL_INTERVAL_MS: NumberFromString(100).default(150),
});

const SentryModel = zod.union([
  zod.object({
    SENTRY: emptyString(zod.literal('0').optional()),
  }),
  zod.object({
    SENTRY: zod.literal('1'),
    SENTRY_DSN: zod.string(),
  }),
]);

const RedisModel = zod.object({
  REDIS_HOST: zod.string(),
  REDIS_PORT: NumberFromString(),
  REDIS_PASSWORD: emptyString(zod.string().optional()),
});

const PrometheusModel = zod.object({
  PROMETHEUS_METRICS: emptyString(zod.union([zod.literal('0'), zod.literal('1')]).optional()),
  PROMETHEUS_METRICS_LABEL_INSTANCE: emptyString(zod.string().optional()),
});

const LogModel = zod.object({
  LOG_LEVEL: emptyString(
    zod
      .union([
        zod.literal('trace'),
        zod.literal('debug'),
        zod.literal('info'),
        zod.literal('warn'),
        zod.literal('error'),
        zod.literal('fatal'),
        zod.literal('silent'),
      ])
      .optional(),
  ),
  REQUEST_LOGGING: emptyString(zod.union([zod.literal('0'), zod.literal('1')]).optional()).default(
    '1',
  ),
});

const configs = {
  // eslint-disable-next-line no-process-env
  base: EnvironmentModel.safeParse(process.env),
  // eslint-disable-next-line no-process-env
  sentry: SentryModel.safeParse(process.env),
  // eslint-disable-next-line no-process-env
  redis: RedisModel.safeParse(process.env),
  // eslint-disable-next-line no-process-env
  prometheus: PrometheusModel.safeParse(process.env),
  // eslint-disable-next-line no-process-env
  log: LogModel.safeParse(process.env),
  // eslint-disable-next-line no-process-env
  requestBroker: RequestBrokerModel.safeParse(process.env),
  // eslint-disable-next-line no-process-env
  timings: TimingsModel.safeParse(process.env),
};

const environmentErrors: Array<string> = [];

for (const config of Object.values(configs)) {
  if (config.success === false) {
    environmentErrors.push(JSON.stringify(config.error.format(), null, 4));
  }
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
const sentry = extractConfig(configs.sentry);
const redis = extractConfig(configs.redis);
const prometheus = extractConfig(configs.prometheus);
const log = extractConfig(configs.log);
const requestBroker = extractConfig(configs.requestBroker);
const timings = extractConfig(configs.timings);

export const env = {
  environment: base.ENVIRONMENT,
  release: base.RELEASE ?? 'local',
  encryptionSecret: base.ENCRYPTION_SECRET,
  http: {
    port: base.PORT ?? 6500,
    bodyLimit: base.BODY_LIMIT,
  },
  redis: {
    host: redis.REDIS_HOST,
    port: redis.REDIS_PORT,
    password: redis.REDIS_PASSWORD ?? '',
  },
  sentry: sentry.SENTRY === '1' ? { dsn: sentry.SENTRY_DSN } : null,
  log: {
    level: log.LOG_LEVEL ?? 'info',
    requests: log.REQUEST_LOGGING === '1',
  },
  prometheus:
    prometheus.PROMETHEUS_METRICS === '1'
      ? {
          labels: {
            instance: prometheus.PROMETHEUS_METRICS_LABEL_INSTANCE ?? 'schema',
          },
        }
      : null,
  timings: {
    cacheTTL: timings.SCHEMA_CACHE_TTL_MS,
    cachePollInterval: timings.SCHEMA_CACHE_POLL_INTERVAL_MS,
    schemaCompositionTimeout: timings.SCHEMA_COMPOSITION_TIMEOUT_MS,
  },
  requestBroker:
    requestBroker.REQUEST_BROKER === '1'
      ? {
          endpoint: requestBroker.REQUEST_BROKER_ENDPOINT,
          signature: requestBroker.REQUEST_BROKER_SIGNATURE,
        }
      : null,
} as const;
