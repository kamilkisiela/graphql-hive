import * as Sentry from '@sentry/nextjs';
import { config as env } from './environment';

Sentry.init({
  serverName: 'app',
  enabled: !!env.sentry,
  dsn: env.sentry?.dsn,
  release: env.release,
  environment: env.environment,
  integrations: [
    new Sentry.Integrations.Http({
      tracing: true,
    }),
  ],
});
