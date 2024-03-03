import { Config, Output } from '@pulumi/pulumi';
import { ServiceSecret } from '../secrets';

export class SentrySecret extends ServiceSecret<{
  dsn: string | Output<string>;
}> {}

export function configureSentry() {
  const commonConfig = new Config('common');
  const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

  if (commonEnv.SENTRY_ENABLED == '1') {
    const secret = new SentrySecret('sentry', {
      dsn: commonEnv.SENTRY_DSN,
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
