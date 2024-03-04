import { Config, Output } from '@pulumi/pulumi';
import { ServiceSecret } from '../utils/secrets';

export class SentrySecret extends ServiceSecret<{
  dsn: string | Output<string>;
}> {}

export function configureSentry() {
  const sentryConfig = new Config('sentry');
  const isEnabled = sentryConfig.requireBoolean('enabled');

  if (isEnabled) {
    const secret = new SentrySecret('sentry', {
      dsn: sentryConfig.requireSecret('dsn'),
    });

    return {
      enabled: true,
      secret,
    };
  }

  return {
    enabled: false,
    secret: null,
  };
}

export type Sentry = ReturnType<typeof configureSentry>;
