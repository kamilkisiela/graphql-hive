import zod from 'zod';

const isNumberString = (input: unknown) => zod.string().regex(/^\d+$/).safeParse(input).success;

const numberFromNumberOrNumberString = (input: unknown): number | undefined => {
  if (typeof input == 'number') return input;
  if (isNumberString(input)) return Number(input);
};

const NumberFromString = zod.preprocess(numberFromNumberOrNumberString, zod.number().min(1));

const EnvironmentModel = zod.object({
  PORT: NumberFromString.optional(),
  ENVIRONMENT: zod.string(),
  RELEASE: zod.string().optional(),
  HEARTBEAT_ENDPOINT: zod.string().url().optional(),
});

const SentryModel = zod.union([
  zod.object({
    SENTRY: zod.literal('0').optional(),
  }),
  zod.object({
    SENTRY: zod.literal('1'),
    SENTRY_DSN: zod.string(),
  }),
]);

const KafkaBaseModel = zod.object({
  KAFKA_BROKER: zod.string(),
  KAFKA_SSL: zod.union([zod.literal('1'), zod.literal('0')]).optional(),
  KAFKA_CONCURRENCY: NumberFromString,
  KAFKA_CONSUMER_GROUP: zod.string(),
  KAFKA_TOPIC: zod.string(),
});

const KafkaModel = zod.union([
  KafkaBaseModel,
  KafkaBaseModel.extend({
    KAFKA_SASL_MECHANISM: zod.union([zod.literal('plain'), zod.literal('scram-sha-256'), zod.literal('scram-sha-512')]),
    KAFKA_SASL_USERNAME: zod.string(),
    KAFKA_SASL_PASSWORD: zod.string(),
  }),
]);

const ClickHouseModel = zod.object({
  CLICKHOUSE_PROTOCOL: zod.union([zod.literal('http'), zod.literal('https')]),
  CLICKHOUSE_HOST: zod.string(),
  CLICKHOUSE_PORT: NumberFromString,
  CLICKHOUSE_USERNAME: zod.string(),
  CLICKHOUSE_PASSWORD: zod.string(),
});

const ClickHouseMirrorModel = zod.union([
  zod.object({}),
  zod.object({
    CLICKHOUSE_MIRROR_PROTOCOL: zod.union([zod.literal('http'), zod.literal('https')]),
    CLICKHOUSE_MIRROR_HOST: zod.string(),
    CLICKHOUSE_MIRROR_PORT: NumberFromString,
    CLICKHOUSE_MIRROR_USERNAME: zod.string(),
    CLICKHOUSE_MIRROR_PASSWORD: zod.string(),
  }),
]);

const PrometheusModel = zod.object({
  PROMETHEUS_METRICS: zod.union([zod.literal('0'), zod.literal('1')]).optional(),
  PROMETHEUS_METRICS_LABEL_INSTANCE: zod.string().optional(),
});

const configs = {
  // eslint-disable-next-line no-process-env
  base: EnvironmentModel.safeParse(process.env),
  // eslint-disable-next-line no-process-env
  sentry: SentryModel.safeParse(process.env),
  // eslint-disable-next-line no-process-env
  kafka: KafkaModel.safeParse(process.env),
  // eslint-disable-next-line no-process-env
  prometheus: PrometheusModel.safeParse(process.env),
  // eslint-disable-next-line no-process-env
  clickhouse: ClickHouseModel.safeParse(process.env),
  // eslint-disable-next-line no-process-env
  clickhouseMirror: ClickHouseMirrorModel.safeParse(process.env),
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
const kafka = extractConfig(configs.kafka);
const prometheus = extractConfig(configs.prometheus);
const clickhouse = extractConfig(configs.clickhouse);
const clickhouseMirror = extractConfig(configs.clickhouseMirror);

export const env = {
  environment: base.ENVIRONMENT,
  release: base.RELEASE ?? 'local',
  http: {
    port: base.PORT ?? 5000,
  },
  kafka: {
    concurrency: kafka.KAFKA_CONCURRENCY,
    topic: kafka.KAFKA_TOPIC,
    consumerGroup: kafka.KAFKA_CONSUMER_GROUP,
    connection: {
      broker: kafka.KAFKA_BROKER,
      isSSL: kafka.KAFKA_SSL === '1',
      sasl:
        'KAFKA_SASL_MECHANISM' in kafka
          ? {
              mechanism: kafka.KAFKA_SASL_MECHANISM,
              username: kafka.KAFKA_SASL_USERNAME,
              password: kafka.KAFKA_SASL_PASSWORD,
            }
          : null,
    },
  },
  clickhouse: {
    protocol: clickhouse.CLICKHOUSE_PROTOCOL,
    host: clickhouse.CLICKHOUSE_HOST,
    port: clickhouse.CLICKHOUSE_PORT,
    username: clickhouse.CLICKHOUSE_USERNAME,
    password: clickhouse.CLICKHOUSE_PASSWORD,
  },
  clickhouseMirror:
    'CLICKHOUSE_MIRROR_PROTOCOL' in clickhouseMirror
      ? {
          protocol: clickhouseMirror.CLICKHOUSE_MIRROR_PROTOCOL,
          host: clickhouseMirror.CLICKHOUSE_MIRROR_HOST,
          port: clickhouseMirror.CLICKHOUSE_MIRROR_PORT,
          username: clickhouseMirror.CLICKHOUSE_MIRROR_USERNAME,
          password: clickhouseMirror.CLICKHOUSE_MIRROR_PASSWORD,
        }
      : null,
  heartbeat: base.HEARTBEAT_ENDPOINT ? { endpoint: base.HEARTBEAT_ENDPOINT } : null,
  sentry: sentry.SENTRY === '1' ? { dsn: sentry.SENTRY_DSN } : null,
  prometheus:
    prometheus.PROMETHEUS_METRICS === '1'
      ? {
          labels: {
            instance: prometheus.PROMETHEUS_METRICS_LABEL_INSTANCE ?? 'usage-ingestor-service',
          },
        }
      : null,
} as const;

export type KafkaEnvironment = typeof env.kafka;
