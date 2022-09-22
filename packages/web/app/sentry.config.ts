import { env } from '@/env/frontend';
import type { NextjsOptions } from '@sentry/nextjs/types/utils/nextjsOptions';

export const config: NextjsOptions = {
  serverName: 'app',
  enabled: !!env.sentry,
  environment: env.environment,
  release: env.release,
  dsn: env.sentry?.dsn,
};
