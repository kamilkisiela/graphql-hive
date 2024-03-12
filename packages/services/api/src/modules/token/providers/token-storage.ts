import { CONTEXT, Inject, Injectable, Scope } from 'graphql-modules';
import { createTimeoutHTTPLink } from '@hive/service-common';
import type { TokensApi } from '@hive/tokens';
import { createTRPCProxyClient } from '@trpc/client';
import type { Token } from '../../../shared/entities';
import { HiveError } from '../../../shared/errors';
import { atomic } from '../../../shared/helpers';
import type { OrganizationAccessScope } from '../../auth/providers/organization-access';
import type { ProjectAccessScope } from '../../auth/providers/project-access';
import type { TargetAccessScope } from '../../auth/providers/target-access';
import { Logger } from '../../shared/providers/logger';
import type { TargetSelector } from '../../shared/providers/storage';
import type { TokensConfig } from './tokens';
import { TOKENS_CONFIG } from './tokens';

function maskToken(token: string) {
  return token.substring(0, 3) + '*'.repeat(token.length - 6) + token.substring(token.length - 3);
}

export interface TokenSelector {
  token: string;
}

interface CreateTokenInput extends TargetSelector {
  name: string;
  scopes: Array<OrganizationAccessScope | ProjectAccessScope | TargetAccessScope>;
}

export interface CreateTokenResult extends Token {
  secret: string;
}

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class TokenStorage {
  private logger: Logger;
  private tokensService;

  constructor(
    logger: Logger,
    @Inject(TOKENS_CONFIG) tokensConfig: TokensConfig,
    @Inject(CONTEXT) context: GraphQLModules.ModuleContext,
  ) {
    this.logger = logger.child({ source: 'TokenStorage' });
    this.tokensService = createTRPCProxyClient<TokensApi>({
      links: [
        createTimeoutHTTPLink({
          url: `${tokensConfig.endpoint}/trpc`,
          fetch,
          headers: {
            'x-request-id': context.requestId,
          },
        }),
      ],
    });
  }

  async createToken(input: CreateTokenInput) {
    this.logger.debug('Creating new token (input=%o)', input);

    const response = await this.tokensService.createToken.mutate({
      name: input.name,
      target: input.target,
      project: input.project,
      organization: input.organization,
      scopes: input.scopes,
    });

    return response;
  }

  async deleteTokens(
    input: {
      tokens: readonly string[];
    } & TargetSelector,
  ): Promise<readonly string[]> {
    this.logger.debug('Deleting tokens (input=%o)', input);

    await Promise.all(input.tokens.map(token => this.tokensService.deleteToken.mutate({ token })));

    return input.tokens;
  }

  async invalidateTokens(tokens: string[]) {
    this.logger.debug('Invalidating tokens (size=%s)', tokens.length);

    await this.tokensService.invalidateTokens
      .mutate({
        tokens,
      })
      .catch(error => {
        this.logger.error(error);
      });
  }

  async getTokens(selector: TargetSelector) {
    this.logger.debug('Fetching tokens (selector=%o)', selector);

    const response = await this.tokensService.targetTokens.query({
      targetId: selector.target,
    });

    return response || [];
  }

  @atomic<TokenSelector>(({ token }) => token)
  async getToken({ token }: TokenSelector) {
    try {
      // Tokens are MD5 hashes, so they are always 32 characters long
      if (token.length !== 32) {
        throw new HiveError(`Incorrect length: received ${token.length}, expected 32`);
      }

      this.logger.debug('Fetching token (token=%s)', maskToken(token));
      const tokenInfo = await this.tokensService.getToken.query({ token });

      if (!tokenInfo) {
        throw new HiveError('Not found');
      }

      return tokenInfo;
    } catch (error: any) {
      if (!(error instanceof HiveError)) {
        this.logger.error(error);
      }

      throw new HiveError('Invalid token provided', {
        originalError: error,
      });
    }
  }
}
