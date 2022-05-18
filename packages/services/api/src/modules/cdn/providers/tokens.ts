import { InjectionToken } from 'graphql-modules';

export interface CDNConfig {
  cloudflare: {
    basePath: string;
    accountId: string;
    authToken: string;
    namespaceId: string;
  };
  baseUrl: string;
  authPrivateKey: string;
}

export const CDN_CONFIG = new InjectionToken<CDNConfig>('cdn-config');
