import LRU from 'tiny-lru';
import { FastifyLoggerInstance } from '@hive/service-common';
import type { TokensApi } from '@hive/tokens';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import { fetch } from '@whatwg-node/fetch';
import { tokenCacheHits, tokenRequests } from './metrics';

export enum TokenStatus {
  NotFound,
  NoAccess,
}

export type TokensResponse = {
  organization: string;
  project: string;
  target: string;
  scopes: readonly string[];
};

type Token = TokensResponse | TokenStatus;

export function createTokens(config: { endpoint: string; logger: FastifyLoggerInstance }) {
  const endpoint = config.endpoint.replace(/\/$/, '');
  const tokens = LRU<Promise<Token>>(1000, 30_000);
  const tokensApi = createTRPCProxyClient<TokensApi>({
    links: [
      httpLink({
        url: `${endpoint}/trpc`,
        fetch,
      }),
    ],
  });
  async function fetchFreshToken(token: string) {
    try {
      const info = await tokensApi.getToken.query({
        token,
      });

      if (info) {
        const result = info.scopes.includes('target:usage:write')
          ? {
              target: info.target,
              project: info.project,
              organization: info.organization,
              scopes: info.scopes,
            }
          : TokenStatus.NoAccess;
        return result;
      }
      return TokenStatus.NotFound;
    } catch (error) {
      return TokenStatus.NotFound;
    }
  }

  return {
    async fetch(token: string) {
      tokenRequests.inc();
      const tokenInfo = await tokens.get(token);

      if (!tokenInfo) {
        const result = fetchFreshToken(token);
        tokens.set(token, result);
        return result;
      }

      tokenCacheHits.inc();

      return tokenInfo ?? TokenStatus.NotFound;
    },
    isNotFound(token: Token): token is TokenStatus.NotFound {
      return token === TokenStatus.NotFound;
    },
    isNoAccess(token: Token): token is TokenStatus.NoAccess {
      return token === TokenStatus.NoAccess;
    },
  };
}
