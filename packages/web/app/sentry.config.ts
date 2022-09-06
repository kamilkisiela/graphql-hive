import { init } from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const RELEASE = process.env.RELEASE || process.env.NEXT_PUBLIC_RELEASE;
const ENVIRONMENT = process.env.ENVIRONMENT || process.env.NEXT_PUBLIC_ENVIRONMENT;
const SENTRY_ENABLED = process.env.SENTRY_ENABLED || process.env.NEXT_PUBLIC_SENTRY_ENABLED;

export const config: Parameters<typeof init>[0] = {
  serverName: 'app',
  enabled: String(SENTRY_ENABLED) === '1',
  environment: ENVIRONMENT || 'local',
  release: RELEASE || 'local',
  dsn: SENTRY_DSN,
};
