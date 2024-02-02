import * as fs from 'fs';
import zod from 'zod';

const isNumberString = (input: unknown) => zod.string().regex(/^\d+$/).safeParse(input).success;

const numberFromNumberOrNumberString = (input: unknown): number | undefined => {
  if (typeof input == 'number') return input;
  if (isNumberString(input)) return Number(input);
};

const NumberFromString = zod.preprocess(numberFromNumberOrNumberString, zod.number().min(1));

// treat an empty string (`''`) as undefined
const emptyString = <T extends zod.ZodType>(input: T) => {
  return zod.preprocess((value: unknown) => {
    if (value === '') return undefined;
    return value;
  }, input);
};

const EnvironmentModel = zod.object({
  PORT: emptyString(NumberFromString.optional()),
  TOKENS_ENDPOINT: zod.string().url(),
  RATE_LIMIT_ENDPOINT: emptyString(zod.string().url().optional()),
  ENVIRONMENT: emptyString(zod.string().optional()),
  RELEASE: emptyString(zod.string().optional()),
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

const KafkaBaseModel = zod.object({
  KAFKA_BROKER: zod.string(),
  KAFKA_TOPIC: zod.string(),
  KAFKA_SSL: emptyString(zod.union([zod.literal('1'), zod.literal('0')]).optional()),
  KAFKA_SSL_CA_PATH: zod.string().optional(),
  KAFKA_SSL_CERT_PATH: zod.string().optional(),
  KAFKA_SSL_KEY_PATH: zod.string().optional(),
  KAFKA_BUFFER_SIZE: NumberFromString,
  KAFKA_BUFFER_INTERVAL: NumberFromString,
  KAFKA_BUFFER_DYNAMIC: zod.union([zod.literal('1'), zod.literal('0')]),
});

const KafkaModel = zod.union([
  KafkaBaseModel.extend({
    KAFKA_SASL_MECHANISM: zod.void().optional(),
  }),
  KafkaBaseModel.extend({
    KAFKA_SASL_MECHANISM: zod.union([
      zod.literal('plain'),
      zod.literal('scram-sha-256'),
      zod.literal('scram-sha-512'),
    ]),
    KAFKA_SASL_USERNAME: zod.string(),
    KAFKA_SASL_PASSWORD: zod.string(),
  }),
]);

const PrometheusModel = zod.object({
  PROMETHEUS_METRICS: emptyString(zod.union([zod.literal('0'), zod.literal('1')]).optional()),
  PROMETHEUS_METRICS_LABEL_INSTANCE: emptyString(zod.string().optional()),
  PROMETHEUS_METRICS_PORT: emptyString(NumberFromString.optional()),
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
  kafka: KafkaModel.safeParse(process.env),
  // eslint-disable-next-line no-process-env
  prometheus: PrometheusModel.safeParse(process.env),
  // eslint-disable-next-line no-process-env
  log: LogModel.safeParse(process.env),
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
const log = extractConfig(configs.log);

export const env = {
  environment: base.ENVIRONMENT,
  release: base.RELEASE ?? 'local',
  http: {
    port: base.PORT ?? 5000,
  },
  hive: {
    tokens: {
      endpoint: base.TOKENS_ENDPOINT,
    },
    rateLimit: base.RATE_LIMIT_ENDPOINT
      ? {
          endpoint: base.RATE_LIMIT_ENDPOINT,
        }
      : null,
  },
  kafka: {
    topic: kafka.KAFKA_TOPIC,
    connection: {
      broker: kafka.KAFKA_BROKER,
      ssl:
        kafka.KAFKA_SSL === '1'
          ? kafka.KAFKA_SSL_CA_PATH != null &&
            kafka.KAFKA_SSL_CERT_PATH != null &&
            kafka.KAFKA_SSL_KEY_PATH != null
            ? {
                ca: fs.readFileSync(kafka.KAFKA_SSL_CA_PATH),
                cert: fs.readFileSync(kafka.KAFKA_SSL_CERT_PATH),
                key: fs.readFileSync(kafka.KAFKA_SSL_KEY_PATH),
              }
            : true
          : false,
      sasl:
        kafka.KAFKA_SASL_MECHANISM != null
          ? {
              mechanism: kafka.KAFKA_SASL_MECHANISM,
              username: kafka.KAFKA_SASL_USERNAME,
              password: kafka.KAFKA_SASL_PASSWORD,
            }
          : null,
    },
    buffer: {
      size: kafka.KAFKA_BUFFER_SIZE,
      interval: kafka.KAFKA_BUFFER_INTERVAL,
      dynamic: kafka.KAFKA_BUFFER_DYNAMIC === '1',
    },
  },
  log: {
    level: log.LOG_LEVEL ?? 'info',
    requests: log.REQUEST_LOGGING === '1',
  },
  sentry: sentry.SENTRY === '1' ? { dsn: sentry.SENTRY_DSN } : null,
  prometheus:
    prometheus.PROMETHEUS_METRICS === '1'
      ? {
          labels: {
            instance: prometheus.PROMETHEUS_METRICS_LABEL_INSTANCE ?? 'usage-service',
          },
          port: prometheus.PROMETHEUS_METRICS_PORT ?? 10_254,
        }
      : null,
} as const;

export type KafkaEnvironment = typeof env.kafka;
