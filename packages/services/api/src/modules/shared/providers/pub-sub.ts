import { InjectionToken } from 'graphql-modules';
import type { PubSub } from 'graphql-yoga';

export type HivePubSub = PubSub<{
  publishedNewSchemaVersion: [targetId: string, payload: { publishedSchemaVersionId: string }];
}>;

export const PUB_SUB_CONFIG = new InjectionToken<HivePubSub>('PUB_SUB');
