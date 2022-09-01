import { init } from '@sentry/nextjs';

const SENTRY_DSN = globalThis['__ENV__']?.['SENTRY_DSN'] ?? process.env.SENTRY_DSN;
const RELEASE = process.env.RELEASE || process.env.NEXT_PUBLIC_RELEASE;
const ENVIRONMENT = globalThis['__ENV__']?.['ENVIRONMENT'] || process.env['ENVIRONMENT'];

export const config: Parameters<typeof init>[0] = {
  serverName: 'app',
  enabled: ENVIRONMENT === 'prod',
  environment: ENVIRONMENT || 'local',
  release: RELEASE || 'local',
  dsn: SENTRY_DSN,
};
