import zod from 'zod';

const isNumberString = (input: unknown) => zod.string().regex(/^\d+$/).safeParse(input).success;

const numberFromNumberOrNumberString = (input: unknown): number | undefined => {
  if (typeof input == 'number') return input;
  if (isNumberString(input)) return Number(input);
};

const NumberFromString = zod.preprocess(numberFromNumberOrNumberString, zod.number().min(1));

const EnvironmentModel = zod.object({
  PORT: NumberFromString.optional(),
  ENVIRONMENT: zod.string().optional(),
  RELEASE: zod.string().optional(),
  HEARTBEAT_ENDPOINT: zod.string().url().optional(),
  EMAIL_FROM: zod.string().email(),
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

const RedisModel = zod.object({
  REDIS_HOST: zod.string(),
  REDIS_PORT: NumberFromString,
  REDIS_PASSWORD: zod.string().optional(),
});

const PostmarkEmailModel = zod.object({
  EMAIL_PROVIDER: zod.literal('postmark'),
  EMAIL_PROVIDER_POSTMARK_TOKEN: zod.string(),
  EMAIL_PROVIDER_POSTMARK_MESSAGE_STREAM: zod.string(),
});

const SMTPEmailModel = zod.object({
  EMAIL_PROVIDER: zod.literal('smtp'),
  EMAIL_PROVIDER_SMTP_PROTOCOL: zod.union([zod.literal('smtp'), zod.literal('smtps')]).optional(),
  EMAIL_PROVIDER_SMTP_HOST: zod.string(),
  EMAIL_PROVIDER_SMTP_PORT: NumberFromString,
  EMAIL_PROVIDER_SMTP_AUTH_USERNAME: zod.string(),
  EMAIL_PROVIDER_SMTP_AUTH_PASSWORD: zod.string(),
});

const SendmailEmailModel = zod.object({
  EMAIL_PROVIDER: zod.literal('sendmail'),
});

const MockEmailProviderModel = zod.object({
  EMAIL_PROVIDER: zod.literal('mock'),
});

const EmailProviderModel = zod.union([PostmarkEmailModel, MockEmailProviderModel, SMTPEmailModel, SendmailEmailModel]);

const PrometheusModel = zod.object({
  PROMETHEUS_METRICS: zod.union([zod.literal('0'), zod.literal('1')]).optional(),
  PROMETHEUS_METRICS_LABEL_INSTANCE: zod.string().optional(),
});

const configs = {
  // eslint-disable-next-line no-process-env
  base: EnvironmentModel.safeParse(process.env),
  // eslint-disable-next-line no-process-env
  email: EmailProviderModel.safeParse(process.env),
  // eslint-disable-next-line no-process-env
  sentry: SentryModel.safeParse(process.env),
  // eslint-disable-next-line no-process-env
  redis: RedisModel.safeParse(process.env),
  // eslint-disable-next-line no-process-env
  prometheus: PrometheusModel.safeParse(process.env),
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
const email = extractConfig(configs.email);
const redis = extractConfig(configs.redis);
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
      } as const)
    : email.EMAIL_PROVIDER === 'sendmail'
    ? ({ provider: 'sendmail' } as const)
    : ({ provider: 'mock' } as const);

export type EmailProviderConfig = typeof emailProviderConfig;
export type PostmarkEmailProviderConfig = Extract<EmailProviderConfig, { provider: 'postmark' }>;
export type SMTPEmailProviderConfig = Extract<EmailProviderConfig, { provider: 'smtp' }>;
export type SendmailEmailProviderConfig = Extract<EmailProviderConfig, { provider: 'sendmail' }>;
export type MockEmailProviderConfig = Extract<EmailProviderConfig, { provider: 'mock' }>;

export const env = {
  environment: base.ENVIRONMENT,
  release: base.RELEASE ?? 'local',
  http: {
    port: base.PORT ?? 6260,
  },
  redis: {
    host: redis.REDIS_HOST,
    port: redis.REDIS_PORT,
    password: redis.REDIS_PASSWORD ?? '',
  },
  email: {
    provider: emailProviderConfig,
    emailFrom: base.EMAIL_FROM,
  },
  heartbeat: base.HEARTBEAT_ENDPOINT ? { endpoint: base.HEARTBEAT_ENDPOINT } : null,
  sentry: sentry.SENTRY === '1' ? { dsn: sentry.SENTRY_DSN } : null,
  prometheus:
    prometheus.PROMETHEUS_METRICS === '1'
      ? {
          labels: {
            instance: prometheus.PROMETHEUS_METRICS_LABEL_INSTANCE ?? 'emails',
          },
        }
      : null,
} as const;
