import * as Sentry from '@sentry/nextjs';
import { config } from './sentry.config';

Sentry.init({
  ...config,
  integrations: [
    new Sentry.Integrations.Http({
      tracing: true,
    }),
  ],
});
