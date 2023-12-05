import Dataloader from 'dataloader';
import DataLoader from 'dataloader';
import { forwardRef, Inject, Injectable, Scope } from 'graphql-modules';
import { Token } from '../../../shared/entities';
import { AccessError } from '../../../shared/errors';
import { Logger } from '../../shared/providers/logger';
import { Storage } from '../../shared/providers/storage';
import { TokenSelector, TokenStorage } from '../../token/providers/token-storage';
import type { ProjectAccessScope } from './project-access';
import { OrganizationAccessScope } from './scopes';
import type { TargetAccessScope } from './target-access';

export { OrganizationAccessScope } from './scopes';

export interface OrganizationOwnershipSelector {
  user: string;
  organization: string;
}

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

const organizationAccessScopeValues = Object.values(OrganizationAccessScope);

export function isOrganizationScope(scope: any): scope is OrganizationAccessScope {
  return organizationAccessScopeValues.includes(scope);
}

@Injectable({
  scope: Scope.Operation,
})
export class OrganizationAccess {
  private logger: Logger;
  private userAccess: Dataloader<OrganizationUserAccessSelector, boolean, string>;
  private tokenAccess: Dataloader<OrganizationTokenAccessSelector, boolean, string>;
  private allScopes: DataLoader<
    OrganizationUserScopesSelector,
    ReadonlyArray<OrganizationAccessScope | ProjectAccessScope | TargetAccessScope>,
    string
  >;
  private scopes: DataLoader<
    OrganizationUserScopesSelector,
    readonly OrganizationAccessScope[],
    string
  >;
  tokenInfo: DataLoader<TokenSelector, Token | null, string>;
  ownership: DataLoader<
    {
      organization: string;
    },
    string | null,
    string
  >;

  constructor(
    logger: Logger,
    private storage: Storage,
    @Inject(forwardRef(() => TokenStorage)) private tokenStorage: TokenStorage,
  ) {
    this.logger = logger.child({
      source: 'OrganizationAccess',
    });
    this.userAccess = new Dataloader(
      async selectors => {
        const scopes = await this.scopes.loadMany(selectors);

        return selectors.map((selector, i) => {
          const scopesForSelector = scopes[i];

          if (scopesForSelector instanceof Error) {
            this.logger.warn(
              `OrganizationAccess:user (error=%s, selector=%o)`,
              scopesForSelector.message,
              selector,
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
      },
    );
    this.tokenAccess = new Dataloader(
      selectors =>
        Promise.all(
          selectors.map(async selector => {
            const tokenInfo = await this.tokenInfo.load(selector);

            if (tokenInfo?.organization === selector.organization) {
              return tokenInfo.scopes.includes(selector.scope);
            }

            return false;
          }),
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
      },
    );
    this.allScopes = new Dataloader(
      async selectors => {
        const scopesPerSelector = await this.storage.getOrganizationMemberAccessPairs(selectors);

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
      },
    );
    this.scopes = new Dataloader(
      async selectors => {
        const scopesPerSelector = await this.allScopes.loadMany(selectors);

        return selectors.map((selector, i) => {
          const scopes = scopesPerSelector[i];

          if (scopes instanceof Error) {
            this.logger.warn(
              `OrganizationAccess:scopes (error=%s, selector=%o)`,
              scopes.message,
              selector,
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
      },
    );

    this.ownership = new Dataloader(
      async selectors => {
        const ownerPerSelector = await Promise.all(
          selectors.map(selector => this.storage.getOrganizationOwnerId(selector)),
        );

        return selectors.map((_, i) => ownerPerSelector[i]);
      },
      {
        cacheKeyFn(selector) {
          return JSON.stringify({
            type: 'OrganizationAccess:ownership',
            organization: selector.organization,
          });
        },
      },
    );

    this.tokenInfo = new Dataloader(
      selectors => Promise.all(selectors.map(selector => this.tokenStorage.getToken(selector))),
      {
        cacheKeyFn(selector) {
          return selector.token;
        },
      },
    );
  }

  async ensureAccessForToken(selector: OrganizationTokenAccessSelector): Promise<void | never> {
    const canAccess = await this.tokenAccess.load(selector);

    if (!canAccess) {
      throw new AccessError(`Missing ${selector.scope} permission`);
    }
  }

  async ensureAccessForUser(selector: OrganizationUserAccessSelector): Promise<void | never> {
    const canAccess = await this.userAccess.load(selector);

    if (!canAccess) {
      throw new AccessError(`Missing ${selector.scope} permission`);
    }
  }

  async checkAccessForUser(selector: OrganizationUserAccessSelector): Promise<boolean> {
    return this.userAccess.load(selector);
  }

  async checkOwnershipForUser(selector: OrganizationOwnershipSelector) {
    const owner = await this.ownership.load(selector);

    if (!owner) {
      return false;
    }

    return owner === selector.user;
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
