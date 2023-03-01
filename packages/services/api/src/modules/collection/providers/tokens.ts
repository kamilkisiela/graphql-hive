import { InjectionToken } from 'graphql-modules';

export type CollectionConfig = {
  // endpoint: string | null;
};

export const COLLECTION_CONFIG = new InjectionToken<CollectionConfig>('collection-config');
