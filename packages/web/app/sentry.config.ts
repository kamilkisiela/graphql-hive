import { init } from '@sentry/nextjs';

const SENTRY_DSN = globalThis.process?.env['SENTRY_DSN'] ?? globalThis['__ENV__']?.['SENTRY_DSN'];
const RELEASE = globalThis.process?.env['RELEASE'] ?? globalThis['__ENV__']?.['RELEASE'];
const ENVIRONMENT = globalThis.process?.env['ENVIRONMENT'] ?? globalThis['__ENV__']?.['ENVIRONMENT'];
const SENTRY_ENABLED = globalThis.process?.env['SENTRY_ENABLED'] ?? globalThis['__ENV__']?.['SENTRY_ENABLED'];

export const config: Parameters<typeof init>[0] = {
  serverName: 'app',
  enabled: SENTRY_ENABLED === '1',
  environment: ENVIRONMENT ?? 'local',
  release: RELEASE ?? 'local',
  dsn: SENTRY_DSN,
};
