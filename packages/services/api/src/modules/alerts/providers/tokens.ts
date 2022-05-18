import { InjectionToken } from 'graphql-modules';

export interface WebhooksConfig {
  endpoint: string;
}

export const WEBHOOKS_CONFIG = new InjectionToken<WebhooksConfig>(
  'webhooks-endpoint'
);
