import { Injectable, Scope, Inject, forwardRef } from 'graphql-modules';
import Dataloader from 'dataloader';
import { Logger } from '../../shared/providers/logger';
import { Storage } from '../../shared/providers/storage';
import { Token } from '../../../shared/entities';
import { AccessError } from '../../../shared/errors';
import DataLoader from 'dataloader';
import {
  TokenStorage,
  TokenSelector,
} from '../../token/providers/token-storage';
import type { ProjectAccessScope } from './project-access';
import type { TargetAccessScope } from './target-access';

export interface OrganizationUserScopesSelector {
  user: string;
  organization: string;
}

export interface OrganizationUserAccessSelector {
  user: string;
  organization: string;
  scope: OrganizationAccessScope;
}

interface OrganizationTokenAccessSelector {
  token: string;
  organization: string;
  scope: OrganizationAccessScope;
}

export enum OrganizationAccessScope {
  /**
   * Read organization data (projects, targets, etc.)
   */
  READ = 'organization:read',
  /**
   * Who can delete the organization
   */
  DELETE = 'organization:delete',
  /**
   * Who can modify organization's settings
   */
  SETTINGS = 'organization:settings',
  /**
   * Who can add/remove 3rd-party integrations (Slack, etc.)
   */
  INTEGRATIONS = 'organization:integrations',
  /**
   * Who can manage members
   */
  MEMBERS = 'organization:members',
}

const organizationAccessScopeValues = Object.values(OrganizationAccessScope);

function isOrganizationScope(scope: any): scope is OrganizationAccessScope {
  return organizationAccessScopeValues.includes(scope);
}

@Injectable({
  scope: Scope.Operation,
})
export class OrganizationAccess {
  private logger: Logger;
  private userAccess: Dataloader<
    OrganizationUserAccessSelector,
    boolean,
    string
  >;
  private tokenAccess: Dataloader<
    OrganizationTokenAccessSelector,
    boolean,
    string
  >;
  private allScopes: DataLoader<
    OrganizationUserScopesSelector,
    ReadonlyArray<
      OrganizationAccessScope | ProjectAccessScope | TargetAccessScope
    >,
    string
  >;
  private scopes: DataLoader<
    OrganizationUserScopesSelector,
    readonly OrganizationAccessScope[],
    string
  >;
  tokenInfo: DataLoader<TokenSelector, Token | null, string>;

  constructor(
    logger: Logger,
    private storage: Storage,
    @Inject(forwardRef(() => TokenStorage)) private tokenStorage: TokenStorage
  ) {
    this.logger = logger.child({
      source: 'OrganizationAccess',
    });
    this.userAccess = new Dataloader(
      async (selectors) => {
        const scopes = await this.scopes.loadMany(selectors);

        return selectors.map((selector, i) => {
          const scopesForSelector = scopes[i];

          if (scopesForSelector instanceof Error) {
            this.logger.warn(
              `OrganizationAccess:user (error=%s, selector=%o)`,
              scopesForSelector.message,
              selector
            );
            return false;
          }

          return scopesForSelector.includes(selector.scope);
        });
      },
      {
        cacheKeyFn(selector) {
          return JSON.stringify({
            type: 'OrganizationAccess:user',
            organization: selector.organization,
            user: selector.user,
            scope: selector.scope,
          });
        },
      }
    );
    this.tokenAccess = new Dataloader(
      (selectors) =>
        Promise.all(
          selectors.map(async (selector) => {
            const tokenInfo = await this.tokenInfo.load(selector);

            if (tokenInfo?.organization === selector.organization) {
              return tokenInfo.scopes.includes(selector.scope);
            }

            return false;
          })
        ),
      {
        cacheKeyFn(selector) {
          return JSON.stringify({
            type: 'OrganizationAccess:token',
            organization: selector.organization,
            token: selector.token,
            scope: selector.scope,
          });
        },
      }
    );
    this.allScopes = new Dataloader(
      async (selectors) => {
        const scopesPerSelector =
          await this.storage.getOrganizationMemberAccessPairs(selectors);

        return selectors.map((_, i) => scopesPerSelector[i]);
      },
      {
        cacheKeyFn(selector) {
          return JSON.stringify({
            type: 'OrganizationAccess:allScopes',
            organization: selector.organization,
            user: selector.user,
          });
        },
      }
    );
    this.scopes = new Dataloader(
      async (selectors) => {
        const scopesPerSelector = await this.allScopes.loadMany(selectors);

        return selectors.map((selector, i) => {
          const scopes = scopesPerSelector[i];

          if (scopes instanceof Error) {
            this.logger.warn(
              `OrganizationAccess:scopes (error=%s, selector=%o)`,
              scopes.message,
              selector
            );
            return [];
          }

          return scopes.filter(isOrganizationScope);
        });
      },
      {
        cacheKeyFn(selector) {
          return JSON.stringify({
            type: 'OrganizationAccess:scopes',
            organization: selector.organization,
            user: selector.user,
          });
        },
      }
    );
    this.tokenInfo = new Dataloader(
      (selectors) =>
        Promise.all(
          selectors.map((selector) => this.tokenStorage.getToken(selector))
        ),
      {
        cacheKeyFn(selector) {
          return selector.token;
        },
      }
    );
  }

  async ensureAccessForToken(
    selector: OrganizationTokenAccessSelector
  ): Promise<void | never> {
    const canAccess = await this.tokenAccess.load(selector);

    if (!canAccess) {
      throw new AccessError(`Missing ${selector.scope} permission`);
    }
  }

  async ensureAccessForUser(
    selector: OrganizationUserAccessSelector
  ): Promise<void | never> {
    const canAccess = await this.userAccess.load(selector);

    if (!canAccess) {
      throw new AccessError(`Missing ${selector.scope} permission`);
    }
  }

  async checkAccessForUser(
    selector: OrganizationUserAccessSelector
  ): Promise<boolean> {
    return this.userAccess.load(selector);
  }

  async getMemberScopes(selector: OrganizationUserScopesSelector) {
    return this.scopes.load(selector);
  }

  async getAllScopes(selectors: readonly OrganizationUserScopesSelector[]) {
    return this.allScopes.loadMany(selectors);
  }

  resetAccessCache() {
    this.userAccess.clearAll();
    this.tokenAccess.clearAll();
    this.allScopes.clearAll();
    this.scopes.clearAll();
    this.tokenInfo.clearAll();
  }
}
