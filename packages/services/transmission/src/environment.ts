import { config as dotenv } from 'dotenv';
import zod from 'zod';

// eslint-disable-next-line no-process-env
if (!process.env.RELEASE) {
  dotenv({
    debug: true,
    encoding: 'utf8',
  });
}

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
  ENVIRONMENT: emptyString(zod.string().optional()),
  RELEASE: emptyString(zod.string().optional()),
  PORT: emptyString(NumberFromString.optional()),
  HEARTBEAT_ENDPOINT: emptyString(zod.string().url().optional()),
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

const PostmarkEmailModel = zod.object({
  EMAIL_PROVIDER: zod.literal('postmark'),
  EMAIL_PROVIDER_POSTMARK_TOKEN: zod.string(),
  EMAIL_PROVIDER_POSTMARK_MESSAGE_STREAM: zod.string(),
});

const SMTPEmailModel = zod.object({
  EMAIL_PROVIDER: zod.literal('smtp'),
  EMAIL_PROVIDER_SMTP_PROTOCOL: emptyString(
    zod.union([zod.literal('smtp'), zod.literal('smtps')]).optional(),
  ),
  EMAIL_PROVIDER_SMTP_HOST: zod.string(),
  EMAIL_PROVIDER_SMTP_PORT: NumberFromString,
  EMAIL_PROVIDER_SMTP_AUTH_USERNAME: zod.string(),
  EMAIL_PROVIDER_SMTP_AUTH_PASSWORD: zod.string(),
  EMAIL_PROVIDER_SMTP_REJECT_UNAUTHORIZED: emptyString(
    zod.union([zod.literal('0'), zod.literal('1')]).optional(),
  ),
});

const SendmailEmailModel = zod.object({
  EMAIL_PROVIDER: zod.literal('sendmail'),
});

const MockEmailProviderModel = zod.object({
  EMAIL_PROVIDER: zod.literal('mock'),
});

const EmailProviderModel = zod.union([
  PostmarkEmailModel,
  MockEmailProviderModel,
  SMTPEmailModel,
  SendmailEmailModel,
]);

const EmailModel = zod
  .object({
    EMAIL_FROM: zod.string().email(),
  })
  .and(EmailProviderModel);

const PostgresModel = zod.object({
  POSTGRES_SSL: emptyString(zod.union([zod.literal('1'), zod.literal('0')]).optional()),
  POSTGRES_HOST: zod.string(),
  POSTGRES_PORT: NumberFromString,
  POSTGRES_DB: zod.string(),
  POSTGRES_USER: zod.string(),
  POSTGRES_PASSWORD: zod.string(),
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

const SentryModel = zod.union([
  zod.object({
    SENTRY: emptyString(zod.literal('0').optional()),
  }),
  zod.object({
    SENTRY: zod.literal('1'),
    SENTRY_DSN: zod.string(),
  }),
]);

const PrometheusModel = zod.object({
  PROMETHEUS_METRICS: emptyString(zod.union([zod.literal('0'), zod.literal('1')]).optional()),
  PROMETHEUS_METRICS_LABEL_INSTANCE: emptyString(zod.string().optional()),
  PROMETHEUS_METRICS_PORT: emptyString(NumberFromString.optional()),
});

export type EmailProviderConfig = typeof emailProviderConfig;
export type PostmarkEmailProviderConfig = Extract<EmailProviderConfig, { provider: 'postmark' }>;
export type SMTPEmailProviderConfig = Extract<EmailProviderConfig, { provider: 'smtp' }>;
export type SendmailEmailProviderConfig = Extract<EmailProviderConfig, { provider: 'sendmail' }>;
export type MockEmailProviderConfig = Extract<EmailProviderConfig, { provider: 'mock' }>;

// eslint-disable-next-line no-process-env
const processEnv = process.env;

const configs = {
  base: EnvironmentModel.safeParse(processEnv),
  postgres: PostgresModel.safeParse(processEnv),
  log: LogModel.safeParse(processEnv),
  sentry: SentryModel.safeParse(processEnv),
  prometheus: PrometheusModel.safeParse(processEnv),
  requestBroker: RequestBrokerModel.safeParse(processEnv),
  email: EmailModel.safeParse(processEnv),
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
const postgres = extractConfig(configs.postgres);
const requestBroker = extractConfig(configs.requestBroker);
const email = extractConfig(configs.email);
const log = extractConfig(configs.log);
const sentry = extractConfig(configs.sentry);
const prometheus = extractConfig(configs.prometheus);

const emailProviderConfig =
  email.EMAIL_PROVIDER === 'postmark'
    ? ({
        provider: 'postmark' as const,
        token: email.EMAIL_PROVIDER_POSTMARK_TOKEN,
        messageStream: email.EMAIL_PROVIDER_POSTMARK_MESSAGE_STREAM,
      } as const)
    : email.EMAIL_PROVIDER === 'smtp'
      ? ({
          provider: 'smtp' as const,
          protocol: email.EMAIL_PROVIDER_SMTP_PROTOCOL ?? 'smtp',
          host: email.EMAIL_PROVIDER_SMTP_HOST,
          port: email.EMAIL_PROVIDER_SMTP_PORT,
          auth: {
            user: email.EMAIL_PROVIDER_SMTP_AUTH_USERNAME,
            pass: email.EMAIL_PROVIDER_SMTP_AUTH_PASSWORD,
          },
          tls: {
            rejectUnauthorized: !(email.EMAIL_PROVIDER_SMTP_REJECT_UNAUTHORIZED === '0'),
          },
        } as const)
      : email.EMAIL_PROVIDER === 'sendmail'
        ? ({ provider: 'sendmail' } as const)
        : ({ provider: 'mock' } as const);

export const env = {
  environment: base.ENVIRONMENT,
  release: base.RELEASE ?? 'local',
  heartbeat: base.HEARTBEAT_ENDPOINT ? { endpoint: base.HEARTBEAT_ENDPOINT } : null,
  log: {
    level: log.LOG_LEVEL ?? 'info',
    requests: log.REQUEST_LOGGING === '1',
  },
  http: {
    port: base.PORT ?? 6250,
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
  email: {
    provider: emailProviderConfig,
    emailFrom: email.EMAIL_FROM,
  },
  postgres: {
    host: postgres.POSTGRES_HOST,
    port: postgres.POSTGRES_PORT,
    db: postgres.POSTGRES_DB,
    user: postgres.POSTGRES_USER,
    password: postgres.POSTGRES_PASSWORD,
    ssl: postgres.POSTGRES_SSL === '1',
  },
  requestBroker:
    requestBroker.REQUEST_BROKER === '1'
      ? {
          endpoint: requestBroker.REQUEST_BROKER_ENDPOINT,
          signature: requestBroker.REQUEST_BROKER_SIGNATURE,
        }
      : null,
} as const;
