import { InjectionToken } from 'graphql-modules';
import type { PubSub } from 'graphql-yoga';

export type HivePubSub = PubSub<{
  oidcIntegrationLogs: [oidcIntegrationId: string, payload: { timestamp: string; message: string }];
}>;

export const PUB_SUB_CONFIG = new InjectionToken<HivePubSub>('PUB_SUB');
