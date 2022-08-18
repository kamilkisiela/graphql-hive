import { Injectable, Inject, Scope, CONTEXT } from 'graphql-modules';
import type { User } from '../../../shared/entities';
import type { Listify, MapToArray } from '../../../shared/helpers';
import { AccessError } from '../../../shared/errors';
import { share } from '../../../shared/helpers';
import { createOrUpdateUser } from '../../../shared/mixpanel';
import { Storage } from '../../shared/providers/storage';
import { MessageBus } from '../../shared/providers/message-bus';
import { IdempotentRunner } from '../../shared/providers/idempotent-runner';
import { TokenStorage } from '../../token/providers/token-storage';
import {
  ENSURE_PERSONAL_ORGANIZATION_EVENT,
  EnsurePersonalOrganizationEventPayload,
} from '../../organization/providers/events';
import { ApiToken } from './tokens';
import { OrganizationAccess, OrganizationAccessScope, OrganizationUserScopesSelector } from './organization-access';
import { ProjectAccess, ProjectAccessScope, ProjectUserScopesSelector } from './project-access';
import { TargetAccess, TargetAccessScope, TargetUserScopesSelector } from './target-access';
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

/**
 * Responsible for auth checks.
 * Talks to Storage.
 */
@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class AuthManager {
  // TODO: re-use this type
  private session: {
    version: '1';
    superTokensUserId: string;
    email: string;
  } | null;

  constructor(
    @Inject(ApiToken) private apiToken: string,
    @Inject(CONTEXT) context: any,
    private organizationAccess: OrganizationAccess,
    private projectAccess: ProjectAccess,
    private targetAccess: TargetAccess,
    private userManager: UserManager,
    private tokenStorage: TokenStorage,
    private messageBus: MessageBus,
    private storage: Storage,
    private idempotentRunner: IdempotentRunner
  ) {
    this.session = context.superTokenSession;
  }

  async ensureTargetAccess(selector: Listify<TargetAccessSelector, 'target'>): Promise<void | never> {
    if (this.apiToken) {
      if (hasManyTargets(selector)) {
        await Promise.all(
          selector.target.map(target =>
            this.ensureTargetAccess({
              ...selector,
              target,
            })
          )
        );
      } else {
        await this.targetAccess.ensureAccessForToken({
          ...(selector as TargetAccessSelector),
          token: this.apiToken,
        });
      }
    } else {
      if (hasManyTargets(selector)) {
        await Promise.all(
          selector.target.map(target =>
            this.ensureTargetAccess({
              ...selector,
              target,
            })
          )
        );
      } else {
        const user = await this.getCurrentUser();
        await this.targetAccess.ensureAccessForUser({
          ...(selector as TargetAccessSelector),
          user: user.id,
        });
      }
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

  ensureApiToken(): string | never {
    if (this.apiToken) {
      return this.apiToken;
    }

    throw new AccessError('Authorization header is missing');
  }

  getUserIdForTracking: () => Promise<string | null> = share(async () => {
    const user = await (this.apiToken ? this.getOrganizationOwnerByToken() : this.getCurrentUser());

    if (user.superTokensUserId) {
      createOrUpdateUser({
        id: user.superTokensUserId,
        email: user.email,
      });
    }

    return user.superTokensUserId;
  });

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
      throw new AccessError('Authorization token is missing');
    }

    const { session } = this;

    const internalUser = await this.idempotentRunner.run({
      identifier: `user:create:${session.superTokensUserId}`,
      executor: () =>
        this.ensureInternalUser({
          superTokensUserId: session.superTokensUserId,
          email: session.email,
        }),
      ttl: 60,
    });

    return {
      ...internalUser,
      isAdmin: false,
    };
  });

  private async ensureInternalUser(input: { superTokensUserId: string; email: string }) {
    let internalUser = await this.storage.getUserBySuperTokenId({
      superTokensUserId: input.superTokensUserId,
    });
    console.log('wtf');

    if (!internalUser) {
      internalUser = await this.userManager.createUser({
        superTokensUserId: input.superTokensUserId,
        email: input.email,
      });
    }

    await this.messageBus.emit<EnsurePersonalOrganizationEventPayload>(ENSURE_PERSONAL_ORGANIZATION_EVENT, {
      name: internalUser.displayName,
      user: {
        id: internalUser.id,
        superTokensUserId: input.superTokensUserId,
      },
    });

    return internalUser;
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
  selector: Listify<TargetAccessSelector, 'target'>
): selector is MapToArray<TargetAccessSelector, 'target'> {
  return Array.isArray(selector.target);
}
