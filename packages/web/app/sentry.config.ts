import { init } from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const RELEASE = process.env.RELEASE || process.env.NEXT_PUBLIC_RELEASE;
const ENVIRONMENT =
  process.env.ENVIRONMENT || process.env.NEXT_PUBLIC_ENVIRONMENT;

export const config: Parameters<typeof init>[0] = {
  serverName: 'app',
  enabled: ENVIRONMENT === 'prod',
  environment: ENVIRONMENT || 'local',
  release: RELEASE || 'local',
  dsn: SENTRY_DSN,
};
