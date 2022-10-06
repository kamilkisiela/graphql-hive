import { Inject, Injectable, Scope, CONTEXT } from 'graphql-modules';
import { atomic } from '../../../shared/helpers';
import { HiveError } from '../../../shared/errors';
import type { Token } from '../../../shared/entities';
import { Logger } from '../../shared/providers/logger';
import { TargetSelector, ProjectSelector, OrganizationSelector } from '../../shared/providers/storage';
import type { TargetAccessScope } from '../../auth/providers/target-access';
import type { ProjectAccessScope } from '../../auth/providers/project-access';
import type { OrganizationAccessScope } from '../../auth/providers/organization-access';
import type { TokensConfig } from './tokens';
import { TOKENS_CONFIG } from './tokens';
import type { TokensApi } from '@hive/tokens';
import { createTRPCClient } from '@trpc/client';
import { fetch } from '@whatwg-node/fetch';

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
    @Inject(CONTEXT) context: GraphQLModules.ModuleContext
  ) {
    this.logger = logger.child({ source: 'TokenStorage' });
    this.tokensService = createTRPCClient<TokensApi>({
      url: `${tokensConfig.endpoint}/trpc`,
      fetch,
      headers: {
        'x-request-id': context.requestId,
      },
    });
  }

  async createToken(input: CreateTokenInput) {
    this.logger.debug('Creating new token (input=%o)', input);

    const response = await this.tokensService.mutation('createToken', {
      name: input.name,
      target: input.target,
      project: input.project,
      organization: input.organization,
      scopes: input.scopes as CreateTokenInput['scopes'],
    });

    return response;
  }

  async deleteTokens(
    input: {
      tokens: readonly string[];
    } & TargetSelector
  ): Promise<readonly string[]> {
    this.logger.debug('Deleting tokens (input=%o)', input);

    await Promise.all(input.tokens.map(token => this.tokensService.mutation('deleteToken', { token })));

    return input.tokens;
  }

  async invalidateTarget(input: TargetSelector) {
    this.logger.debug('Invalidating target tokens (input=%o)', input);

    await this.tokensService
      .mutation('invalidateTokenByTarget', {
        targetId: input.target,
      })
      .catch(error => {
        this.logger.error(error);
      });
  }

  async invalidateProject(input: ProjectSelector) {
    this.logger.debug('Invalidating project tokens (input=%o)', input);

    await this.tokensService
      .mutation('invalidateTokenByProject', {
        projectId: input.project,
      })
      .catch(error => {
        this.logger.error(error);
      });
  }

  async invalidateOrganization(input: OrganizationSelector) {
    this.logger.debug('Invalidating organization tokens (input=%o)', input);

    await this.tokensService
      .mutation('invalidateTokenByOrganization', {
        organizationId: input.organization,
      })
      .catch(error => {
        this.logger.error(error);
      });
  }

  async getTokens(selector: TargetSelector) {
    this.logger.debug('Fetching tokens (selector=%o)', selector);

    const response = await this.tokensService.query('targetTokens', {
      targetId: selector.target,
    });

    return response || [];
  }

  @atomic<TokenSelector>(({ token }) => token)
  async getToken({ token }: TokenSelector) {
    this.logger.debug('Fetching token (token=%s)', maskToken(token));

    try {
      return await this.tokensService.query('getToken', { token });
    } catch (e: any) {
      this.logger.error(e);

      throw new HiveError('Invalid token provided!');
    }
  }
}
