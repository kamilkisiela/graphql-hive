import Dataloader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { AccessError } from '../../../shared/errors';
import { Logger } from '../../shared/providers/logger';
import { OrganizationAccess } from './organization-access';
import { TargetAccessScope } from './scopes';

export { TargetAccessScope } from './scopes';

export interface TargetUserAccessSelector {
  user: string;
  organization: string;
  project: string;
  target: string;
  scope: TargetAccessScope;
}

export interface TargetUserScopesSelector {
  user: string;
  organization: string;
}

interface TargetTokenAccessSelector {
  token: string;
  organization: string;
  project: string;
  target: string;
  scope: TargetAccessScope;
}

const targetAccessScopeValues = Object.values(TargetAccessScope);

export function isTargetScope(scope: any): scope is TargetAccessScope {
  return targetAccessScopeValues.includes(scope);
}

@Injectable({
  scope: Scope.Operation,
})
export class TargetAccess {
  private logger: Logger;
  private userAccess: Dataloader<TargetUserAccessSelector, boolean, string>;
  private tokenAccess: Dataloader<TargetTokenAccessSelector, boolean, string>;
  private scopes: Dataloader<TargetUserScopesSelector, readonly TargetAccessScope[], string>;

  constructor(
    logger: Logger,
    private organizationAccess: OrganizationAccess,
  ) {
    this.logger = logger.child({
      source: 'TargetAccess',
    });
    this.userAccess = new Dataloader(
      async selectors => {
        const scopes = await this.scopes.loadMany(selectors);

        return selectors.map((selector, i) => {
          const scopesForSelector = scopes[i];

          if (scopesForSelector instanceof Error) {
            this.logger.warn(
              `TargetAccess:user (error=%s, selector=%o)`,
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
            type: 'TargetAccess:user',
            organization: selector.organization,
            project: selector.project,
            target: selector.target,
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
            const tokenInfo = await this.organizationAccess.tokenInfo.load(selector);

            if (
              tokenInfo?.organization === selector.organization &&
              tokenInfo?.project === selector.project &&
              tokenInfo?.target === selector.target
            ) {
              return tokenInfo.scopes.includes(selector.scope);
            }

            return false;
          }),
        ),
      {
        cacheKeyFn(selector) {
          return JSON.stringify({
            type: 'TargetAccess:token',
            organization: selector.organization,
            project: selector.project,
            target: selector.target,
            token: selector.token,
            scope: selector.scope,
          });
        },
      },
    );

    this.scopes = new Dataloader(
      async selectors => {
        const scopesPerSelector = await this.organizationAccess.getAllScopes(selectors);

        return selectors.map((selector, i) => {
          const scopes = scopesPerSelector[i];

          if (scopes instanceof Error) {
            this.logger.warn(
              `TargetAccess:scopes (error=%s, selector=%o)`,
              scopes.message,
              selector,
            );
            return [];
          }

          return scopes.filter(isTargetScope);
        });
      },
      {
        cacheKeyFn(selector) {
          return JSON.stringify({
            type: 'TargetAccess:scopes',
            organization: selector.organization,
            user: selector.user,
          });
        },
      },
    );
  }

  async ensureAccessForToken(selector: TargetTokenAccessSelector): Promise<void | never> {
    const canAccess = await this.tokenAccess.load(selector);

    if (!canAccess) {
      throw new AccessError(`Missing ${selector.scope} permission`);
    }
  }

  async ensureAccessForUser(selector: TargetUserAccessSelector): Promise<void | never> {
    const canAccess = await this.userAccess.load(selector);

    if (!canAccess) {
      throw new AccessError(`Missing ${selector.scope} permission`);
    }
  }

  async getMemberScopes(selector: TargetUserScopesSelector) {
    return this.scopes.load(selector);
  }

  resetAccessCache() {
    this.userAccess.clearAll();
    this.tokenAccess.clearAll();
    this.scopes.clearAll();
  }
}
