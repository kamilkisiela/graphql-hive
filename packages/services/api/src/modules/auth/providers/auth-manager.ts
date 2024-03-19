import { CONTEXT, Inject, Injectable, Scope } from 'graphql-modules';
import type { User } from '../../../shared/entities';
import { AccessError } from '../../../shared/errors';
import type { Listify, MapToArray } from '../../../shared/helpers';
import { share } from '../../../shared/helpers';
import { Storage } from '../../shared/providers/storage';
import { TokenStorage } from '../../token/providers/token-storage';
import {
  OrganizationAccess,
  OrganizationAccessScope,
  OrganizationUserScopesSelector,
} from './organization-access';
import { ProjectAccess, ProjectAccessScope, ProjectUserScopesSelector } from './project-access';
import { TargetAccess, TargetAccessScope, TargetUserScopesSelector } from './target-access';
import { ApiToken } from './tokens';
import { UserManager } from './user-manager';

export interface OrganizationAccessSelector {
  organization: string;
  scope: OrganizationAccessScope;
}

export interface ProjectAccessSelector {
  organization: string;
  project: string;
  scope: ProjectAccessScope;
}

export interface TargetAccessSelector {
  organization: string;
  project: string;
  target: string;
  scope: TargetAccessScope;
}

type SuperTokenSessionPayload = {
  version: '1';
  superTokensUserId: string;
  email: string;
  externalUserId: string | null;
};

/**
 * Responsible for auth checks.
 * Talks to Storage.
 */
@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class AuthManager {
  private session: SuperTokenSessionPayload | null;

  constructor(
    @Inject(ApiToken) private apiToken: string,
    @Inject(CONTEXT) context: any,
    private organizationAccess: OrganizationAccess,
    private projectAccess: ProjectAccess,
    private targetAccess: TargetAccess,
    private userManager: UserManager,
    private tokenStorage: TokenStorage,
    private storage: Storage,
  ) {
    this.session = context.session;
  }

  async ensureTargetAccess(
    selector: Listify<TargetAccessSelector, 'target'>,
  ): Promise<void | never> {
    if (this.apiToken) {
      if (hasManyTargets(selector)) {
        await Promise.all(
          selector.target.map(target =>
            this.ensureTargetAccess({
              ...selector,
              target,
            }),
          ),
        );
      } else {
        await this.targetAccess.ensureAccessForToken({
          ...(selector as TargetAccessSelector),
          token: this.apiToken,
        });
      }
    } else if (hasManyTargets(selector)) {
      await Promise.all(
        selector.target.map(target =>
          this.ensureTargetAccess({
            ...selector,
            target,
          }),
        ),
      );
    } else {
      const user = await this.getCurrentUser();
      await this.targetAccess.ensureAccessForUser({
        ...(selector as TargetAccessSelector),
        user: user.id,
      });
    }
  }

  async ensureProjectAccess(selector: ProjectAccessSelector): Promise<void | never> {
    if (this.apiToken) {
      await this.projectAccess.ensureAccessForToken({
        ...selector,
        token: this.apiToken,
      });
    } else {
      const user = await this.getCurrentUser();
      await this.projectAccess.ensureAccessForUser({
        ...selector,
        user: user.id,
      });
    }
  }

  async ensureOrganizationAccess(selector: OrganizationAccessSelector): Promise<void | never> {
    if (this.apiToken) {
      await this.organizationAccess.ensureAccessForToken({
        ...selector,
        token: this.apiToken,
      });
    } else {
      const user = await this.getCurrentUser();

      // If a user is an admin, we can allow access for all data
      if (user.isAdmin) {
        return;
      }

      await this.organizationAccess.ensureAccessForUser({
        ...selector,
        user: user.id,
      });
    }
  }

  async checkOrganizationAccess(selector: OrganizationAccessSelector): Promise<boolean> {
    if (this.apiToken) {
      throw new Error('checkOrganizationAccess for token is not implemented yet');
    }

    const user = await this.getCurrentUser();

    return this.organizationAccess.checkAccessForUser({
      ...selector,
      user: user.id,
    });
  }

  async ensureOrganizationOwnership(selector: { organization: string }): Promise<void | never> {
    const user = await this.getCurrentUser();
    const isOwner = await this.organizationAccess.checkOwnershipForUser({
      organization: selector.organization,
      user: user.id,
    });

    if (!isOwner) {
      throw new AccessError('You are not an owner or organization does not exist');
    }
  }

  ensureApiToken(): string | never {
    if (this.apiToken) {
      return this.apiToken;
    }

    throw new AccessError('Authorization header is missing');
  }

  getOrganizationOwnerByToken: () => Promise<User | never> = share(async () => {
    const token = this.ensureApiToken();
    const result = await this.tokenStorage.getToken({ token });

    await this.ensureOrganizationAccess({
      organization: result.organization,
      scope: OrganizationAccessScope.READ,
    });

    const member = await this.storage.getOrganizationOwner({
      organization: result.organization,
    });

    return member.user;
  });

  getCurrentUser: () => Promise<(User & { isAdmin: boolean }) | never> = share(async () => {
    if (!this.session) {
      throw new AccessError('Authorization token is missing', 'UNAUTHENTICATED');
    }

    const user = await this.storage.getUserBySuperTokenId({
      superTokensUserId: this.session.superTokensUserId,
    });

    if (!user) {
      throw new AccessError('User not found');
    }

    return user;
  });

  async getCurrentUserAccessScopes(organizationId: string) {
    const user = await this.getCurrentUser();

    if (!user) {
      throw new AccessError('User not found');
    }

    const [organizationScopes, projectScopes, targetScopes] = await Promise.all([
      this.getMemberOrganizationScopes({
        organization: organizationId,
        user: user.id,
      }),
      this.getMemberProjectScopes({
        organization: organizationId,
        user: user.id,
      }),
      this.getMemberTargetScopes({
        organization: organizationId,
        user: user.id,
      }),
    ]);

    return [...organizationScopes, ...projectScopes, ...targetScopes];
  }

  async updateCurrentUser(input: { displayName: string; fullName: string }): Promise<User> {
    const user = await this.getCurrentUser();
    return this.userManager.updateUser({
      id: user.id,
      ...input,
    });
  }

  isUser() {
    return !!this.session;
  }

  getMemberOrganizationScopes(selector: OrganizationUserScopesSelector) {
    return this.organizationAccess.getMemberScopes(selector);
  }

  getMemberProjectScopes(selector: ProjectUserScopesSelector) {
    return this.projectAccess.getMemberScopes(selector);
  }

  getMemberTargetScopes(selector: TargetUserScopesSelector) {
    return this.targetAccess.getMemberScopes(selector);
  }

  resetAccessCache() {
    this.organizationAccess.resetAccessCache();
    this.projectAccess.resetAccessCache();
    this.targetAccess.resetAccessCache();
  }
}

function hasManyTargets(
  selector: Listify<TargetAccessSelector, 'target'>,
): selector is MapToArray<TargetAccessSelector, 'target'> {
  return Array.isArray(selector.target);
}
