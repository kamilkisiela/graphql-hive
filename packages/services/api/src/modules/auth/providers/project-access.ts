import { Injectable, Scope } from 'graphql-modules';
import Dataloader from 'dataloader';
import { Logger } from '../../shared/providers/logger';
import { AccessError } from '../../../shared/errors';
import { OrganizationAccess } from './organization-access';

export interface ProjectUserAccessSelector {
  user: string;
  organization: string;
  project: string;
  scope: ProjectAccessScope;
}

export interface ProjectUserScopesSelector {
  user: string;
  organization: string;
}

interface ProjectTokenAccessSelector {
  token: string;
  organization: string;
  project: string;
  scope: ProjectAccessScope;
}

export enum ProjectAccessScope {
  /**
   * Read project data (targets, etc.)
   */
  READ = 'project:read',
  /**
   * Who can delete the project
   */
  DELETE = 'project:delete',
  /**
   * Who can modify projects's name
   */
  SETTINGS = 'project:settings',
  /**
   * Who can manage alerts
   */
  ALERTS = 'project:alerts',
  /**
   * Who can read Operations Store
   */
  OPERATIONS_STORE_READ = 'project:operations-store:read',
  /**
   * Who can write to Operations Store
   */
  OPERATIONS_STORE_WRITE = 'project:operations-store:write',
}

const projectAccessScopeValues = Object.values(ProjectAccessScope);

function isProjectScope(scope: any): scope is ProjectAccessScope {
  return projectAccessScopeValues.includes(scope);
}

@Injectable({
  scope: Scope.Operation,
})
export class ProjectAccess {
  private logger: Logger;
  private userAccess: Dataloader<ProjectUserAccessSelector, boolean, string>;
  private tokenAccess: Dataloader<ProjectTokenAccessSelector, boolean, string>;
  private scopes: Dataloader<
    ProjectUserScopesSelector,
    readonly ProjectAccessScope[],
    string
  >;

  constructor(logger: Logger, private organizationAccess: OrganizationAccess) {
    this.logger = logger.child({
      source: 'ProjectAccess',
    });
    this.userAccess = new Dataloader(
      async (selectors) => {
        const scopes = await this.scopes.loadMany(selectors);

        return selectors.map((selector, i) => {
          const scopesForSelector = scopes[i];

          if (scopesForSelector instanceof Error) {
            this.logger.warn(
              `ProjectAccess:user (error=%s, selector=%o)`,
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
            type: 'ProjectAccess:user',
            organization: selector.organization,
            project: selector.project,
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
            const tokenInfo = await this.organizationAccess.tokenInfo.load(
              selector
            );

            if (
              tokenInfo?.organization === selector.organization &&
              tokenInfo?.project === selector.project
            ) {
              return tokenInfo.scopes.includes(selector.scope);
            }

            return false;
          })
        ),
      {
        cacheKeyFn(selector) {
          return JSON.stringify({
            type: 'ProjectAccess:token',
            organization: selector.organization,
            project: selector.project,
            token: selector.token,
            scope: selector.scope,
          });
        },
      }
    );
    this.scopes = new Dataloader(
      async (selectors) => {
        const scopesPerSelector = await this.organizationAccess.getAllScopes(
          selectors
        );

        return selectors.map((selector, i) => {
          const scopes = scopesPerSelector[i];

          if (scopes instanceof Error) {
            this.logger.debug(
              `ProjectAccess:scopes (error=%s, selector=%o)`,
              scopes.message,
              selector
            );
            return [];
          }

          return scopes.filter(isProjectScope);
        });
      },
      {
        cacheKeyFn(selector) {
          return JSON.stringify({
            type: 'ProjectAccess:scopes',
            organization: selector.organization,
            user: selector.user,
          });
        },
      }
    );
  }

  async ensureAccessForToken(
    selector: ProjectTokenAccessSelector
  ): Promise<void | never> {
    const canAccess = await this.tokenAccess.load(selector);

    if (!canAccess) {
      throw new AccessError(`Missing ${selector.scope} permission`);
    }
  }

  async ensureAccessForUser(
    selector: ProjectUserAccessSelector
  ): Promise<void | never> {
    const canAccess = await this.userAccess.load(selector);

    if (!canAccess) {
      throw new AccessError(`Missing ${selector.scope} permission`);
    }
  }

  async getMemberScopes(selector: ProjectUserScopesSelector) {
    return this.scopes.load(selector);
  }

  resetAccessCache() {
    this.userAccess.clearAll();
    this.tokenAccess.clearAll();
    this.scopes.clearAll();
  }
}
