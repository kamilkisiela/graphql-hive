import * as Sentry from '@sentry/nextjs';
import { Integrations } from '@sentry/react';
import { config } from './sentry.config';

Sentry.init({
  ...config,
  integrations: [new Integrations.GlobalHandlers()],
});
