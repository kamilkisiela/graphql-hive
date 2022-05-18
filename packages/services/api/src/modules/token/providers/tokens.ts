import { InjectionToken } from 'graphql-modules';

export interface TokensConfig {
  endpoint: string;
}

export const TOKENS_CONFIG = new InjectionToken<TokensConfig>(
  'tokens-endpoint'
);
